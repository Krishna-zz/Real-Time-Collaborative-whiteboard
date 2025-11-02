import React , { useEffect,useRef, useState } from "react"

import { io, Socket } from "socket.io-client" 

interface DrawData {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  color: string;
}

const socket: Socket = io("http://localhost:3001")

const Whiteboard: React.FC = () => {

   const canvasRef = useRef<HTMLCanvasElement | null>(null)
   const ctxRef = useRef<CanvasRenderingContext2D | null>(null)
   const [isDrawing, setIsDrawing] = useState(false)
   const [color , setColor] = useState("#000000")
   const [prevPos, setPrevPos] = useState<{x: number; y:number} | null>(null)


     useEffect(() => {
          const canvas = canvasRef.current!
          canvas.width = window.innerWidth * 0.8
          canvas.height = window.innerHeight * 0.8
          const ctx = canvas.getContext("2d")!
          ctx.lineCap = 'round'
          ctx.lineWidth = 3
          ctxRef.current = ctx

          socket.on("drawing", (data: DrawData) => {
               drawLine(data.x0, data.y0, data.x1, data.y1, data.color, false)
          })

          return() => {
               socket.off("drawing")
          }
     },[])

     const drawLine = (
           x0: number,
           y0: number,
           x1: number,
           y1: number,
           strokeColor: string,
           emit: boolean
     ) => {
          const ctx = ctxRef.current
          if(!ctx) return
          ctx.strokeStyle = strokeColor
          ctx.beginPath()
          ctx.moveTo(x0,y0)
          ctx.lineTo(x1, y1)
          ctx.stroke()
          ctx.closePath()

          if (emit) {
               socket.emit("drawing", {x0, y0, x1, y1, color:strokeColor})
          }
     }

     const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
          setIsDrawing(true)
          setPrevPos({x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY})
     }

     


  return (
    <div className="bg-amber-500">Whiteboard</div>
  )
}

export default Whiteboard