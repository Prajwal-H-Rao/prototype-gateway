export const setupSocketHandlers = (io) => {
  io.on("connection", (socket) => {
    console.log(`Client connected: ${socket.id}`);

    // Handle terminal input from client
    socket.on("input", (data) => {
      console.log(`Received input: ${data}`);
      // Process input as needed (e.g., execute commands, send to terminal)
      // For now, echo it back with output event
      socket.emit("output", `Processed: ${data}`);
    });

    // Handle client disconnect
    socket.on("disconnect", () => {
      console.log(`Client disconnected: ${socket.id}`);
    });

    // Handle errors
    socket.on("error", (error) => {
      console.error(`Socket error for ${socket.id}:`, error);
    });
  });
};
