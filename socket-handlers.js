export const setupSocketHandlers = (io) => {
  io.on("connection", (socket) => {
    console.log(`Client connected: ${socket.id}`);

    let commandBuffer = "";

    // Handle terminal input from client
    socket.on("input", (data) => {
      commandBuffer += data;

      // Check if a complete command was received (contains newline/Enter)
      if (commandBuffer.includes("\n") || commandBuffer.includes("\r")) {
        const command = commandBuffer.trim();
        console.log(`Complete command received: ${command}`);

        // Process command and send response only when complete
        socket.emit("output", `Processed: ${command}\n`);

        // Reset buffer for next command
        commandBuffer = "";
      }
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
