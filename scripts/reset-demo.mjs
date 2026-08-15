#!/usr/bin/env node
const port = process.env.GENFORGE_PORT || "3000";
const baseUrl = `http://127.0.0.1:${port}`;

try {
  const response = await fetch(`${baseUrl}/api/workspaces`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode: "demo" }),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || "Could not create the demo workspace.");
  console.log(`Synthetic demo workspace ready: ${payload.workspace.id}`);
  console.log("Open the app and choose the new workspace from the browser local state if needed.");
} catch (error) {
  console.error(error instanceof Error ? error.message : "Could not reset the demo workspace.");
  console.error(`Start GenForge first with: GENFORGE_NO_OPEN=1 pnpm resume agent`);
  process.exitCode = 1;
}
