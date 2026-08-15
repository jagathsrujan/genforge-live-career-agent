#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoots = ["app", "lib", "tests", "types"];
const forbidden = [
  { pattern: /dangerouslySetInnerHTML/, message: "Avoid unsanitized HTML injection." },
  { pattern: /console\.log\(/, message: "Use observable UI events or explicit error output instead of console.log." },
];
const failures = [];

function walk(directory) {
  const absolute = path.join(root, directory);
  if (!fs.existsSync(absolute)) return [];
  return fs.readdirSync(absolute, { withFileTypes: true }).flatMap((entry) => {
    const relative = path.join(directory, entry.name);
    if (entry.isDirectory()) return walk(relative);
    return /\.(ts|tsx|mjs)$/.test(entry.name) ? [relative] : [];
  });
}

for (const file of sourceRoots.flatMap(walk)) {
  const content = fs.readFileSync(path.join(root, file), "utf8");
  for (const rule of forbidden) if (rule.pattern.test(content)) failures.push(`${file}: ${rule.message}`);
}

try {
  execFileSync(process.execPath, ["--check", path.join(root, "bin/resume.mjs")], { stdio: "pipe" });
} catch {
  failures.push("bin/resume.mjs: Node syntax check failed.");
}

if (failures.length) {
  console.error("Lint check failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log("Lint check passed.");
}
