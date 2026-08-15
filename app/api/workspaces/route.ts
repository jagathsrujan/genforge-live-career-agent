import { NextResponse } from "next/server";
import { jsonBody, errorResponse } from "@/lib/api";
import { createWorkspace } from "@/lib/demo";
import { listWorkspaces, writeWorkspace } from "@/lib/storage";

export async function GET() {
  try {
    return NextResponse.json({ workspaces: await listWorkspaces() });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await jsonBody(request);
    const mode = body.mode === "demo" ? "demo" : "blank";
    const workspace = await writeWorkspace(createWorkspace(mode));
    return NextResponse.json({ workspace }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
