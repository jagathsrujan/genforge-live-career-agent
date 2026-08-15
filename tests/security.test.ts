import { describe, expect, it } from "vitest";
import { redactLogText } from "@/lib/storage";
import { isSafePublicUrl } from "@/lib/research/safe-url";

describe("privacy and network boundaries", () => {
  it("redacts contact details, keys, and local paths from persisted messages", () => {
    const key = ["sk", "abcdefghijklmnop"].join("-");
    const path = ["/Users", "synthetic", "GenForge", "resume.pdf"].join("/");
    const redacted = redactLogText(`maya@example.test 415 555 0138 ${key} ${path}`);
    expect(redacted).not.toContain("maya@example.test");
    expect(redacted).not.toContain(key);
    expect(redacted).not.toContain(path);
    expect(redacted).toContain("[redacted-email]");
    expect(redacted).toContain("[redacted-key]");
    expect(redacted).toContain("[redacted-local-path]");
  });

  it("rejects local, credentialed, and non-http URLs before research", () => {
    expect(isSafePublicUrl("http://127.0.0.1:3000")).toBe(false);
    expect(isSafePublicUrl("http://[::1]/")).toBe(false);
    expect(isSafePublicUrl("https://user:pass@example.test")).toBe(false);
    expect(isSafePublicUrl("file:///tmp/source.txt")).toBe(false);
  });
});
