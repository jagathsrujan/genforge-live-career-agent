import fs from "node:fs/promises";
import path from "node:path";
import { AgentRunEvent, AgentRunEventSchema } from "./domain";
import { getDataDir, ensureDataDirs, redactLogText } from "./storage";

function runPath(runId: string) {
  return path.join(getDataDir(), "runs", `${runId}.jsonl`);
}

export async function appendRunEvent(event: AgentRunEvent) {
  await ensureDataDirs();
  const safeEvent = {
    ...event,
    message: redactLogText(event.message).slice(0, 600),
    metadata: event.metadata ? Object.fromEntries(Object.entries(event.metadata).map(([key, value]) => [key, redactLogText(value).slice(0, 300)])) : undefined,
  };
  await fs.appendFile(runPath(event.runId), `${JSON.stringify(safeEvent)}\n`, { encoding: "utf8", mode: 0o600 });
}

export async function readRunEvents(runId: string) {
  try {
    const raw = await fs.readFile(runPath(runId), "utf8");
    return raw.split("\n").filter(Boolean).flatMap((line) => {
      try {
        return [AgentRunEventSchema.parse(JSON.parse(line))];
      } catch {
        return [];
      }
    });
  } catch {
    return [];
  }
}
