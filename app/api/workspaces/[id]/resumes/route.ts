import { NextResponse } from "next/server";
import { errorResponse, jsonBody } from "@/lib/api";
import { PiResumeDraftSchema, ResumeVersion, makeId, nowIso } from "@/lib/domain";
import { PiRpcClient } from "@/lib/agent/pi-rpc";
import { readWorkspace, writeWorkspace } from "@/lib/storage";
import { candidateForModel } from "@/lib/privacy/payload";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!process.env.OPENCODE_API_KEY) return NextResponse.json({ error: "OPENCODE_API_KEY is required for live resume drafting." }, { status: 412 });
    const body = await jsonBody(request);
    const workspace = await readWorkspace(id);
    const approved = workspace.claims.filter((claim) => claim.status === "approved" && claim.includeInResume);
    if (!approved.length) return NextResponse.json({ error: "Approve at least one evidence claim before drafting a resume." }, { status: 422 });
    const template = body.template === "editorial-minimal" ? "editorial-minimal" : "ats-classic";
    const client = new PiRpcClient();
    try {
      const draft = await client.promptStructured(
        `Draft a targeted resume only from the approved evidence below. Do not add facts, metrics, technologies, employers, or dates that are not present. Every bullet must retain claimIds and sourceIds from the supplied evidence. Return JSON with shape {"title":string,"summary":string,"sections":[{"title":string,"kind":"summary"|"experience"|"projects"|"skills"|"education"|"certifications"|"custom","body":string,"bullets":[{"text":string,"claimIds":string[],"sourceIds":string[]}]}]}.\n\nCANDIDATE:\n${JSON.stringify(candidateForModel(workspace.candidate))}\n\nAPPROVED EVIDENCE:\n${JSON.stringify(approved)}\n\nTARGET JOB:\n${JSON.stringify(workspace.jobs.find((job) => job.id === workspace.activeJobId) || null)}`,
        PiResumeDraftSchema,
      );
      const approvedIds = new Set(approved.map((claim) => claim.id));
      const resume: ResumeVersion = {
        id: makeId("resume"),
        workspaceId: id,
        title: draft.title,
        template,
        targetJobId: workspace.activeJobId,
        sections: draft.sections.map((section) => ({
          id: makeId("section"),
          title: section.title,
          kind: section.kind,
          body: section.body ?? "",
          bullets: (section.bullets ?? []).map((bullet) => {
            const claimIds = (bullet.claimIds ?? []).filter((claimId) => approvedIds.has(claimId));
            const sourceIds = (bullet.sourceIds ?? []).filter((sourceId) => workspace.sources.some((source) => source.id === sourceId));
            const valid = claimIds.length > 0 && sourceIds.length > 0;
            return { id: makeId("bullet"), text: bullet.text, claimIds, sourceIds, provenance: "agent-generated" as const, included: valid };
          }),
        })),
        status: "draft",
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      const next = await writeWorkspace({ ...workspace, resumes: [...workspace.resumes, resume], activeResumeId: resume.id, stage: "resume", updatedAt: nowIso() });
      return NextResponse.json({ workspace: next, resume }, { status: 201 });
    } finally {
      await client.close();
    }
  } catch (error) {
    return errorResponse(error, 400);
  }
}
