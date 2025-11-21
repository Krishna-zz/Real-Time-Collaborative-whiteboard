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
  const localStrokeObj = useRef<fabric.Polyline | null>(null);
  const localStrokePoints = useRef<Array<{ x: number; y: number }>>([]);
  const drawingShapeId = useRef<string | null>(null);
  const localShapeObj = useRef<fabric.Rect | fabric.Circle | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = new fabric.Canvas(canvasRef.current, {
      backgroundColor: "black",
      isDrawingMode: false, // we draw manually
      selection: false,
    });
    fabricCanvas.current = canvas;

    // brush defaults
    const defaultStroke = {
      color: "white",
      width: 3,
      lineCap: "round" as CanvasLineCap,
      lineJoin: "round" as CanvasLineJoin,
    };

    // maps
    const remoteObjects: Record<string, fabric.Object> = {};
    const remoteStrokes: Record<string, fabric.Polyline> = {};
    const tempSegmentGroups: Record<string, fabric.Group | fabric.Object[]> = {};
    const cursors: Record<string, HTMLDivElement> = {};

    const assignId = (obj: fabric.Object, id: string) => {
      (obj as any).customId = id;
    };

    // ---------- Cursor ----------
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

    // ---------- Remote live stroke handling ----------
    socket.on("draw-live", (payload: { strokeId: string; point: { x: number; y: number }; color: string; width: number }) => {
      const { strokeId, point, color, width } = payload;
      // create remote polyline if missing
      let poly = remoteStrokes[strokeId];
      if (!poly) {
        poly = new fabric.Polyline([point], {
          stroke: color || defaultStroke.color,
          strokeWidth: width || defaultStroke.width,
          fill: "",
          selectable: false,
          evented: false,
          strokeLineCap: defaultStroke.lineCap,
          strokeLineJoin: defaultStroke.lineJoin,
          strokeUniform: true,
        });
        remoteStrokes[strokeId] = poly;
        canvas.add(poly);
      } else {
        const pts: any[] = (poly as any).points ? (poly as any).points : [];
        pts.push(point);
        poly.set({ points: pts });
      }
      try { (poly as any).setCoords(); } catch {}
      canvas.requestRenderAll();
    });

    // finalization of remote stroke: replace polyline with final path
    socket.on("draw-final", (payload: { strokeId: string; path: any; color: string; width: number }) => {
      const { strokeId, path, color, width } = payload;
      // remove any live polyline
      const live = remoteStrokes[strokeId];
      if (live) {
        canvas.remove(live);
        delete remoteStrokes[strokeId];
      }
      // create final path (fabric.Path expects svg path data or path array)
      // Received `path` is expected to be a path.toObject() compatible object.
      // We'll use Fabric.Path with the path data if present, else fallback to Polyline.
      try {
        // If payload.path.path exists (fabric path object), use it
        const pathData = (path && (path.path || path.commands || path)) as any;
        const final = new fabric.Path(pathData, {
          stroke: color || defaultStroke.color,
          strokeWidth: width || defaultStroke.width,
          fill: "",
          selectable: true,
          evented: true,
          strokeLineCap: defaultStroke.lineCap,
          strokeLineJoin: defaultStroke.lineJoin,
          strokeUniform: true,
        });
        assignId(final, strokeId);
        canvas.add(final);
        final.setCoords();
      } catch (err) {
        // fallback: create polyline from path points if shape
        if (Array.isArray((path && path.points) || [])) {
          const pts = (path.points || []);
          const poly = new fabric.Polyline(pts as any, {
            stroke: color || defaultStroke.color,
            strokeWidth: width || defaultStroke.width,
            fill: "",
            selectable: true,
            evented: true,
            strokeLineCap: defaultStroke.lineCap,
            strokeLineJoin: defaultStroke.lineJoin,
            strokeUniform: true,
          });
          assignId(poly, strokeId);
          canvas.add(poly);
          poly.setCoords();
        }
      }
      canvas.requestRenderAll();
    });

    // ---------- Shapes + object events (unchanged) ----------
    socket.on("shape:start", ({ shapeId, type, left, top, style }) => {
      let obj: fabric.Object;
      if (type === "rect") {
        obj = new fabric.Rect({
          left, top, width: 0, height: 0, selectable: true, ...style
        });
      } else {
        obj = new fabric.Circle({
          left, top, radius: 0, selectable: true, ...style
        });
      }
      assignId(obj, shapeId);
      remoteObjects[shapeId] = obj;
      canvas.add(obj);
      try { obj.setCoords(); } catch {}
      canvas.requestRenderAll();
    });

    socket.on("shape:update", ({ shapeId, props }) => {
      const obj = remoteObjects[shapeId];
      if (!obj) return;
      obj.set(props);
      try { obj.setCoords(); } catch {}
      canvas.requestRenderAll();
    });

    socket.on("shape:end", ({ shapeId, props }) => {
      const obj = remoteObjects[shapeId];
      if (!obj) return;
      obj.set(props);
      assignId(obj, shapeId);
      try { obj.setCoords(); } catch {}
      canvas.requestRenderAll();
    });

    socket.on("object:modified", ({ id, props }) => {
      const found = canvas.getObjects().find((o) => (o as any).customId === id);
      if (found) {
        found.set(props);
        try { (found as any).setCoords(); } catch {}
        canvas.requestRenderAll();
      }
    });

    socket.on("object:removed", ({ id }) => {
      const found = canvas.getObjects().find((o) => (o as any).customId === id);
      if (found) {
        canvas.remove(found);
        canvas.requestRenderAll();
      }
    });

    // ---------- Local input handling (live segments + finalization) ----------
    const emitCursor = (pointer: { x: number; y: number }) => {
      socket.emit("cursor:move", { x: pointer.x, y: pointer.y });
    };

    let isDrawing = false;
    let lastPoint: { x: number; y: number } | null = null;

    // Helper to build a unique stroke id
    const makeStrokeId = () => `${socket.id}_${Date.now()}`;

    canvas.on("mouse:down", (e) => {
      const p = canvas.getPointer((e as any).e);
      emitCursor(p);

      const currentMode = modeRef.current;
      if (currentMode === "draw") {
        isDrawing = true;
        lastPoint = { x: p.x, y: p.y };
        const strokeId = makeStrokeId();
        localStrokeId.current = strokeId;
        localStrokePoints.current = [{ x: p.x, y: p.y }];

        // create local polyline for live preview
        const poly = new fabric.Polyline([{ x: p.x, y: p.y }], {
          stroke: defaultStroke.color,
          strokeWidth: defaultStroke.width,
          fill: "",
          selectable: false,
          evented: false,
          strokeLineCap: defaultStroke.lineCap,
          strokeLineJoin: defaultStroke.lineJoin,
          strokeUniform: true,
        });
        localStrokeObj.current = poly;
        assignId(poly, strokeId);
        canvas.add(poly);
        try { poly.setCoords(); } catch {}
        canvas.requestRenderAll();

        // emit first live point (start)
        socket.emit("draw-live", { strokeId, point: { x: p.x, y: p.y }, color: defaultStroke.color, width: defaultStroke.width });
      } else if (currentMode === "rect" || currentMode === "circle") {
        isDrawing = true;
        const shapeId = `${socket.id}_${Date.now()}`;
        drawingShapeId.current = shapeId;

        if (currentMode === "rect") {
          localShapeObj.current = new fabric.Rect({
            left: p.x, top: p.y, width: 0, height: 0,
            fill: "rgba(248, 231, 3, 0.9)", stroke: "yellow", strokeWidth: 2,
            shadow: new fabric.Shadow({ color: "rgba(235,29,22,0.77)", blur: 11, offsetX: 7, offsetY: 7 }),
            selectable: true
          });
        } else {
          localShapeObj.current = new fabric.Circle({
            left: p.x, top: p.y, radius: 0,
            fill: "rgba(245,29,22,0.15)", stroke: "orange", strokeWidth: 2,
            shadow: new fabric.Shadow({ color: "rgba(235,29,22,0.77)", blur: 17, offsetX: 15, offsetY: 15 }),
            selectable: true
          });
        }

        canvas.add(localShapeObj.current);
        assignId(localShapeObj.current, shapeId);
        try { localShapeObj.current.setCoords(); } catch {}
        canvas.requestRenderAll();

        socket.emit("shape:start", { shapeId, type: currentMode, left: p.x, top: p.y, style: {} });
      }
    });

    canvas.on("mouse:move", (e) => {
      const p = canvas.getPointer((e as any).e);
      emitCursor(p);

      if (!isDrawing) return;
      const currentMode = modeRef.current;

      if (currentMode === "draw" && localStrokeObj.current && localStrokeId.current) {
        // append to local polyline
        const poly = localStrokeObj.current;
        const pts: any[] = (poly as any).points ? (poly as any).points : [];
        pts.push({ x: p.x, y: p.y });
        poly.set({ points: pts });
        try { poly.setCoords(); } catch {}
        canvas.requestRenderAll();

        // add to local points list
        localStrokePoints.current.push({ x: p.x, y: p.y });

        // emit live single point (fast)
        socket.emit("draw-live", { strokeId: localStrokeId.current, point: { x: p.x, y: p.y }, color: defaultStroke.color, width: defaultStroke.width });

        lastPoint = { x: p.x, y: p.y };
      } else if ((currentMode === "rect" || currentMode === "circle") && localShapeObj.current && drawingShapeId.current) {
        const obj = localShapeObj.current;
        if (obj instanceof fabric.Rect) {
          const left = obj.left ?? 0;
          const top = obj.top ?? 0;
          obj.set({ width: p.x - left, height: p.y - top });
          try { obj.setCoords(); } catch {}
          socket.emit("shape:update", { shapeId: drawingShapeId.current, props: { width: p.x - left, height: p.y - top } });
        } else if (obj instanceof fabric.Circle) {
          const cx = obj.left ?? 0;
          const cy = obj.top ?? 0;
          const r = Math.sqrt(Math.pow(p.x - cx, 2) + Math.pow(p.y - cy, 2));
          obj.set({ radius: r });
          try { obj.setCoords(); } catch {}
          socket.emit("shape:update", { shapeId: drawingShapeId.current, props: { radius: r } });
        }
        canvas.requestRenderAll();
      }
    });

    canvas.on("mouse:up", () => {
      const currentMode = modeRef.current;

      if (currentMode === "draw" && localStrokeId.current) {
        // finalize: emit final path data to remotes
        const pts = localStrokePoints.current.slice();
        // create SVG path string from points for smaller payload & proper rendering
        let svgPath = "";
        if (pts.length > 0) {
          svgPath = `M ${pts[0].x} ${pts[0].y}`;
          for (let i = 1; i < pts.length; i++) {
            svgPath += ` L ${pts[i].x} ${pts[i].y}`;
          }
        }
        socket.emit("draw-final", { strokeId: localStrokeId.current, path: svgPath, color: defaultStroke.color, width: defaultStroke.width });

        // make local stroke selectable
        if (localStrokeObj.current) {
          localStrokeObj.current.set({ selectable: true, evented: true });
          try { localStrokeObj.current.setCoords(); } catch {}
        }

        // cleanup local buffers
        localStrokeId.current = null;
        localStrokeObj.current = null;
        localStrokePoints.current = [];
      } else if ((currentMode === "rect" || currentMode === "circle") && drawingShapeId.current) {
        const obj = fabricCanvas.current?.getObjects().find((o) => (o as any).customId === drawingShapeId.current);
        if (obj) {
          socket.emit("shape:end", { shapeId: drawingShapeId.current, props: { left: obj.left ?? 0, top: obj.top ?? 0, ...(obj as any).toObject ? (obj as any).toObject() : {} } });
        }
        drawingShapeId.current = null;
        localShapeObj.current = null;
      }

      isDrawing = false;
      lastPoint = null;
    });

    // object modification
    canvas.on("object:modified", (e) => {
      const obj = e.target;
      if (!obj) return;
      const id = (obj as any).customId;
      if (!id) return;
      socket.emit("object:modified", { id, props: { left: obj.left, top: obj.top, scaleX: obj.scaleX, scaleY: obj.scaleY, angle: obj.angle } });
    });

    // delete
    const handleKeyDown = (ev: KeyboardEvent) => {
      if (ev.key === "Delete" || ev.key === "Backspace") {
        const active = canvas.getActiveObject();
        if (active) {
          const id = (active as any).customId;
          if (id) socket.emit("object:removed", { id });
          canvas.remove(active);
          canvas.requestRenderAll();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);

    // cleanup
    return () => {
      socket.off("cursor:update");
      socket.off("cursor:remove");
      socket.off("draw-live");
      socket.off("draw-final");
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
    canvas.isDrawingMode = false; // always manual
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
