import { useEffect, useRef } from "react";
import {fabric} from "fabric";


const Whiteboard = () => {

   const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvasEl = canvasRef.current;
    if (!canvasEl) return;

    // Initialize canvas
    const canvas = new fabric.Canvas(canvasEl, {
      isDrawingMode: true,
      backgroundColor: "#ffffff",
    });

    // Set brush settings
    const brush = canvas.freeDrawingBrush;
    if (brush) {
      brush.width = 5;
      brush.color = "black";
    }

    // Render and cleanup
    canvas.renderAll();

    return () => {
      canvas.dispose();
    };
  }, []);

  return (
    <div
      className="flex items-center justify-center h-[100vh] bg-gray-400 "
    >
      <canvas
        ref={canvasRef}
        width={800}
        height={600}
        id="canvas"
        className="bg-white rounded-2xl shadow hover:shadow-2xl hover: shadow-blue-400"
      />
    </div>
  );
}

export default Whiteboard