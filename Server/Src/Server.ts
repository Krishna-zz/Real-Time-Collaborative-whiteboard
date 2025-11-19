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

// Store cursor colors for connected users
const userColors: Record<string, string> = {};

function randomColor() {
  const colors = [
    "#ff3b30", "#ff9500", "#ffcc00", "#34c759",
    "#00c7ff", "#007aff", "#5856d6", "#af52de"
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}

io.on("connection", (socket) => {
  console.log("🟢 User connected:", socket.id);

  // Assign a color to the user
  userColors[socket.id] = randomColor();

  // Send the user's color to the frontend
  socket.emit("cursor:assignColor", userColors[socket.id]);

  // 🔵 Receive cursor position + send to others
  socket.on("cursor:move", (cursorData) => {
    io.emit("cursor:update", {
      socketId: socket.id,
      x: cursorData.x,
      y: cursorData.y,
      color: userColors[socket.id],
    });
  });

  // 🟡 Canvas updates (existing feature)
  socket.on("canvas:update", (data) => {
    socket.broadcast.emit("canvas:update", data);
  });

  // 🔴 Cleanup on disconnect
  socket.on("disconnect", () => {
    console.log("🔴 User disconnected:", socket.id);
    delete userColors[socket.id];

    io.emit("cursor:remove", socket.id);
  });
});

const PORT = 5000;
server.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
