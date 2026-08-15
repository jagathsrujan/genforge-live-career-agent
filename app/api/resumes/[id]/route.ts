import { NextResponse } from "next/server";
import { errorResponse, jsonBody } from "@/lib/api";
import { ResumeVersionSchema, nowIso } from "@/lib/domain";
import { validateResume } from "@/lib/exporters";
import { listWorkspaces, writeWorkspace } from "@/lib/storage";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await jsonBody(request);
    const workspace = (await listWorkspaces()).find((item) => item.resumes.some((resume) => resume.id === id));
    if (!workspace) return NextResponse.json({ error: "Resume not found." }, { status: 404 });
    const current = workspace.resumes.find((resume) => resume.id === id)!;
    const candidate = ResumeVersionSchema.parse({ ...current, ...body.resume, id, workspaceId: workspace.id, updatedAt: nowIso() });
    const atsReport = validateResume(candidate, workspace);
    const resume = { ...candidate, atsReport, status: atsReport.passed ? "validated" as const : "draft" as const };
    const next = await writeWorkspace({ ...workspace, resumes: workspace.resumes.map((item) => item.id === id ? resume : item), updatedAt: nowIso() });
    return NextResponse.json({ workspace: next, resume });
  } catch (error) {
    return errorResponse(error, 400);
  }
}
