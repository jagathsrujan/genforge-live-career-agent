import { NextResponse } from "next/server";
import { errorResponse, jsonBody } from "@/lib/api";
import { makeId, nowIso, SourceSchema } from "@/lib/domain";
import { readWorkspace, writeWorkspace } from "@/lib/storage";
import { researchPublicUrl } from "@/lib/research/public";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await jsonBody(request);
    const url = String(body.url || "");
    if (!url) return NextResponse.json({ error: "needs_job_url", message: "Add a public job URL to continue. GenForge will not invent a job result." }, { status: 422 });
    const workspace = await readWorkspace(id);
    const sourceId = makeId("source");
    const observation = await researchPublicUrl(url);
    const source = SourceSchema.parse({ id: sourceId, kind: "job", label: body.label || "Target job page", url, excerpt: observation.reconciledText.slice(0, 6000), status: observation.reconciledText ? "ready" : "blocked", error: observation.reconciledText ? undefined : "No usable public text was found.", fetchedAt: nowIso(), createdAt: nowIso() });
    const job = {
      id: makeId("job"),
      companyId: undefined,
      title: String(body.title || "Target role from public job page"),
      companyName: String(body.companyName || "Company to confirm"),
      url,
      location: String(body.location || ""),
      employmentType: "",
      description: observation.reconciledText,
      requirements: [],
      sourceIds: [sourceId],
      status: "needs-analysis" as const,
      discoveredAt: nowIso(),
    };
    const next = await writeWorkspace({ ...workspace, sources: [...workspace.sources, source], jobs: [...workspace.jobs, job], activeJobId: job.id, updatedAt: nowIso() });
    return NextResponse.json({ workspace: next, job, source }, { status: 201 });
  } catch (error) {
    return errorResponse(error, 400);
  }
}
