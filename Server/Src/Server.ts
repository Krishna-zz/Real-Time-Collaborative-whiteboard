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

// optional: assign colors for cursors
const userColors: Record<string, string> = {};
const COLORS = ["#ff3b30", "#ff9500", "#ffcc00", "#34c759", "#00c7ff", "#007aff", "#5856d6", "#af52de"];
function pickColor(id: string) {
  const i = Math.abs(Array.from(id).reduce((s, c) => s + c.charCodeAt(0), 0)) % COLORS.length;
  return COLORS[i];
}

io.on("connection", (socket) => {
  console.log("🟢 User connected:", socket.id);
  userColors[socket.id] = pickColor(socket.id);
  // inform user of assigned color if they want it
  socket.emit("cursor:assignColor", userColors[socket.id]);

  // cursor movement -> broadcast to others
  socket.on("cursor:move", (pos) => {
    socket.broadcast.emit("cursor:update", {
      socketId: socket.id,
      x: pos.x,
      y: pos.y,
      color: userColors[socket.id],
    });
  });

  socket.on("stroke:start", (payload) => {
    // broadcast to others: start a new stroke
    socket.broadcast.emit("stroke:start", payload);
  });
  socket.on("stroke:move", (payload) => {
    socket.broadcast.emit("stroke:move", payload);
  });
  socket.on("stroke:end", (payload) => {
    socket.broadcast.emit("stroke:end", payload);
  });

  // shape lifecycle
  socket.on("shape:start", (payload) => {
    socket.broadcast.emit("shape:start", payload);
  });
  socket.on("shape:update", (payload) => {
    socket.broadcast.emit("shape:update", payload);
  });
  socket.on("shape:end", (payload) => {
    socket.broadcast.emit("shape:end", payload);
  });

  // object modifications/deletes
  socket.on("object:modified", (payload) => {
    socket.broadcast.emit("object:modified", payload);
  });
  socket.on("object:removed", (payload) => {
    socket.broadcast.emit("object:removed", payload);
  });

  socket.on("disconnect", () => {
    console.log("🔴 User disconnected:", socket.id);
    delete userColors[socket.id];
    socket.broadcast.emit("cursor:remove", socket.id);
  });
});

const PORT = 5000;
server.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
