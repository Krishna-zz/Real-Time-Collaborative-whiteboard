import React, { useEffect, useRef, useState } from "react";
import * as fabric from "fabric";

const WhiteboardWithShapes: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mode, setMode] = useState<"draw" | "rect" | "circle" | "select">("draw");
  const fabricCanvas = useRef<fabric.Canvas | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    
    const canvas = new fabric.Canvas(canvasRef.current, {
      isDrawingMode: false,
      selection: true,
    });
    fabricCanvas.current = canvas;

    
    const brush = new fabric.PencilBrush(canvas);
    brush.width = 3;
    brush.color = "white";
    canvas.freeDrawingBrush = brush;

    let isDrawing = false;
    let shape: fabric.Rect | fabric.Circle | null = null;

    
    const onMouseDown = (event: fabric.TPointerEventInfo) => {
      const pointer = canvas.getPointer(event.e);
      if (mode === "rect") {
        isDrawing = true;
        shape = new fabric.Rect({
          left: pointer.x,
          top: pointer.y,
          width: 0,
          height: 0,
          fill: "rgba(0,0,0,0.2)",
          stroke: "black",
          strokeWidth: 2,
        });
        canvas.add(shape);
      } else if (mode === "circle") {
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
        const width = pointer.x - (shape.left ?? 0);
        const height = pointer.y - (shape.top ?? 0);
        shape.set({ width, height });
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

   
    canvas.on("mouse:down", onMouseDown );
    canvas.on("mouse:move", onMouseMove );
    canvas.on("mouse:up", onMouseUp );

   
    return () => {
      canvas.dispose();
    };
  }, [mode]);

 
  const setDrawingMode = (newMode: typeof mode) => {
    setMode(newMode);
    if (!fabricCanvas.current) return;

    fabricCanvas.current.isDrawingMode = newMode === "draw";
    fabricCanvas.current.selection = newMode === "select";
  };

  return (
    <div className=" bg-gradient-to-b from-black via-[#020617] to-[#0f172a] min-h-screen flex flex-col items-center justify-center">
      <div className="mb-4">
        <button className="bg-blue-500 hover:bg-blue-550 text-white rounded-2xl hover:shadow-blue-500 mr-2 px-4 py-2 shadow-2xl" onClick={() => setDrawingMode("draw")}>✏️ Draw</button>
        <button className="bg-green-500 hover:bg-green-550 text-white rounded-2xl hover:shadow-green-500 mr-2 px-4 py-2 shadow-2xl" onClick={() => setDrawingMode("rect")}>⬛ Rectangle</button>
        <button className="bg-red-500 hover:bg-red-550 text-white rounded-2xl hover:shadow-red-500 mr-2 px-4 py-2 shadow-2xl" onClick={() => setDrawingMode("circle")}>⚪ Circle</button>
        <button className="bg-pink-500 hover:bg-pink-550 text-white rounded-2xl hover:shadow-pink-500 mr-2 px-4 py-2 shadow-2xl" onClick={() => setDrawingMode("select")}>🖱️ Select</button>
      </div>
      <div className=" shadow-2xl hover:shadow-blue-500 bg-black rounded-xl">
        <canvas
        ref={canvasRef}
        width={800}
        height={500}
        
        
         />
      </div>
    </div>
  );
};

export default WhiteboardWithShapes;
