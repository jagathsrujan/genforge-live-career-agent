import { NextResponse } from "next/server";
import path from "node:path";
import { errorResponse } from "@/lib/api";
import { makeId, SourceKindSchema, SourceSchema, nowIso } from "@/lib/domain";
import { MAX_ATTACHMENT_BYTES, readWorkspace, saveAttachment, writeWorkspace } from "@/lib/storage";
import { assertSafePublicUrlAsync } from "@/lib/research/safe-url";

const allowedExtensions = new Set([".pdf", ".docx", ".txt", ".md", ".markdown", ".json", ".csv", ".png", ".jpg", ".jpeg", ".webp", ".svg"]);
const allowedMimeTypes = new Set(["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "text/plain", "text/markdown", "application/json", "text/csv", "image/png", "image/jpeg", "image/webp", "image/svg+xml"]);

function assertSafeUpload(file: File) {
  if (file.size > MAX_ATTACHMENT_BYTES) throw new Error("Attachments must be 10 MB or smaller.");
  const extension = path.extname(file.name).toLowerCase();
  if (!allowedExtensions.has(extension)) throw new Error("This file type is not supported.");
  if (file.type && !allowedMimeTypes.has(file.type)) throw new Error("This file MIME type is not supported.");
  if (file.name.length > 200) throw new Error("The file name is too long.");
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const workspace = await readWorkspace(id);
    const contentType = request.headers.get("content-type") || "";
    let kind = "other";
    let label = "Untitled source";
    let url = "";
    let fileName = "";
    let mimeType = "";
    let localPath = "";
    let sizeBytes = 0;
    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      kind = String(form.get("kind") || "other");
      label = String(form.get("label") || form.get("fileName") || "Uploaded source");
      url = String(form.get("url") || "");
      const file = form.get("file");
      if (file instanceof File && file.size > 0) {
        assertSafeUpload(file);
        fileName = file.name;
        mimeType = file.type;
        sizeBytes = file.size;
        localPath = await saveAttachment(id, file.name, new Uint8Array(await file.arrayBuffer()));
      }
    } else {
      const body = await request.json();
      kind = String(body.kind || "other");
      label = String(body.label || body.url || "Public source");
      url = String(body.url || "");
      fileName = String(body.fileName || "");
      mimeType = String(body.mimeType || "");
    }
    if (url) await assertSafePublicUrlAsync(url);
    const source = SourceSchema.parse({
      id: makeId("source"),
      kind: SourceKindSchema.parse(kind),
      label,
      url: url || undefined,
      fileName: fileName || undefined,
      mimeType: mimeType || undefined,
      localPath: localPath || undefined,
      sizeBytes: sizeBytes || undefined,
      extractionStatus: localPath ? "pending" : "skipped",
      status: "pending",
      createdAt: nowIso(),
    });
    const next = await writeWorkspace({ ...workspace, sources: [...workspace.sources, source], updatedAt: nowIso() });
    return NextResponse.json({ workspace: next, source }, { status: 201 });
  } catch (error) {
    return errorResponse(error, 400);
  }
}
