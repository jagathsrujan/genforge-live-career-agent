import { AgentRun, Workspace, nowIso } from "../domain";
import { appendRunEvent } from "../run-store";
import { readWorkspace, writeWorkspace } from "../storage";
import { makeEvent, runLiveWorkflow } from "./orchestrator";

const runControllers = new Map<string, AbortController>();

export function cancelRun(runId: string) {
  const controller = runControllers.get(runId);
  if (!controller) return false;
  controller.abort();
  return true;
}

async function setRunStatus(workspace: Workspace, runId: string, status: AgentRun["status"], error?: string) {
  const next = {
    ...workspace,
    updatedAt: nowIso(),
    agentRuns: workspace.agentRuns.map((run) => run.id === runId ? { ...run, status, error, completedAt: status === "completed" || status === "failed" || status === "cancelled" ? nowIso() : run.completedAt } : run),
  };
  return writeWorkspace(next);
}

export async function executeRun(workspaceId: string, runId: string) {
  const controller = new AbortController();
  runControllers.set(runId, controller);
  let workspace = await readWorkspace(workspaceId);
  workspace = await setRunStatus(workspace, runId, "running");
  const writeEvent = async (input: Parameters<typeof makeEvent>[1]) => {
    const event = makeEvent(runId, input);
    const latest = await readWorkspace(workspaceId);
    const next = {
      ...latest,
      updatedAt: nowIso(),
      agentRuns: latest.agentRuns.map((run) => run.id === runId ? { ...run, events: [...run.events, event] } : run),
    };
    await writeWorkspace(next);
    await appendRunEvent(event);
  };

  try {
    const result = await runLiveWorkflow(workspace, writeEvent, controller.signal);
    const latest = await readWorkspace(workspaceId);
    const merged = {
      ...latest,
      ...result,
      agentRuns: latest.agentRuns,
      updatedAt: nowIso(),
    };
    await writeWorkspace(merged);
    await writeEvent({ type: "run.completed", message: "Live run completed; review evidence before generating a resume", severity: "success" });
    const finished = await readWorkspace(workspaceId);
    await setRunStatus(finished, runId, "completed");
  } catch (error) {
    const cancelled = controller.signal.aborted;
    await writeEvent({ type: cancelled ? "run.cancelled" : "run.failed", message: cancelled ? "Live run cancelled by the user" : error instanceof Error ? error.message : "Live run failed", severity: cancelled ? "warning" : "error" });
    const afterEvent = await readWorkspace(workspaceId);
    await setRunStatus(afterEvent, runId, cancelled ? "cancelled" : "failed", cancelled ? "Run cancelled by the user." : error instanceof Error ? error.message : "Live run failed");
  } finally {
    runControllers.delete(runId);
  }
}
