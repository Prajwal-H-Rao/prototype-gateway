import { spawn } from "child_process";
import Dockerode from "dockerode";

const docker = new Dockerode();

function getSandboxContainerOptions({ image }) {
  return {
    Image: image,

    Tty: true,

    OpenStdin: true,
    AttachStdin: true,
    AttachStdout: true,
    AttachStderr: true,

    WorkingDir: "/tmp/session",
    User: "sandbox",

    Env: ["HOME=/tmp/session", "TERM=xterm-256color"],

    HostConfig: {
      AutoRemove: true,

      // Resource limits
      Memory: 512 * 1024 * 1024,
      MemorySwap: 512 * 1024 * 1024,
      NanoCPUs: 1_000_000_000,
      PidsLimit: 128,
      CpuShares: 512,

      // Security
      ReadonlyRootfs: true,
      CapDrop: ["ALL"],
      SecurityOpt: ["no-new-privileges:true"],

      // Writable tmp directory
      Tmpfs: {
        "/tmp/session": "rw,nosuid,nodev,size=512m",
      },

      // Internet allowed
      NetworkMode: "bridge",

      // Prevent container IPC
      IpcMode: "none",
    },
  };
}

function spawnInteractiveShell(containerId) {
  return spawn("docker", ["exec", "-i", containerId, "bash"], {
    stdio: ["pipe", "pipe", "pipe"],
  });
}

export async function startDockerSandbox({ image = "secure-web-ide" } = {}) {
  const container = await docker.createContainer(getSandboxContainerOptions({ image }));
  await container.start();

  const shellProcess = spawnInteractiveShell(container.id);

  let stopped = false;
  const stop = async () => {
    if (stopped) return;
    stopped = true;

    try {
      if (shellProcess && !shellProcess.killed) shellProcess.kill();
    } catch {
      // best effort
    }

    try {
      if (container) await container.kill();
    } catch {
      // best effort (AutoRemove may have already removed it)
    }
  };

  return { container, shellProcess, stop };
}

