import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createWorkspace } from "@/lib/demo";
import { readWorkspace, saveAttachment, writeWorkspace } from "@/lib/storage";

describe("local storage", () => {
  let dataDir = "";
  const previousDataDir = process.env.GENFORGE_DATA_DIR;

  beforeAll(async () => {
    dataDir = await fs.mkdtemp(path.join(os.tmpdir(), "genforge-storage-"));
    process.env.GENFORGE_DATA_DIR = dataDir;
  });

  afterAll(async () => {
    if (previousDataDir) process.env.GENFORGE_DATA_DIR = previousDataDir;
    else delete process.env.GENFORGE_DATA_DIR;
    await fs.rm(dataDir, { recursive: true, force: true });
  });

  it("reloads a versioned workspace after an atomic write", async () => {
    const workspace = createWorkspace("demo");
    await writeWorkspace(workspace);
    const loaded = await readWorkspace(workspace.id);
    expect(loaded.schemaVersion).toBe(1);
    expect(loaded.id).toBe(workspace.id);
    expect(loaded.sources[0].extractionStatus).toBe("ready");
  });

  it("stores bounded attachments with safe filenames", async () => {
    const workspace = createWorkspace("blank");
    const saved = await saveAttachment(workspace.id, "resume ../../synthetic.md", new TextEncoder().encode("synthetic"));
    expect(saved).toContain(path.join("attachments", workspace.id, "resume_.._.._synthetic.md"));
    const stat = await fs.stat(saved);
    expect(stat.isFile()).toBe(true);
  });
});
