import { NextResponse } from "next/server";
import { jsonBody, errorResponse } from "@/lib/api";
import { readWorkspace, writeWorkspace } from "@/lib/storage";
import { WorkspaceSchema, nowIso } from "@/lib/domain";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    return NextResponse.json({ workspace: await readWorkspace(id) });
  } catch (error) {
    return errorResponse(error, 404);
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await jsonBody(request);
    const current = await readWorkspace(id);
    const next = WorkspaceSchema.parse({ ...current, ...body, id: current.id, updatedAt: nowIso() });
    await writeWorkspace(next);
    return NextResponse.json({ workspace: next });
  } catch (error) {
    return errorResponse(error, 400);
  }
}
