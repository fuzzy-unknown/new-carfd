import { spawn } from "node:child_process";
import { killPorts } from "./kill-port";

const PORT = 5001;
killPorts(PORT);

const child = spawn("bun", ["run", "--cwd", "apps/server", "dev"], {
  stdio: "inherit",
  shell: true,
});

process.on("SIGINT", () => {
  child.kill();
  process.exit(0);
});
