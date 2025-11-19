// client/src/WhiteboardWithShapes.tsx
import React, { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import * as fabric from "fabric";

const socket = io("http://localhost:5000");

type Mode = "draw" | "rect" | "circle" | "select";

const WhiteboardWithShapes: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fabricCanvas = useRef<fabric.Canvas | null>(null);
  const cursorLayer = useRef<HTMLDivElement | null>(null);

  const modeRef = useRef<Mode>("draw");
  const [mode, setMode] = useState<Mode>("draw");

  // transient drawing state
  const localStrokeId = useRef<string | null>(null);
  const localStrokePoints = useRef<Array<{ x: number; y: number }>>([]);
  const drawingShapeId = useRef<string | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = new fabric.Canvas(canvasRef.current, {
      backgroundColor: "black",
      isDrawingMode: true,
      selection: false,
    });
    fabricCanvas.current = canvas;

    // pencil brush settings
    const brush = new fabric.PencilBrush(canvas);
    brush.width = 3;
    brush.color = "white";
    canvas.freeDrawingBrush = brush;

    // Map to keep remote objects (shapes/strokes) by id
    const remoteObjects: Record<string, fabric.Object> = {};
    const remoteStrokes: Record<string, fabric.Polyline> = {};
    const cursors: Record<string, HTMLDivElement> = {};

    // Assign custom ids to locally created objects (so they can be synced later)
    function assignId(obj: fabric.Object, id: string) {
      // @ts-ignore
      obj.customId = id;
    }

    // ---------------------- CURSOR ----------------------
    socket.on("cursor:update", ({ socketId, x, y, color }) => {
      if (!cursorLayer.current) return;
      if (!cursors[socketId]) {
        const el = document.createElement("div");
        el.style.position = "absolute";
        el.style.width = "12px";
        el.style.height = "12px";
        el.style.borderRadius = "50%";
        el.style.background = color || "#00eaff";
        el.style.boxShadow = "0 0 8px " + (color || "#00eaff");
        el.style.transform = "translate(-50%,-50%)";
        el.style.pointerEvents = "none";
        cursorLayer.current.appendChild(el);
        cursors[socketId] = el;
      }
      cursors[socketId].style.left = `${x}px`;
      cursors[socketId].style.top = `${y}px`;
    });

    socket.on("cursor:remove", (id: string) => {
      if (cursors[id]) {
        cursors[id].remove();
        delete cursors[id];
      }
    });

    // receive remote stroke events
    socket.on("stroke:start", ({ strokeId, color, width, start }) => {
      // create polyline on remote side
      const poly = new fabric.Polyline([start], {
        stroke: color || "white",
        strokeWidth: width || 3,
        fill: "",
        selectable: false,
        evented: false,
      });
      remoteStrokes[strokeId] = poly;
      canvas.add(poly);
    });

    socket.on("stroke:move", ({ strokeId, point }) => {
      const poly = remoteStrokes[strokeId];
      if (!poly) return;
      // @ts-ignore fabric Polyline points are an array of {x,y}
      const pts = poly.points ? (poly.points as any[]) : [];
      pts.push(point);
      poly.set({ points: pts });
      // calcOffset isn't declared on the Polyline type in the TS defs, cast to any to call it safely
      poly.pathOffset = (poly as any).calcOffset?.();
      canvas.renderAll();
    });

    socket.on("stroke:end", ({ strokeId }) => {
      const poly = remoteStrokes[strokeId];
      if (!poly) return;
      // make it selectable so other clients can move/delete it later
      poly.set({ selectable: true, evented: true });
      // assign id
      assignId(poly, strokeId);
      remoteObjects[strokeId] = poly;
    });

    // receive shape events
    socket.on("shape:start", ({ shapeId, type, left, top, style }) => {
      let obj: fabric.Object;
      if (type === "rect") {
        obj = new fabric.Rect({
          left,
          top,
          width: 0,
          height: 0,
          selectable: true,
          ...style,
        });
      } else {
        // circle
        obj = new fabric.Circle({
          left,
          top,
          radius: 0,
          selectable: true,
          ...style,
        });
      }
      assignId(obj, shapeId);
      remoteObjects[shapeId] = obj;
      canvas.add(obj);
    });

    socket.on("shape:update", ({ shapeId, props }) => {
      const obj = remoteObjects[shapeId];
      if (!obj) return;
      obj.set(props);
      canvas.renderAll();
    });

    socket.on("shape:end", ({ shapeId, props }) => {
      const obj = remoteObjects[shapeId];
      if (!obj) return;
      obj.set(props);
      // ensure object has id/can be modified later
      assignId(obj, shapeId);
      canvas.renderAll();
    });

    // object modification and deletion sync
    socket.on("object:modified", ({ id, props }) => {
      // find object by custom id
      const found = canvas.getObjects().find((o) => (o as any).customId === id);
      if (found) {
        found.set(props);
        canvas.renderAll();
      }
    });

    socket.on("object:removed", ({ id }) => {
      const found = canvas.getObjects().find((o) => (o as any).customId === id);
      if (found) {
        canvas.remove(found);
        canvas.renderAll();
      }
    });

    // ---------------------- LOCAL DRAW + SHAPE LOGIC ----------------------

    // helper to emit cursor coords (send pointer relative to canvas)
    const emitCursor = (pointer: { x: number; y: number }) => {
      socket.emit("cursor:move", {
        x: pointer.x,
        y: pointer.y,
      });
    };

    // mouse events for pencil/shapes
    let isDrawing = false;
    let currentLocalShape: fabric.Rect | fabric.Circle | null = null;

    canvas.on("mouse:down", (e) => {
      const pointer = canvas.getPointer((e as any).e);
      emitCursor(pointer);

      const currentMode = modeRef.current;

      if (currentMode === "draw") {
        isDrawing = true;
        // new local stroke id
        const strokeId = `${socket.id}_${Date.now()}`;
        localStrokeId.current = strokeId;
        localStrokePoints.current = [{ x: pointer.x, y: pointer.y }];

        socket.emit("stroke:start", {
          strokeId,
          color: (canvas.freeDrawingBrush as any).color,
          width: (canvas.freeDrawingBrush as any).width,
          start: { x: pointer.x, y: pointer.y },
        });
        // the local drawing itself is handled by fabric's free drawing
      } else if (currentMode === "rect" || currentMode === "circle") {
        isDrawing = true;
        const shapeId = `${socket.id}_${Date.now()}`;
        drawingShapeId.current = shapeId;

        if (currentMode === "rect") {
          currentLocalShape = new fabric.Rect({
            left: pointer.x,
            top: pointer.y,
            width: 0,
            height: 0,
            fill: "rgba(248, 231, 3, 0.9)",
            stroke: "yellow",
            strokeWidth: 2,
            shadow: new fabric.Shadow({
              color: "rgba(235,29,22,0.77)",
              blur: 11,
              offsetX: 7,
              offsetY: 7,
            }),
            selectable: true,
          });
        } else {
          currentLocalShape = new fabric.Circle({
            left: pointer.x,
            top: pointer.y,
            radius: 0,
            fill: "rgba(245,29,22,0.15)",
            stroke: "orange",
            strokeWidth: 2,
            shadow: new fabric.Shadow({
              color: "rgba(235,29,22,0.77)",
              blur: 17,
              offsetX: 15,
              offsetY: 15,
            }),
            selectable: true,
          });
        }

        // add locally
        canvas.add(currentLocalShape);
        assignId(currentLocalShape, shapeId);

        // notify others
        socket.emit("shape:start", {
          shapeId,
          type: currentMode,
          left: pointer.x,
          top: pointer.y,
          style: {}, // we used same style on remote code; kept empty to avoid huge payload
        });
      } else {
        // select mode - nothing special
      }
    });

    canvas.on("mouse:move", (e) => {
      const pointer = canvas.getPointer((e as any).e);
      emitCursor(pointer);

      if (!isDrawing) return;
      const currentMode = modeRef.current;

      if (currentMode === "draw" && localStrokeId.current) {
        // collect point and emit
        const point = { x: pointer.x, y: pointer.y };
        localStrokePoints.current.push(point);
        socket.emit("stroke:move", {
          strokeId: localStrokeId.current,
          point,
        });
        // local drawing is handled by fabric free drawing brush
      } else if ((currentMode === "rect" || currentMode === "circle") && currentLocalShape) {
        // update local shape and emit update
        if (currentLocalShape instanceof fabric.Rect) {
          const left = currentLocalShape.left ?? 0;
          const top = currentLocalShape.top ?? 0;
          currentLocalShape.set({
            width: pointer.x - left,
            height: pointer.y - top,
          });
          socket.emit("shape:update", {
            shapeId: drawingShapeId.current,
            props: {
              width: pointer.x - left,
              height: pointer.y - top,
            },
          });
        } else if (currentLocalShape instanceof fabric.Circle) {
          const cx = currentLocalShape.left ?? 0;
          const cy = currentLocalShape.top ?? 0;
          const r = Math.sqrt(Math.pow(pointer.x - cx, 2) + Math.pow(pointer.y - cy, 2));
          currentLocalShape.set({ radius: r });
          socket.emit("shape:update", {
            shapeId: drawingShapeId.current,
            props: { radius: r },
          });
        }
        canvas.renderAll();
      }
    });

    canvas.on("mouse:up", () => {
      const currentMode = modeRef.current;

      if (currentMode === "draw" && localStrokeId.current) {
        socket.emit("stroke:end", { strokeId: localStrokeId.current });
        localStrokeId.current = null;
        localStrokePoints.current = [];
      } else if ((currentMode === "rect" || currentMode === "circle") && drawingShapeId.current) {
        // finalize shape
        const obj = canvas.getObjects().find((o) => (o as any).customId === drawingShapeId.current);
        if (obj) {
          socket.emit("shape:end", {
            shapeId: drawingShapeId.current,
            props: { left: (obj.left ?? 0), top: (obj.top ?? 0), ...(obj as any).toObject ? (obj as any).toObject() : {} },
          });
        }
        drawingShapeId.current = null;
        currentLocalShape = null;
      }
      isDrawing = false;
    });

    // When local objects are modified (moved/rotated/scaled)
    canvas.on("object:modified", (e) => {
      const obj = e.target;
      if (!obj) return;
      const id = (obj as any).customId;
      if (!id) return; // only sync objects we assigned ids to
      // send minimal transform
      socket.emit("object:modified", {
        id,
        props: {
          left: obj.left,
          top: obj.top,
          scaleX: obj.scaleX,
          scaleY: obj.scaleY,
          angle: obj.angle,
        },
      });
    });

    // Delete key
    const handleKeyDown = (ev: KeyboardEvent) => {
      if (ev.key === "Delete" || ev.key === "Backspace") {
        const active = canvas.getActiveObject();
        if (active) {
          const id = (active as any).customId;
          if (id) {
            socket.emit("object:removed", { id });
          }
          canvas.remove(active);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);

    // Keep canvas freeDrawingMode toggled by mode changes elsewhere (effect below will handle but ensure initial)
    canvas.isDrawingMode = modeRef.current === "draw";

    // Clean up on unmount
    return () => {
      socket.off("cursor:update");
      socket.off("cursor:remove");
      socket.off("stroke:start");
      socket.off("stroke:move");
      socket.off("stroke:end");
      socket.off("shape:start");
      socket.off("shape:update");
      socket.off("shape:end");
      socket.off("object:modified");
      socket.off("object:removed");
      window.removeEventListener("keydown", handleKeyDown);
      canvas.dispose();
    };
  }, []);

  // mode toggling
  useEffect(() => {
    modeRef.current = mode;
    const canvas = fabricCanvas.current;
    if (!canvas) return;
    canvas.isDrawingMode = mode === "draw";
    canvas.selection = mode === "select";
  }, [mode]);

  const setDrawingMode = (newMode: Mode) => setMode(newMode);

  return (
    <div className="bg-gradient-to-b from-black via-[#020617] to-[#0f172a] min-h-screen flex flex-col items-center justify-center">
      <div className="mb-4">
        <button className="bg-blue-500 text-white rounded-2xl mr-2 px-4 py-2 shadow-2xl" onClick={() => setDrawingMode("draw")}>✏️ Draw</button>
        <button className="bg-green-500 text-white rounded-2xl mr-2 px-4 py-2 shadow-2xl" onClick={() => setDrawingMode("rect")}>⬛ Rectangle</button>
        <button className="bg-red-500 text-white rounded-2xl mr-2 px-4 py-2 shadow-2xl" onClick={() => setDrawingMode("circle")}>⚪ Circle</button>
        <button className="bg-pink-500 text-white rounded-2xl mr-2 px-4 py-2 shadow-2xl" onClick={() => setDrawingMode("select")}>🖱️ Select</button>
      </div>

      <div className="relative shadow-2xl bg-black rounded-xl">
        <canvas ref={canvasRef} width={1000} height={600} />
        <div ref={cursorLayer} className="absolute inset-0 pointer-events-none" />
      </div>
    </div>
  );
};

export default WhiteboardWithShapes;
