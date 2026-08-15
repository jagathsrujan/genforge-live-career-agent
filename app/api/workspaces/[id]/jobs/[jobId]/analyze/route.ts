import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api";
import { JobOpportunity, PiJobAnalysisSchema, makeId, nowIso } from "@/lib/domain";
import { PiRpcClient } from "@/lib/agent/pi-rpc";
import { calculateMatchReport } from "@/lib/research/match";
import { readWorkspace, writeWorkspace } from "@/lib/storage";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string; jobId: string }> }) {
  try {
    const { id, jobId } = await params;
    if (!process.env.OPENCODE_API_KEY) return NextResponse.json({ error: "OPENCODE_API_KEY is required for live job analysis." }, { status: 412 });
    const workspace = await readWorkspace(id);
    const job = workspace.jobs.find((item) => item.id === jobId);
    if (!job) return NextResponse.json({ error: "Target job not found." }, { status: 404 });
    const client = new PiRpcClient();
    try {
      const analysis = await client.promptStructured(
        `Analyze this public job description. Do not invent details. Return JSON with shape {"title":string,"companyName":string,"location":string,"employmentType":string,"requirements":[{"text":string,"category":string,"priority":"required"|"preferred"|"contextual"}]}.\n\n${JSON.stringify({ title: job.title, companyName: job.companyName, description: job.description })}`,
        PiJobAnalysisSchema,
      );
      const updatedJob: JobOpportunity = {
        ...job,
        ...analysis,
        requirements: analysis.requirements.map((requirement) => ({ ...requirement, id: makeId("requirement"), jobId, status: "missing" as const, evidenceClaimIds: [], explanation: "Awaiting evidence mapping." })),
        status: "analyzed",
      };
      const report = calculateMatchReport(updatedJob, workspace.claims);
      const next = await writeWorkspace({ ...workspace, jobs: workspace.jobs.map((item) => item.id === jobId ? updatedJob : item), matchReports: [...workspace.matchReports.filter((item) => item.jobId !== jobId), report], updatedAt: nowIso() });
      return NextResponse.json({ workspace: next, job: updatedJob, matchReport: report });
    } finally {
      await client.close();
    }
  } catch (error) {
    return errorResponse(error, 400);
  }
}
