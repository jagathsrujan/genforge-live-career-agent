import PDFDocument from "pdfkit";
import { Document, HeadingLevel, Packer, Paragraph, TextRun } from "docx";
import { AtsReport, ResumeSection, ResumeVersion, Workspace, nowIso } from "./domain";

function includedSections(resume: ResumeVersion) {
  return resume.sections.filter((section) => section.body.trim() || section.bullets.some((bullet) => bullet.included));
}

export function resumePlainText(resume: ResumeVersion, workspace: Workspace) {
  const lines = [
    workspace.candidate.fullName,
    workspace.candidate.headline,
    [workspace.candidate.email, workspace.candidate.phone, workspace.candidate.location, workspace.candidate.website].filter(Boolean).join(" · "),
    "",
  ];
  for (const section of includedSections(resume)) {
    lines.push(section.title.toUpperCase());
    if (section.body.trim()) lines.push(section.body.trim());
    for (const bullet of section.bullets.filter((item) => item.included)) lines.push(`• ${bullet.text}`);
    lines.push("");
  }
  return lines.join("\n").trim() + "\n";
}

export function resumeMarkdown(resume: ResumeVersion, workspace: Workspace) {
  const lines = [
    `# ${workspace.candidate.fullName}`,
    `**${workspace.candidate.headline}**`,
    [workspace.candidate.email, workspace.candidate.phone, workspace.candidate.location, workspace.candidate.website].filter(Boolean).join(" · "),
    "",
  ];
  for (const section of includedSections(resume)) {
    lines.push(`## ${section.title}`);
    if (section.body.trim()) lines.push(section.body.trim());
    for (const bullet of section.bullets.filter((item) => item.included)) lines.push(`- ${bullet.text}`);
    lines.push("");
  }
  return lines.join("\n").trim() + "\n";
}

export function validateResume(resume: ResumeVersion, workspace: Workspace): AtsReport {
  const text = resumePlainText(resume, workspace);
  const lower = text.toLowerCase();
  const sections = includedSections(resume);
  const requiredSection = (names: string[]) => sections.some((section) => names.includes(section.title.toLowerCase()));
  const checks: AtsReport["checks"] = [
    { id: "contact", label: "Contact information", status: workspace.candidate.fullName && workspace.candidate.email ? "pass" : "fail", detail: workspace.candidate.fullName && workspace.candidate.email ? "Name and email are present." : "Add a name and email before exporting." },
    { id: "headings", label: "Heading structure", status: sections.length >= 2 ? "pass" : "warn", detail: `${sections.length} populated section${sections.length === 1 ? "" : "s"} found.` },
    { id: "plain-text", label: "Plain-text extraction", status: text.length > 80 ? "pass" : "fail", detail: `${text.length} characters are available to ATS readers.` },
    { id: "required-sections", label: "Core sections", status: requiredSection(["summary", "experience", "selected evidence", "projects", "skills"]) ? "pass" : "warn", detail: "At least one career-content section should be present." },
    { id: "page-count", label: "Page length estimate", status: text.split("\n").length <= 70 ? "pass" : "warn", detail: `${Math.max(1, Math.ceil(text.split("\n").length / 55))} page estimate from plain text.` },
    { id: "dates", label: "Date consistency", status: /\b(19|20)\d{2}\b/.test(text) || !/\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b/i.test(text) ? "pass" : "warn", detail: "Dates are checked deterministically from the visible text." },
  ];
  const approvedClaimIds = new Set(workspace.claims.filter((claim) => claim.status === "approved" && claim.includeInResume).map((claim) => claim.id));
  const unsupportedClaimIds = resume.sections.flatMap((section) => section.bullets.filter((bullet) => bullet.included && bullet.claimIds.some((claimId) => !approvedClaimIds.has(claimId))).map((bullet) => bullet.claimIds)).flat();
  checks.push({ id: "unsupported", label: "Evidence support", status: unsupportedClaimIds.length ? "fail" : "pass", detail: unsupportedClaimIds.length ? `${unsupportedClaimIds.length} included claim link${unsupportedClaimIds.length === 1 ? "" : "s"} need approval.` : "Every included evidence bullet links to approved claims." });

  const words = lower.split(/[^a-z0-9+#.-]+/).filter(Boolean);
  const repeats = words.filter((word, index) => words.indexOf(word) !== index && word.length > 4);
  checks.push({ id: "repetition", label: "Keyword repetition", status: repeats.length > 12 ? "warn" : "pass", detail: repeats.length > 12 ? "Some words repeat unusually often." : "No excessive repeated keyword pattern detected." });
  const passed = checks.every((check) => check.status !== "fail");
  return {
    passed,
    checks,
    keywordCoverage: workspace.activeJobId ? Math.min(100, Math.round((workspace.matchReports.find((report) => report.jobId === workspace.activeJobId)?.coveragePercent || 0))) : 0,
    unsupportedClaimIds,
    updatedAt: nowIso(),
  };
}

function asParagraphs(resume: ResumeVersion, workspace: Workspace) {
  const paragraphs: Paragraph[] = [
    new Paragraph({ children: [new TextRun({ text: workspace.candidate.fullName, bold: true, size: 32 })] }),
    new Paragraph({ children: [new TextRun({ text: workspace.candidate.headline, italics: true, size: 21 })] }),
    new Paragraph({ text: [workspace.candidate.email, workspace.candidate.phone, workspace.candidate.location, workspace.candidate.website].filter(Boolean).join(" · ") }),
  ];
  for (const section of includedSections(resume)) {
    paragraphs.push(new Paragraph({ text: section.title, heading: HeadingLevel.HEADING_2, spacing: { before: 180, after: 70 } }));
    if (section.body.trim()) paragraphs.push(new Paragraph({ text: section.body.trim() }));
    for (const bullet of section.bullets.filter((item) => item.included)) paragraphs.push(new Paragraph({ text: bullet.text, bullet: { level: 0 } }));
  }
  return paragraphs;
}

export async function resumeDocx(resume: ResumeVersion, workspace: Workspace) {
  const document = new Document({ sections: [{ properties: {}, children: asParagraphs(resume, workspace) }] });
  return Packer.toBuffer(document);
}

export async function resumePdf(resume: ResumeVersion, workspace: Workspace) {
  const document = new PDFDocument({ size: "LETTER", margin: 54 });
  const chunks: Buffer[] = [];
  document.on("data", (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve) => document.on("end", () => resolve(Buffer.concat(chunks))));
  document.fontSize(22).font("Helvetica-Bold").text(workspace.candidate.fullName || "Untitled candidate");
  document.moveDown(0.2).fontSize(11).font("Helvetica-Oblique").text(workspace.candidate.headline);
  document.moveDown(0.2).font("Helvetica").text([workspace.candidate.email, workspace.candidate.phone, workspace.candidate.location, workspace.candidate.website].filter(Boolean).join(" · "));
  for (const section of includedSections(resume)) {
    document.moveDown(0.7).fontSize(12).font("Helvetica-Bold").text(section.title.toUpperCase());
    document.moveDown(0.15).fontSize(10).font("Helvetica");
    if (section.body.trim()) document.text(section.body.trim(), { lineGap: 2 });
    for (const bullet of section.bullets.filter((item) => item.included)) document.text(`• ${bullet.text}`, { indent: 12, lineGap: 2 });
  }
  document.end();
  return done;
}

export function exportContent(format: string, resume: ResumeVersion, workspace: Workspace) {
  if (format === "md") return { body: resumeMarkdown(resume, workspace), contentType: "text/markdown", extension: "md" };
  if (format === "txt") return { body: resumePlainText(resume, workspace), contentType: "text/plain", extension: "txt" };
  return null;
}
