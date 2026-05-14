import { startDockerSandbox } from "./sandbox/docker-sandbox.js";

const SESSION_TIMEOUT_MS = 15 * 60 * 1000; // 15 min

export const setupSocketHandlers = (io) => {
  io.on("connection", (socket) => {
    void handleSocketConnection(socket);
  });
};

async function handleSocketConnection(socket) {
  console.log(`Client connected: ${socket.id}`);

  let sandbox = null;
  let timeoutId = null;
  let cleanedUp = false;

  const cleanup = async (reason) => {
    if (cleanedUp) return;
    cleanedUp = true;

    if (timeoutId) clearTimeout(timeoutId);

    try {
      if (sandbox) await sandbox.stop();
    } catch (err) {
      console.error(`Cleanup error for ${socket.id} (${reason}):`, err);
    } finally {
      sandbox = null;
    }
  };

  socket.once("disconnect", (reason) => {
    console.log(`Client disconnected: ${socket.id} (${reason})`);
    void cleanup("disconnect");
  });

  socket.on("error", (error) => {
    console.error(`Socket error for ${socket.id}:`, error);
  });

  try {
    sandbox = await startDockerSandbox({ image: "secure-web-ide" });

    // If the client disconnected while the sandbox was starting, stop immediately.
    if (cleanedUp || socket.disconnected) {
      await sandbox.stop();
      sandbox = null;
      return;
    }

    console.log(`Container started: ${sandbox.container.id}`);

    // Stream stdout/stderr to client
    sandbox.shellProcess.stdout.on("data", (data) => {
      if (!socket.disconnected) socket.emit("output", data.toString());
    });

    sandbox.shellProcess.stderr.on("data", (data) => {
      if (!socket.disconnected) socket.emit("output", data.toString());
    });

    // Forward terminal input to the shell
    socket.on("input", (data) => {
      if (!sandbox) return;
      if (sandbox.shellProcess.stdin.writable) {
        sandbox.shellProcess.stdin.write(data);
      }
    });

    // Shell exit
    sandbox.shellProcess.on("close", (code) => {
      if (!socket.disconnected) {
        socket.emit("output", `\r\nProcess exited with code ${code}\r\n`);
      }
      void cleanup("shell-close");
    });

    // Auto timeout
    timeoutId = setTimeout(async () => {
      try {
        if (!socket.disconnected) socket.emit("output", "\r\nSession expired\r\n");
      } finally {
        await cleanup("timeout");
        socket.disconnect(true);
      }
    }, SESSION_TIMEOUT_MS);
  } catch (err) {
    console.error(err);

    if (!socket.disconnected) {
      socket.emit("output", "\r\nFailed to create sandbox\r\n");
    }

    await cleanup("start-failed");
  }
}
