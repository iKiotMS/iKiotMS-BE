const { Server } = require("socket.io");

let io = null;

const initSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: ["http://localhost:3000", process.env.FRONTEND_URL],
      credentials: true,
    },
  });

  io.on("connection", (socket) => {
    console.log(`[Socket] client connected: ${socket.id}`);

    socket.on("join", (room) => {
      socket.join(room);
      console.log(`[Socket] ${socket.id} joined room: ${room}`);
    });

    socket.on("disconnect", (reason) => {
      console.log(
        `[Socket] client disconnected: ${socket.id} reason: ${reason}`,
      );
    });
  });

  return io;
};

const emitToRoom = (room, event, data) => {
  if (io) {
    const count = io.sockets.adapter.rooms.get(room)?.size ?? 0;
    console.log(
      `[Socket] emit "${event}" → room "${room}" (${count} client${count !== 1 ? "s" : ""})`,
    );
    io.to(room).emit(event, data);
  }
};

module.exports = { initSocket, emitToRoom };
