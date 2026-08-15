#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const forbiddenTrackedNames = /(^|\/)(\.env(\..*)?|attachments|runs|exports|personal|private)(\/|$)/i;
const secretPatterns = [
  /(?:sk|opencode)[-_][A-Za-z0-9_-]{16,}/,
  /(?:ghp|github_pat)_[A-Za-z0-9_]{20,}/,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /^\s*OPENCODE_API_KEY[ \t]*=[ \t]*(?!$|#)\S+/m,
  /(?:xox[baprs]-|AIza)[A-Za-z0-9_-]{12,}/,
];
const emailPattern = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const phonePattern = /(?:\+?\d[\d .()\-]{8,}\d)/g;
const localPathPattern = /(?:\/Users\/|\/home\/|\/private\/var\/|[A-Z]:\\Users\\)/;
const allowedSyntheticEmails = new Set(["example.test", "example.com", "example.org"]);
const allowedSyntheticPhone = /(?:^|[^\d])555(?:[^\d]|$)/;
const findings = [];

function git(args, allowFailure = false) {
  try {
    return execFileSync("git", args, { cwd: root, encoding: "utf8", maxBuffer: 8 * 1024 * 1024 });
  } catch (error) {
    if (allowFailure) return "";
    throw error;
  }
}

function addFinding(kind, detail) {
  findings.push(`${kind}: ${detail}`);
}

function namesFromGit(args) {
  return git(args, true).split("\0").filter(Boolean);
}

function isPublicCandidate(file) {
  return !file.startsWith(".git/") && !file.startsWith("node_modules/") && !file.startsWith(".next/") && (isAllowedTemplate(file) || !forbiddenTrackedNames.test(file));
}

function isAllowedTemplate(file) {
  return file === ".env.example";
}

function scanText(file, content, source) {
  for (const pattern of secretPatterns) {
    if (pattern.test(content)) addFinding("secret", `${source}: ${file}`);
  }
  const emails = content.match(emailPattern) || [];
  for (const email of emails) {
    const domain = email.split("@")[1]?.toLowerCase();
    if (!allowedSyntheticEmails.has(domain)) addFinding("personal email", `${source}: ${file}`);
  }
  const phoneSamples = content.match(phonePattern) || [];
  if (phoneSamples.some((sample) => {
    const digits = sample.replace(/\D/g, "");
    const looksLikeVersion = sample.includes(".") && !/[+ ()-]/.test(sample);
    return digits.length >= 10 && !looksLikeVersion && !allowedSyntheticPhone.test(sample);
  })) addFinding("personal phone", `${source}: ${file}`);
  if (localPathPattern.test(content)) addFinding("local path", `${source}: ${file}`);
}

function scanFile(file, source) {
  const absolute = path.join(root, file);
  if (!fs.existsSync(absolute) || !isPublicCandidate(file)) return;
  const stat = fs.statSync(absolute);
  if (stat.isDirectory()) return;
  if (stat.size > 2 * 1024 * 1024 && !file.endsWith(".pdf")) addFinding("large file", `${source}: ${file}`);
  const bytes = fs.readFileSync(absolute);
  if (bytes.includes(0)) return;
  scanText(file, bytes.toString("utf8"), source);
}

const tracked = namesFromGit(["ls-files", "-z"]);
const staged = namesFromGit(["diff", "--cached", "--name-only", "-z"]);
const untracked = namesFromGit(["ls-files", "--others", "--exclude-standard", "-z"]);
const files = [...new Set([...tracked, ...staged, ...untracked])];

for (const file of files) {
  if (forbiddenTrackedNames.test(file) && !isAllowedTemplate(file) && tracked.includes(file)) addFinding("forbidden tracked path", file);
  scanFile(file, tracked.includes(file) ? "working tree" : "untracked file");
}

const history = git(["log", "--all", "--format=", "-p"], true);
if (history) scanText("git history", history, "history");

const stagedDiff = git(["diff", "--cached", "--no-ext-diff", "--unified=0"], true);
if (stagedDiff) scanText("staged diff", stagedDiff, "staged");

if (findings.length) {
  console.error("Public repository check failed:");
  for (const finding of [...new Set(findings)]) console.error(`- ${finding}`);
  process.exitCode = 1;
} else {
  console.log(`Public repository check passed (${files.length} candidate files scanned).`);
}
