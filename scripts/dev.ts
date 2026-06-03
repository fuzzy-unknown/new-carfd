import { spawn } from "node:child_process";
import { killPorts } from "./kill-port";

const SERVER_PORT = 5001;
const WEB_PORT = 5000;

killPorts(SERVER_PORT, WEB_PORT);

const server = spawn("bun", ["run", "--cwd", "apps/server", "dev"], {
  stdio: "inherit",
  shell: true,
});

const web = spawn("bun", ["run", "--cwd", "apps/web", "dev"], {
  stdio: "inherit",
  shell: true,
});

function cleanup() {
  server.kill();
  web.kill();
  process.exit(0);
}

process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);
