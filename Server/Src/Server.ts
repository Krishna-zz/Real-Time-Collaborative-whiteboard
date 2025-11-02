import express from "express"
import http from "http"
import {Server} from "socket.io"
import cors from "cors"


const app = express()
app.use(cors())

const server = http.createServer(app)

const io = new Server(server, {
    cors: {
        origin: "http://localhost:5173",
        methods: ["GET", "POST"],
    }
})

io.on("connection", (socket) => {
    console.log("✅ User connected:", socket.id);

    socket.on("drawing", (data) => {
        socket.broadcast.emit("drawing", data)
    })
    
    socket.on("disconnect", () => {
        console.log("❌ User disconnected:", socket.id);
        
    })
})


server.listen(3001, () => console.log("🚀 Server running on port 3001"))