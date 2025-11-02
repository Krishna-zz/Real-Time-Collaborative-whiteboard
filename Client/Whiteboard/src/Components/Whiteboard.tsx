import React , { useEffect,useRef } from "react"
import fabric from "fabric"
import { io } from "socket.io-client" 

function Whiteboard() {

   const canvasRef = useRef<fabric.Canvas | null> (null);

   useEffect(() => {
        const canvas = new fabric.Canvas("canvas", {
             isDrawingMode: true,
            backgroundColor: "white",
            width: window.innerWidth,
             height: window.innerHeight,
        })
        canvasRef.current = canvas


   })



  return (
    <div className="bg-amber-500">Whiteboard</div>
  )
}

export default Whiteboard