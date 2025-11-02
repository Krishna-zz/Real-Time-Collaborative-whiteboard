import React, { useEffect, useRef, useState } from "react";
import  fabric  from "fabric";

const Whiteboard: React.FC = () => {
  const canvasRef = useRef<fabric.Canvas | null>(null);
  const canvasEl = useRef<HTMLCanvasElement | null>(null);

  const [currentMode, setCurrentMode] = useState<string>("select");
  const [drawingColor, setDrawingColor] = useState<string>("#000000");
  const [lineWidth, setLineWidth] = useState<number>(2);

  const startX = useRef<number>(0);
  const startY = useRef<number>(0);
  const tempShape = useRef<fabric.Object | null>(null);

  // Initialize Canvas
  useEffect(() => {
    if (!canvasEl.current) return;

    const canvas = new fabric.Canvas(canvasEl.current, {
      isDrawingMode: false,
      backgroundColor: "white",
    });
    canvasRef.current = canvas;

    const resizeCanvas = () => {
      canvas.setHeight(window.innerHeight - 60);
      canvas.setWidth(window.innerWidth);
      canvas.renderAll();
    };
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    return () => {
      window.removeEventListener("resize", resizeCanvas);
      canvas.dispose();
    };
  }, []);

  // Drawing tools logic
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleMouseDown = (opt: any) => {
      if (!canvas) return;
      const pointer = canvas.getPointer(opt.e);

      if (currentMode === "rect" || currentMode === "circle") {
        startX.current = pointer.x;
        startY.current = pointer.y;

        if (currentMode === "rect") {
          tempShape.current = new fabric.Rect({
            left: startX.current,
            top: startY.current,
            width: 0,
            height: 0,
            fill: "transparent",
            stroke: drawingColor,
            strokeWidth: lineWidth,
          });
        } else {
          tempShape.current = new fabric.Circle({
            left: startX.current,
            top: startY.current,
            radius: 0,
            fill: "transparent",
            stroke: drawingColor,
            strokeWidth: lineWidth,
          });
        }
        canvas.add(tempShape.current);
      }
    };

    const handleMouseMove = (opt: any) => {
      if (!canvas || !tempShape.current) return;
      const pointer = canvas.getPointer(opt.e);

      if (currentMode === "rect") {
        const width = Math.abs(pointer.x - startX.current);
        const height = Math.abs(pointer.y - startY.current);
        tempShape.current.set({
          left: Math.min(pointer.x, startX.current),
          top: Math.min(pointer.y, startY.current),
          width,
          height,
        });
      } else if (currentMode === "circle") {
        const radius =
          Math.sqrt(
            Math.pow(pointer.x - startX.current, 2) +
              Math.pow(pointer.y - startY.current, 2)
          ) / 2;
        tempShape.current.set({ radius });
      }
      canvas.renderAll();
    };

    const handleMouseUp = () => {
      tempShape.current = null;
    };

    canvas.on("mouse:down", handleMouseDown);
    canvas.on("mouse:move", handleMouseMove);
    canvas.on("mouse:up", handleMouseUp);

    return () => {
      canvas.off("mouse:down", handleMouseDown);
      canvas.off("mouse:move", handleMouseMove);
      canvas.off("mouse:up", handleMouseUp);
    };
  }, [currentMode, drawingColor, lineWidth]);

  // Tool actions
  const handleSelect = () => {
    setCurrentMode("select");
    canvasRef.current!.isDrawingMode = false;
  };

  const handleDraw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setCurrentMode("draw");
    canvas.isDrawingMode = true;
    if (!canvas.freeDrawingBrush) {
      canvas.freeDrawingBrush = new fabric.PencilBrush(canvas);
    }
    canvas.freeDrawingBrush.color = drawingColor;
    canvas.freeDrawingBrush.width = lineWidth;
  };

  const handleAddText = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setCurrentMode("text");
    canvas.isDrawingMode = false;
    const text = new fabric.IText("Type here", {
      left: 100,
      top: 100,
      fill: drawingColor,
      fontSize: 22,
    });
    canvas.add(text);
    canvas.setActiveObject(text);
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.clear();
    canvas.backgroundColor = "white";
  };

  const handleSave = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataURL = canvas.toDataURL({ format: "png", quality: 1, multiplier: 1 });
    const link = document.createElement("a");
    link.href = dataURL;
    link.download = "whiteboard.png";
    link.click();
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      {/* Toolbar */}
      <div
        style={{
          display: "flex",
          gap: "10px",
          padding: "10px",
          background: "#fff",
          borderBottom: "1px solid #ccc",
          alignItems: "center",
        }}
      >
        <button onClick={handleSelect}>🖱️ Select</button>
        <button onClick={handleDraw}>✏️ Draw</button>
        <button onClick={() => setCurrentMode("rect")}>⬛ Rect</button>
        <button onClick={() => setCurrentMode("circle")}>⚪ Circle</button>
        <button onClick={handleAddText}>🅰️ Text</button>

        <label>
          Color:
          <input
            type="color"
            value={drawingColor}
            onChange={(e) => setDrawingColor(e.target.value)}
          />
        </label>

        <label>
          Stroke:
          <select
            value={lineWidth}
            onChange={(e) => setLineWidth(Number(e.target.value))}
          >
            <option>2</option>
            <option>4</option>
            <option>6</option>
            <option>8</option>
          </select>
        </label>

        <button onClick={handleClear}>🗑️ Clear</button>
        <button onClick={handleSave}>💾 Export</button>
      </div>

      {/* Canvas */}
      <canvas ref={canvasEl} />
    </div>
  );
};

export default Whiteboard;
