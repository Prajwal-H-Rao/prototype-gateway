import { createServer } from "http";
import { Server } from "socket.io";
import { setupSocketHandlers } from "./socket-handlers.js";

export const initializeSocketServer = (app) => {
  const httpServer = createServer(app);

  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  // Setup all socket event handlers
  setupSocketHandlers(io);

  return { httpServer, io };
};
