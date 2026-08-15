import { NextResponse } from "next/server";
import { errorResponse, jsonBody } from "@/lib/api";
import { nowIso } from "@/lib/domain";
import { listWorkspaces, writeWorkspace } from "@/lib/storage";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await jsonBody(request);
    const status = ["approved", "rejected", "needs-confirmation", "pending"].includes(body.status) ? body.status : "pending";
    const workspace = (await listWorkspaces()).find((item) => item.claims.some((claim) => claim.id === id));
    if (!workspace) return NextResponse.json({ error: "Evidence claim not found." }, { status: 404 });
    const next = await writeWorkspace({
      ...workspace,
      claims: workspace.claims.map((claim) => claim.id === id ? { ...claim, status, includeInResume: status === "approved", reviewedAt: nowIso() } : claim),
      updatedAt: nowIso(),
    });
    return NextResponse.json({ workspace: next });
  } catch (error) {
    return errorResponse(error, 400);
  }
}
