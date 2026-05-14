import { startDockerSandbox } from "./sandbox/docker-sandbox.js";

const SESSION_TIMEOUT_MS = 15 * 60 * 1000; // 15 min
export const setupSocketHandlers = (io) => {
  io.on("connection", (socket) => {
    void handleSocketConnection(socket);
  });
};

function normalizeTerminalInput(raw) {
  if (raw == null) return "";

  // Socket.IO typically delivers strings; allow Buffers too.
  let data = Buffer.isBuffer(raw) ? raw.toString("utf8") : String(raw);

  // Normalize Windows-style newlines to a single carriage return for the TTY.
  data = data.replaceAll("\r\n", "\r");

  // Some UIs mistakenly append Enter to every keystroke (e.g. "l\r").
  // If it's exactly one non-newline char plus a newline, drop the newline.
  if (data.length === 2 && data[0] !== "\r" && data[0] !== "\n" && (data[1] === "\r" || data[1] === "\n")) {
    return data[0];
  }

  // If a UI uses xterm's `onKey`, it may send literal key names.
  // Map the common ones to real control sequences.
  switch (data) {
    case "Enter":
      return "\r";
    case "Backspace":
      return "\u007f";
    case "Tab":
      return "\t";
    case "Escape":
      return "\u001b";
    case "ArrowUp":
      return "\u001b[A";
    case "ArrowDown":
      return "\u001b[B";
    case "ArrowRight":
      return "\u001b[C";
    case "ArrowLeft":
      return "\u001b[D";
    default:
      break;
  }

  return data;
}

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

    // Stream terminal output to client (TTY stream combines stdout/stderr)
    sandbox.ioStream.on("data", (data) => {
      if (!socket.disconnected) socket.emit("output", data.toString());
    });

    // Forward terminal input to the shell
    socket.on("input", (data) => {
      if (!sandbox) return;
      if (!sandbox.ioStream.writable) return;

      const normalized = normalizeTerminalInput(data);
      if (!normalized) return;

      sandbox.ioStream.write(normalized);
    });

    // Shell end/close (may not always fire reliably depending on Docker engine)
    const onShellEnd = async () => {
      if (!socket.disconnected) socket.emit("output", "\r\nSession ended\r\n");
      await cleanup("shell-end");
    };
    sandbox.ioStream.once("end", () => void onShellEnd());
    sandbox.ioStream.once("close", () => void onShellEnd());

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
