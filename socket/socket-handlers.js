import { startDockerSandbox } from "./sandbox/docker-sandbox.js";

const SESSION_TIMEOUT_MS = 15 * 60 * 1000; // 15 min
const MAX_INPUT_BUFFER_BYTES = 64 * 1024; // guard against accidental unbounded buffering

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

  return data;
}

async function handleSocketConnection(socket) {
  console.log(`Client connected: ${socket.id}`);

  let sandbox = null;
  let timeoutId = null;
  let cleanedUp = false;
  let inputBuffer = "";

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

      // If a client wants line-buffered input, support it implicitly:
      // buffer until Enter, then send one full command line.
      // This also prevents the "one char per command" behavior when the UI appends "\r" per key.
      if (normalized.includes("\r") || normalized.includes("\n")) {
        const pieces = normalized.replaceAll("\n", "\r").split("\r");
        for (let i = 0; i < pieces.length; i++) {
          const part = pieces[i];
          inputBuffer += part;

          const isLineTerminator = i < pieces.length - 1;
          if (isLineTerminator) {
            sandbox.ioStream.write(inputBuffer + "\r");
            inputBuffer = "";
          }
        }
      } else {
        inputBuffer += normalized;
      }

      if (Buffer.byteLength(inputBuffer, "utf8") > MAX_INPUT_BUFFER_BYTES) {
        inputBuffer = "";
        sandbox.ioStream.write("\r");
      }
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
