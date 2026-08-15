import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api";
import { exportContent, resumeDocx, resumePdf } from "@/lib/exporters";
import { listWorkspaces } from "@/lib/storage";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const format = new URL(request.url).searchParams.get("format") || "pdf";
    const workspace = (await listWorkspaces()).find((item) => item.resumes.some((resume) => resume.id === id));
    if (!workspace) return NextResponse.json({ error: "Resume not found." }, { status: 404 });
    const resume = workspace.resumes.find((item) => item.id === id)!;
    const baseName = resume.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "genforge-resume";
    const content = exportContent(format, resume, workspace);
    if (content) return new Response(content.body, { headers: { "Content-Type": `${content.contentType}; charset=utf-8`, "Content-Disposition": `attachment; filename="${baseName}.${content.extension}"` } });
    if (format === "docx") {
      const buffer = await resumeDocx(resume, workspace);
      return new Response(new Uint8Array(buffer), { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "Content-Disposition": `attachment; filename="${baseName}.docx"` } });
    }
    const buffer = await resumePdf(resume, workspace);
    return new Response(new Uint8Array(buffer), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${baseName}.pdf"` } });
  } catch (error) {
    return errorResponse(error, 400);
  }
}
