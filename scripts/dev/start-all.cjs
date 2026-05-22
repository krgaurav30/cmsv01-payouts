const { spawn } = require("node:child_process");
const path = require("node:path");

const rootDir = path.resolve(__dirname, "..", "..");
const nodeBin = process.execPath;
const runnerPath = path.join(rootDir, "scripts", "dev", "run-service.cjs");
const serviceOrder = ["api", "bff", "worker", "corporate-web", "bank-ops-web"];

const children = [];
let shuttingDown = false;
let exitCode = 0;

for (const serviceName of serviceOrder) {
  const child = spawn(nodeBin, [runnerPath, serviceName], {
    cwd: rootDir,
    stdio: "inherit",
    env: process.env
  });

  children.push(child);

  child.on("exit", (code, signal) => {
    if (signal && !shuttingDown) {
      exitCode = 1;
      shutdown(signal);
      return;
    }

    if ((code ?? 0) !== 0 && !shuttingDown) {
      exitCode = code ?? 1;
      shutdown("SIGTERM");
    }
  });
}

function shutdown(signal) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;

  for (const child of children) {
    if (!child.killed) {
      child.kill(signal);
    }
  }

  setTimeout(() => {
    process.exit(exitCode);
  }, 250);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
