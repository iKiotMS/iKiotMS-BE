const { Server } = require('socket.io');

let io = null;

const initSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: ['http://localhost:3000', 'https://ikiot.vercel.app'],
      credentials: true,
    },
  });

  io.on('connection', (socket) => {
    // Client joins a room to listen for payment events
    // For subscription: room = "tenant:<tenantId>"
    // For order:        room = "order:<orderId>"
    socket.on('join', (room) => {
      socket.join(room);
    });

    socket.on('disconnect', () => {});
  });

  return io;
};

const emitToRoom = (room, event, data) => {
  if (io) io.to(room).emit(event, data);
};

module.exports = { initSocket, emitToRoom };
