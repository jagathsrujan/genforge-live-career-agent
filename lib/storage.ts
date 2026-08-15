import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Workspace, WorkspaceSchema } from "./domain";

export const MAX_ATTACHMENT_BYTES = 10_000_000;
const workspaceWriteQueues = new Map<string, Promise<Workspace>>();

export function getDataDir() {
  return process.env.GENFORGE_DATA_DIR?.trim() || path.join(os.homedir(), "Library", "Application Support", "GenForge");
}

function workspacesDir() {
  return path.join(getDataDir(), "workspaces");
}

export async function ensureDataDirs() {
  await fs.mkdir(workspacesDir(), { recursive: true });
  await fs.mkdir(path.join(getDataDir(), "attachments"), { recursive: true });
  await fs.mkdir(path.join(getDataDir(), "runs"), { recursive: true });
  await fs.mkdir(path.join(getDataDir(), "exports"), { recursive: true });
}

function workspacePath(id: string) {
  return path.join(workspacesDir(), `${id}.json`);
}

function migrateWorkspace(input: unknown): Workspace {
  if (!input || typeof input !== "object") throw new Error("Workspace data must be an object.");
  const record = input as Record<string, unknown>;
  const version = typeof record.schemaVersion === "number" ? record.schemaVersion : 1;
  if (version > 1) throw new Error(`Workspace schema ${version} is newer than this app supports.`);
  // Version 1 is the first persisted schema. Keeping this boundary explicit makes
  // future migrations additive instead of silently overwriting user data.
  return WorkspaceSchema.parse({ ...record, schemaVersion: 1 });
}

export async function writeWorkspace(workspace: Workspace) {
  const parsed = migrateWorkspace(workspace);
  const target = workspacePath(parsed.id);
  const previous = workspaceWriteQueues.get(target) || Promise.resolve(parsed);
  const nextWrite = previous.catch(() => parsed).then(async () => {
    await ensureDataDirs();
    const temporary = `${target}.${process.pid}.${Date.now()}.${crypto.randomUUID()}.tmp`;
    try {
      await fs.writeFile(temporary, JSON.stringify(parsed, null, 2), { encoding: "utf8", mode: 0o600 });
      await fs.rename(temporary, target);
    } finally {
      await fs.rm(temporary, { force: true }).catch(() => undefined);
    }
    return parsed;
  });
  workspaceWriteQueues.set(target, nextWrite);
  try {
    return await nextWrite;
  } finally {
    if (workspaceWriteQueues.get(target) === nextWrite) workspaceWriteQueues.delete(target);
  }
}

export async function readWorkspace(id: string) {
  const raw = await fs.readFile(workspacePath(id), "utf8");
  return migrateWorkspace(JSON.parse(raw));
}

export async function listWorkspaces() {
  await ensureDataDirs();
  const files = await fs.readdir(workspacesDir());
  const workspaces: Workspace[] = [];
  for (const file of files.filter((entry) => entry.endsWith(".json"))) {
    try {
      const raw = await fs.readFile(path.join(workspacesDir(), file), "utf8");
      workspaces.push(migrateWorkspace(JSON.parse(raw)));
    } catch {
      // A malformed workspace should not prevent other local workspaces from loading.
    }
  }
  return workspaces.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function findWorkspaceContaining(predicate: (workspace: Workspace) => boolean) {
  const workspaces = await listWorkspaces();
  return workspaces.find(predicate);
}

export async function saveAttachment(id: string, fileName: string, bytes: Uint8Array) {
  if (bytes.byteLength > MAX_ATTACHMENT_BYTES) throw new Error("Attachment exceeds the 10 MB limit.");
  await ensureDataDirs();
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  if (!safeName || safeName === "." || safeName === "..") throw new Error("Attachment filename is not allowed.");
  const relativePath = path.join("attachments", id, safeName);
  const dataRoot = path.resolve(getDataDir());
  const absolutePath = path.resolve(dataRoot, relativePath);
  if (!absolutePath.startsWith(`${dataRoot}${path.sep}`)) throw new Error("Attachment path is not allowed.");
  const attachmentRoot = path.join(dataRoot, "attachments");
  const attachmentDirectory = path.dirname(absolutePath);
  await fs.mkdir(attachmentDirectory, { recursive: true });
  for (const directory of [dataRoot, attachmentRoot, attachmentDirectory]) {
    const stat = await fs.lstat(directory);
    if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error("Attachment path is not allowed.");
  }
  try {
    const existing = await fs.lstat(absolutePath);
    if (existing.isSymbolicLink()) throw new Error("Attachment path is not allowed.");
  } catch (error) {
    if (error instanceof Error && error.message === "Attachment path is not allowed.") throw error;
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  await fs.writeFile(absolutePath, bytes, { mode: 0o600 });
  return absolutePath;
}

export function redactLogText(input: string) {
  return input
    .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, "[redacted-email]")
    .replace(/\+?\d[\d\s().-]{7,}\d/g, "[redacted-phone]")
    .replace(/(?:sk|opencode)[-_][A-Za-z0-9_-]+/g, "[redacted-key]")
    .replace(/(?:ghp|github_pat)_[A-Za-z0-9_]+/g, "[redacted-token]")
    .replace(/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g, "[redacted-private-key]")
    .replace(/(?:\/Users\/|\/home\/|\/private\/var\/)[^\s]+/g, "[redacted-local-path]");
}
