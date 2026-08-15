#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import PDFDocument from "pdfkit";

const outputDirectory = path.join(process.cwd(), "artifacts", "synthetic");
const outputPath = path.join(outputDirectory, "sample-resume.pdf");
fs.mkdirSync(outputDirectory, { recursive: true });

const document = new PDFDocument({ size: "LETTER", margin: 54, info: { Title: "GenForge synthetic resume sample", Author: "GenForge" } });
const chunks = [];
document.on("data", (chunk) => chunks.push(chunk));
document.on("end", () => {
  fs.writeFileSync(outputPath, Buffer.concat(chunks), { mode: 0o644 });
  process.stdout.write(`Wrote ${path.relative(process.cwd(), outputPath)}\n`);
});

document.fillColor("#111827").font("Helvetica-Bold").fontSize(22).text("Maya Chen");
document.fillColor("#52606d").font("Helvetica-Oblique").fontSize(11).text("Frontend engineer building accessible product experiences");
document.font("Helvetica").fontSize(9).text("maya.chen@example.test  |  +1 415 555 0138  |  San Francisco, CA");
document.moveDown(0.8);

function section(title, body, bullets = []) {
  document.fillColor("#0f766e").font("Helvetica-Bold").fontSize(10).text(title.toUpperCase());
  document.moveDown(0.12).fillColor("#1f2937").font("Helvetica").fontSize(9.5);
  if (body) document.text(body, { lineGap: 2 });
  for (const bullet of bullets) document.text(`- ${bullet}`, { indent: 12, lineGap: 2 });
  document.moveDown(0.55);
}

section("Summary", "Frontend engineer focused on clear information architecture, accessible interaction patterns, and reliable delivery with React and TypeScript.");
section("Selected evidence", "Atlas study planner", [
  "Designed the information architecture for a React and TypeScript study planner.",
  "Implemented keyboard navigation and documented the testing approach.",
  "Translated source-backed project notes into a concise, reviewable narrative.",
]);
section("Skills", "TypeScript, React, Next.js, accessibility, testing, product collaboration");
section("Education", "B.S. Computer Science - University of Washington - 2024");

document.fillColor("#6b7280").fontSize(7.5).text("SYNTHETIC SAMPLE - NOT A REAL CANDIDATE OR RESUME", 54, 690, { align: "center", width: 504 });
document.end();
