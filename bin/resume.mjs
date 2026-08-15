#!/usr/bin/env node
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";

const command = process.argv[2];
const port = Number(process.env.GENFORGE_PORT || "3000");
const host = process.env.GENFORGE_HOST || "127.0.0.1";
const textModel = process.env.GENFORGE_PI_MODEL || "opencode/deepseek-v4-flash-free";
const imageModel = process.env.GENFORGE_PI_IMAGE_MODEL || "opencode/mimo-v2.5-free";
const dataDir = process.env.GENFORGE_DATA_DIR?.trim() || path.join(os.homedir(), "Library", "Application Support", "GenForge");

function hasCommand(name) {
  const result = spawnSync(process.platform === "win32" ? "where" : "which", [name], { stdio: "ignore" });
  return result.status === 0;
}

function printUsage() {
  console.error("Usage: resume agent | resume check");
}

function checkRuntime() {
  const nodeVersion = process.versions.node.split(".").map(Number);
  const nodeOkay = nodeVersion[0] >= 20 && nodeVersion[0] < 23 && (nodeVersion[0] > 20 || nodeVersion[1] >= 11);
  const piAvailable = hasCommand(process.env.GENFORGE_PI_BIN || "pi");
  const playwrightCheck = spawnSync(process.execPath, ["-e", "import('playwright').then(() => process.exit(0)).catch(() => process.exit(1))"], { stdio: "ignore" });
  const playwrightAvailable = playwrightCheck.status === 0;
  const keyConfigured = Boolean(process.env.OPENCODE_API_KEY?.trim());
  console.log(`Node: ${process.versions.node} ${nodeOkay ? "(supported)" : "(requires Node 20.11 through 22.x)"}`);
  console.log(`Pi: ${piAvailable ? "available" : "not found; live runs will be unavailable"}`);
  console.log(`Playwright: ${playwrightAvailable ? "available" : "not found; public browser research will be unavailable"}`);
  console.log(`Text model: ${textModel}`);
  console.log(`Image model: ${imageModel}`);
  console.log(`OpenCode key: ${keyConfigured ? "configured" : "not configured; synthetic UI mode is still available"}`);
  console.log(`Local data directory: ${dataDir}`);
  return nodeOkay;
}

function portIsBusy(portNumber, hostName) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ port: portNumber, host: hostName });
    const finish = (busy) => {
      socket.destroy();
      resolve(busy);
    };
    socket.once("connect", () => finish(true));
    socket.once("error", () => finish(false));
    socket.setTimeout(400, () => finish(false));
  });
}

if (command === "check") {
  process.exitCode = checkRuntime() ? 0 : 1;
} else if (command === "agent") {
  if (!checkRuntime()) {
    console.error("GenForge needs a supported Node.js version before it can start.");
    process.exit(1);
  }
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    console.error(`Invalid GENFORGE_PORT: ${process.env.GENFORGE_PORT}`);
    process.exit(1);
  }
  if (await portIsBusy(port, host)) {
    console.error(`Port ${port} is already in use on ${host}.`);
    console.error(`Stop the existing process or run: GENFORGE_PORT=${port + 1} pnpm resume agent`);
    process.exit(1);
  }
  const packageRunner = hasCommand("pnpm") ? "pnpm" : "npm";
  const serverArgs = packageRunner === "pnpm"
    ? ["next", "dev", "--hostname", host, "--port", String(port)]
    : ["exec", "--", "next", "dev", "--hostname", host, "--port", String(port)];
  const server = spawn(packageRunner, serverArgs, {
    stdio: "inherit",
    env: { ...process.env, GENFORGE_PORT: String(port), GENFORGE_HOST: host },
  });
  let opened = false;
  const openBrowser = () => {
    if (opened || process.env.GENFORGE_NO_OPEN === "1") return;
    opened = true;
    const url = `http://${host}:${port}`;
    if (process.platform === "darwin") spawn("open", [url], { stdio: "ignore" });
    else if (process.platform === "win32") spawn("cmd", ["/c", "start", url], { stdio: "ignore" });
    else spawn("xdg-open", [url], { stdio: "ignore" });
  };
  const timer = setTimeout(openBrowser, 1800);
  server.on("error", (error) => {
    clearTimeout(timer);
    console.error(`Could not start the local server: ${error instanceof Error ? error.message : "unknown error"}`);
    process.exitCode = 1;
  });
  server.on("exit", (code) => {
    clearTimeout(timer);
    process.exit(code ?? 0);
  });
  process.on("SIGINT", () => server.kill("SIGINT"));
  process.on("SIGTERM", () => server.kill("SIGTERM"));
} else {
  printUsage();
  process.exitCode = 1;
}
