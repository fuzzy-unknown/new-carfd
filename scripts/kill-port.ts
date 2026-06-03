import { execSync } from "node:child_process";

function killPort(port: number): void {
  try {
    const result = execSync(
      `netstat -ano | findstr :${port} | findstr LISTENING`,
      { encoding: "utf-8" }
    );
    const pids = new Set(
      result
        .split("\n")
        .map((line) => line.trim().split(/\s+/).pop())
        .filter((pid): pid is string => pid !== undefined && pid !== "")
    );
    for (const pid of pids) {
      try {
        execSync(`taskkill /PID ${pid} /F`, { stdio: "ignore" });
        console.log(`Killed process ${pid} on port ${port}`);
      } catch {
        // process may have already exited
      }
    }
  } catch {
    // no process on this port
  }
}

export function killPorts(...ports: number[]): void {
  for (const port of ports) {
    killPort(port);
  }
}
