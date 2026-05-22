const { spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const rootDir = path.resolve(__dirname, "..", "..");
const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";

const services = {
  api: {
    command: process.execPath,
    args: [
      "--dns-result-order=ipv4first",
      "--watch",
      "--env-file=.env",
      "--import",
      "tsx",
      "apps/api/src/main.ts"
    ],
    env: {
      PORT: "3101"
    }
  },
  bff: {
    command: process.execPath,
    args: [
      "--dns-result-order=ipv4first",
      "--watch",
      "--env-file=.env",
      "--import",
      "tsx",
      "apps/bff/src/main.ts"
    ],
    env: {
      PORT: "3100",
      CORE_API_URL: "http://127.0.0.1:3101"
    }
  },
  worker: {
    command: process.execPath,
    args: [
      "--dns-result-order=ipv4first",
      "--watch",
      "--env-file=.env",
      "--import",
      "tsx",
      "apps/worker/src/main.ts"
    ],
    env: {
      PORT: "3102",
      API_URL: "http://127.0.0.1:3101"
    }
  },
  "corporate-web": {
    command: npmCmd,
    args: ["run", "dev", "--workspace", "corporate-web"],
    env: {
      BFF_URL: "http://127.0.0.1:3100",
      NEXT_PUBLIC_BANK_OPS_WEB_URL: "http://127.0.0.1:3002"
    }
  },
  "bank-ops-web": {
    command: npmCmd,
    args: ["run", "dev", "--workspace", "bank-ops-web"],
    env: {
      BFF_URL: "http://127.0.0.1:3100"
    }
  }
};

const serviceName = process.argv[2];
const config = serviceName ? services[serviceName] : null;

if (!config) {
  console.error(
    `Unknown service "${serviceName ?? ""}". Use one of: ${Object.keys(services).join(", ")}`
  );
  process.exit(1);
}

if (["api", "bff", "worker"].includes(serviceName)) {
  cleanupStaleCompiledFiles(rootDir, serviceName);
}

const spawnConfig =
  process.platform === "win32" && config.command === npmCmd
    ? {
        command: process.env.ComSpec || "cmd.exe",
        args: ["/d", "/s", "/c", [config.command, ...config.args].join(" ")]
      }
    : {
        command: config.command,
        args: config.args
      };

const child = spawn(spawnConfig.command, spawnConfig.args, {
  cwd: rootDir,
  stdio: "inherit",
  env: {
    ...process.env,
    ...config.env
  }
});

let shuttingDown = false;

function shutdown(signal) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  if (!child.killed) {
    child.kill(signal);
  }
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});

function cleanupStaleCompiledFiles(rootDir, serviceName) {
  const srcDirByService = {
    api: path.join(rootDir, "apps", "api", "src"),
    bff: path.join(rootDir, "apps", "bff", "src"),
    worker: path.join(rootDir, "apps", "worker", "src")
  };

  const targetDir = srcDirByService[serviceName];
  if (!targetDir || !fs.existsSync(targetDir)) {
    return;
  }

  walkAndDelete(targetDir);
}

function walkAndDelete(directory) {
  const entries = fs.readdirSync(directory, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      walkAndDelete(fullPath);
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    if (entry.name.endsWith(".js") || entry.name.endsWith(".d.ts")) {
      try {
        fs.unlinkSync(fullPath);
      } catch {}
    }
  }
}
