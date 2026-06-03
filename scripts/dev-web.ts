import { spawn } from "node:child_process";
import { killPorts } from "./kill-port";

const PORT = 5000;
killPorts(PORT);

const child = spawn("bun", ["run", "--cwd", "apps/web", "dev"], {
  stdio: "inherit",
  shell: true,
});

process.on("SIGINT", () => {
  child.kill();
  process.exit(0);
});
