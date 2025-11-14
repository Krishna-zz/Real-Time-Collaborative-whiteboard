import React, { useEffect, useRef, useState } from "react";
import * as fabric from "fabric";

const WhiteboardWithShapes: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricCanvas = useRef<fabric.Canvas | null>(null);
  const modeRef = useRef<"draw" | "rect" | "circle" | "select">("draw");
  const [mode, setMode] = useState<"draw" | "rect" | "circle" | "select">("draw");

  useEffect(() => {
    if (!canvasRef.current) return;

    // Create the canvas once
    const canvas = new fabric.Canvas(canvasRef.current, {
      backgroundColor: "black",
      isDrawingMode: true,
      selection: false,
    });
    fabricCanvas.current = canvas;

    const brush = new fabric.PencilBrush(canvas);
    brush.width = 3;
    brush.color = "white";
    canvas.freeDrawingBrush = brush;

    let isDrawing = false;
    let shape: fabric.Rect | fabric.Circle | null = null;

    // --- Handlers ---
    const onMouseDown = (event: fabric.TPointerEventInfo) => {
      const currentMode = modeRef.current; // ✅ always latest mode
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
      if (!isDrawing || !shape) return;
      const pointer = canvas.getPointer(event.e);
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
    };

    // Attach once
    canvas.on("mouse:down", onMouseDown);
    canvas.on("mouse:move", onMouseMove);
    canvas.on("mouse:up", onMouseUp);

    return () => {
      canvas.dispose();
    };
  }, []);

  // --- Update mode dynamically ---
  useEffect(() => {
    modeRef.current = mode; // ✅ keep latest mode in ref
    const canvas = fabricCanvas.current;
    if (!canvas) return;

    canvas.isDrawingMode = mode === "draw";
    canvas.selection = mode === "select";
  }, [mode]);

  // --- UI ---
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

      <div className="shadow-2xl hover:shadow-blue-400 bg-black rounded-xl">
        <canvas ref={canvasRef} width={800} height={500} />
      </div>
    </div>
  );
};

export default WhiteboardWithShapes;
