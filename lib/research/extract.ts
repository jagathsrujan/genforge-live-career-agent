import fs from "node:fs/promises";
import path from "node:path";
import { Source } from "../domain";

const MAX_TEXT = 24_000;

export type LocalExtraction = { text?: string; image?: { mimeType: string; data: string } };

export async function extractLocalSource(source: Source): Promise<LocalExtraction> {
  if (!source.localPath) return {};
  const bytes = await fs.readFile(source.localPath);
  const extension = path.extname(source.fileName || source.localPath).toLowerCase();
  const mimeType = source.mimeType || "";
  if (mimeType.startsWith("image/") || [".png", ".jpg", ".jpeg", ".webp", ".svg"].includes(extension)) {
    const inferredMime = extension === ".svg" ? "image/svg+xml" : `image/${extension.slice(1) === "jpg" ? "jpeg" : extension.slice(1)}`;
    return { image: { mimeType: mimeType || inferredMime, data: bytes.toString("base64") } };
  }
  if ([".txt", ".md", ".markdown", ".json", ".csv"].includes(extension) || mimeType.startsWith("text/")) {
    return { text: bytes.toString("utf8").slice(0, MAX_TEXT) };
  }
  if (extension === ".pdf" || mimeType === "application/pdf") {
    const module = await import("pdf-parse");
    const parse = (module as unknown as { default?: (input: Buffer) => Promise<{ text: string }> }).default || (module as unknown as (input: Buffer) => Promise<{ text: string }>);
    const result = await parse(bytes);
    return { text: result.text.slice(0, MAX_TEXT) };
  }
  if (extension === ".docx" || mimeType.includes("wordprocessingml")) {
    const module = await import("mammoth");
    const result = await module.extractRawText({ buffer: bytes });
    return { text: result.value.slice(0, MAX_TEXT) };
  }
  return { text: bytes.toString("utf8").slice(0, MAX_TEXT) };
}
