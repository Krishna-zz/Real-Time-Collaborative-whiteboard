// client/src/WhiteboardWithShapes.tsx
import React, { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import * as fabric from "fabric";

const socket = io("http://localhost:5000");

const WhiteboardWithShapes: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricCanvas = useRef<fabric.Canvas | null>(null);
  const cursorLayer = useRef<HTMLDivElement | null>(null);

  const modeRef = useRef<"draw" | "rect" | "circle" | "select">("draw");
  const [mode, setMode] = useState<"draw" | "rect" | "circle" | "select">(
    "draw"
  );

  useEffect(() => {
    if (!canvasRef.current) return;

    // ---------------- FABRIC CANVAS INIT ----------------
    const canvas = new fabric.Canvas(canvasRef.current, {
      backgroundColor: "black",
      isDrawingMode: true,
      selection: false,
    });
    fabricCanvas.current = canvas;

    // Pencil brush
    const brush = new fabric.PencilBrush(canvas);
    brush.width = 3;
    brush.color = "white";
    canvas.freeDrawingBrush = brush;

    let isDrawing = false;
    let shape: fabric.Rect | fabric.Circle | null = null;

    // ---------------- REAL-TIME CANVAS LISTENER ----------------
    socket.on("canvas:update", (data: string) => {
      if (!fabricCanvas.current) return;
      fabricCanvas.current.loadFromJSON(
        data,
        fabricCanvas.current.renderAll.bind(fabricCanvas.current)
      );
    });

    // ---------------- SHAPE + DRAW LOGIC ----------------
    const onMouseDown = (event: fabric.TPointerEventInfo) => {
      const currentMode = modeRef.current;
      const pointer = canvas.getPointer(event.e);

      if (currentMode === "rect") {
        isDrawing = true;
        shape = new fabric.Rect({
          left: pointer.x,
          top: pointer.y,
          width: 0,
          height: 0,
          fill: "rgba(248, 231, 3, 0.9)",
          stroke: "yellow",
          strokeWidth: 2,
          shadow: new fabric.Shadow({
            color: "rgba(235, 29, 22, 0.77)",
            blur: 11,
            offsetX: 7,
            offsetY: 7,
          }),
        });
        canvas.add(shape);
      } else if (currentMode === "circle") {
        isDrawing = true;
        shape = new fabric.Circle({
          left: pointer.x,
          top: pointer.y,
          radius: 0,
          fill: "rgba(245, 29, 22, 0.15)",
          stroke: "orange",
          strokeWidth: 2,
          shadow: new fabric.Shadow({
            color: "rgba(235, 29, 22, 0.77)",
            blur: 17,
            offsetX: 15,
            offsetY: 15,
          }),
        });
        canvas.add(shape);
      }
    };

    const onMouseMove = (event: fabric.TPointerEventInfo) => {
      const pointer = canvas.getPointer(event.e);

      // ----- EMIT CURSOR POSITION -----
      socket.emit("cursor:move", {
        id: socket.id,
        x: pointer.x,
        y: pointer.y,
      });

      // --- Shape resizing ---
      if (!isDrawing || !shape) return;

      if (shape instanceof fabric.Rect) {
        shape.set({
          width: pointer.x - (shape.left ?? 0),
          height: pointer.y - (shape.top ?? 0),
        });
      } else if (shape instanceof fabric.Circle) {
        const radius = Math.sqrt(
          Math.pow(pointer.x - (shape.left ?? 0), 2) +
          Math.pow(pointer.y - (shape.top ?? 0), 2)
        );
        shape.set({ radius });
      }

      canvas.renderAll();
    };

    const onMouseUp = () => {
      isDrawing = false;
      shape = null;

      socket.emit("canvas:update", JSON.stringify(canvas.toJSON()));
    };

    const onObjectModified = () => {
      socket.emit("canvas:update", JSON.stringify(canvas.toJSON()));
    };

    // ---------------- DELETE OBJECT ----------------
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Delete" || e.key === "Backspace") {
        const activeObj = canvas.getActiveObject();
        if (activeObj) {
          canvas.remove(activeObj);
          socket.emit("canvas:update", JSON.stringify(canvas.toJSON()));
        }
      }
    };

    // ---------------- ATTACH EVENTS ----------------
    canvas.on("mouse:down", onMouseDown);
    canvas.on("mouse:move", onMouseMove);
    canvas.on("mouse:up", onMouseUp);
    canvas.on("object:modified", onObjectModified);

    window.addEventListener("keydown", handleKeyDown);

    // ---------------- REAL-TIME CURSOR RENDER LOGIC ----------------
    const cursors: Record<string, HTMLDivElement> = {};

    socket.on("cursor:move", ({ id, x, y }) => {
      if (!cursorLayer.current) return;

      if (!cursors[id]) {
        const el = document.createElement("div");
        el.style.position = "absolute";
        el.style.width = "10px";
        el.style.height = "10px";
        el.style.borderRadius = "50%";
        el.style.background = "#00eaff";
        el.style.boxShadow = "0 0 10px #00eaff";
        el.style.pointerEvents = "none";
        cursorLayer.current.appendChild(el);
        cursors[id] = el;
      }

      cursors[id].style.transform = `translate(${x}px, ${y}px)`;
    });

    socket.on("user:disconnect", (id) => {
      if (cursors[id]) {
        cursors[id].remove();
        delete cursors[id];
      }
    });

    // ---------------- CLEANUP ----------------
    return () => {
      socket.off("canvas:update");
      socket.off("cursor:move");
      socket.off("user:disconnect");
      canvas.dispose();
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  // ---------------- MODE SWITCHING ----------------
  useEffect(() => {
    modeRef.current = mode;
    const canvas = fabricCanvas.current;
    if (!canvas) return;

    canvas.isDrawingMode = mode === "draw";
    canvas.selection = mode === "select";
  }, [mode]);

  const setDrawingMode = (newMode: typeof mode) => setMode(newMode);

  return (
    <div className="bg-gradient-to-b from-black via-[#020617] to-[#0f172a] min-h-screen flex flex-col items-center justify-center">
      <div className="mb-4">
        <button
          className="bg-blue-500 text-white rounded-2xl mr-2 px-4 py-2 shadow-2xl"
          onClick={() => setDrawingMode("draw")}
        >
          ✏️ Draw
        </button>
        <button
          className="bg-green-500 text-white rounded-2xl mr-2 px-4 py-2 shadow-2xl"
          onClick={() => setDrawingMode("rect")}
        >
          ⬛ Rectangle
        </button>
        <button
          className="bg-red-500 text-white rounded-2xl mr-2 px-4 py-2 shadow-2xl"
          onClick={() => setDrawingMode("circle")}
        >
          ⚪ Circle
        </button>
        <button
          className="bg-pink-500 text-white rounded-2xl mr-2 px-4 py-2 shadow-2xl"
          onClick={() => setDrawingMode("select")}
        >
          🖱️ Select
        </button>
      </div>

      {/* Canvas Container */}
      <div className="relative shadow-2xl bg-black rounded-xl">
        <canvas ref={canvasRef} width={800} height={500} />

        {/* Cursor Overlay */}
        <div
          ref={cursorLayer}
          className="absolute inset-0 pointer-events-none"
        />
      </div>
    </div>
  );
};

export default WhiteboardWithShapes;
