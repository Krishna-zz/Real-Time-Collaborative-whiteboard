// server/Server.ts
import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";

const app = express();
app.use(cors());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"]
  }
});

// Optional color assignment for cursors
const userColors: Record<string, string> = {};
const COLORS = ["#ff3b30", "#ff9500", "#ffcc00", "#34c759", "#00c7ff", "#007aff", "#5856d6", "#af52de"];

function pickColor(id: string) {
  const sum = Array.from(id).reduce((s, c) => s + c.charCodeAt(0), 0);
  return COLORS[Math.abs(sum) % COLORS.length];
}

io.on("connection", (socket) => {
  console.log("🟢 User connected:", socket.id);

  // Assign random color for the cursor
  const color = pickColor(socket.id);
  userColors[socket.id] = color;
  socket.emit("cursor:assignColor", color);

  // ---------------------------
  // REAL-TIME CURSOR UPDATES
  // ---------------------------
  socket.on("cursor:update", (pos) => {
    socket.broadcast.emit("cursor:update", {
      socketId: socket.id,
      x: pos.x,
      y: pos.y,
      color: color,
    });
  });

  // ---------------------------------
  // REAL-TIME STREAMING DRAWING
  // ---------------------------------

  // Starting a stroke
  socket.on("stroke:start", (data) => {
    socket.broadcast.emit("stroke:start", {
      ...data,
      color: data.color,
      width: data.width,
    });
  });

  // Moving pencil (live line segments)
  socket.on("stroke:move", (data) => {
    socket.broadcast.emit("stroke:move", data);
  });

  // Stroke finished
  socket.on("stroke:end", (data) => {
    socket.broadcast.emit("stroke:end", data);
  });

  // ---------------------------
  // DISCONNECT
  // ---------------------------
  socket.on("disconnect", () => {
    console.log("🔴 User disconnected:", socket.id);
    delete userColors[socket.id];
    socket.broadcast.emit("cursor:remove", socket.id);
  });
});

// -----------------------------------
const PORT = 5000;
server.listen(PORT, () =>
  console.log(`✅ Server running on port ${PORT}`)
);
