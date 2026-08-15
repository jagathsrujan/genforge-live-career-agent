import { spawnSync } from "node:child_process";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function commandAvailable(command: string) {
  const result = spawnSync(process.platform === "win32" ? "where" : "which", [command], { stdio: "ignore" });
  return result.status === 0;
}

export async function GET() {
  const piAvailable = commandAvailable(process.env.GENFORGE_PI_BIN || "pi");
  const providerConfigured = Boolean(process.env.OPENCODE_API_KEY?.trim());
  let playwrightAvailable = true;
  try {
    await import("playwright");
  } catch {
    playwrightAvailable = false;
  }
  return NextResponse.json({
    status: piAvailable && playwrightAvailable && providerConfigured ? "ready" : "degraded",
    localOnly: true,
    piAvailable,
    playwrightAvailable,
    providerConfigured,
    models: {
      text: process.env.GENFORGE_PI_MODEL || "opencode/deepseek-v4-flash-free",
      image: process.env.GENFORGE_PI_IMAGE_MODEL || "opencode/mimo-v2.5-free",
    },
  }, { headers: { "Cache-Control": "no-store" } });
}
