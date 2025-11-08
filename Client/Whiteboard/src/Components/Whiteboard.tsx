import { useEffect, useRef } from "react";
import {fabric} from "fabric";


const Whiteboard = () => {

   const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvasEl = canvasRef.current;
    

    // Initialize canvas
    const canvas = new fabric.Canvas(canvasEl, {
      isDrawingMode: true,
      backgroundColor: "#ffffff",
      
    });

    // Set brush settings
    const brush = canvas.freeDrawingBrush;
   
      brush.width = 5;
      brush.color = "black";
      
    

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
      <div className="bg-white rounded-2xl shadow hover:shadow-2xl hover:shadow-blue-400 p-2">
      <canvas
        ref={canvasRef}
        width={800}
        height={600}
        id="canvas"
        style={{
        display: "block",
        background: "white",
        borderRadius: "1rem", // optional safe rounding
      }}
      />
      </div>
    </div>
  );
}

export default Whiteboard