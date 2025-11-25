import { Server } from "socket.io";

let io;
const userSockets = new Map();

export const initializeSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: process.env.FRONTEND_URL || "http://localhost:3000",
      methods: ["GET", "POST"],
      credentials: true
    }
  });

  io.on("connection", (socket) => {
    console.log(`🔌 Socket connected: ${socket.id}`);

    socket.on("authenticate", (data) => {
      const { userId, userRole } = data;
      
      if (userId) {
        userSockets.set(userId.toString(), socket.id);
        socket.userId = userId;
        socket.userRole = userRole;
        
        console.log(`✅ User authenticated: ${userId} (${userRole})`);
        
        socket.emit("authenticated", { 
          success: true, 
          userId, 
          userRole 
        });
      }
    });

    socket.on("disconnect", () => {
      if (socket.userId) {
        userSockets.delete(socket.userId.toString());
        console.log(`🔌 User disconnected: ${socket.userId}`);
      }
    });
  });

  return io;
};

export const getIO = () => {
  if (!io) {
    throw new Error("Socket.io not initialized!");
  }
  return io;
};

export const emitToUser = (userId, event, data) => {
  if (!io) {
    console.warn("Socket.io not initialized");
    return false;
  }

  const socketId = userSockets.get(userId.toString());
  
  if (socketId) {
    io.to(socketId).emit(event, data);
    console.log(`📤 Emitted '${event}' to user ${userId}`);
    return true;
  } else {
    console.log(`⚠️ User ${userId} not connected`);
    return false;
  }
};