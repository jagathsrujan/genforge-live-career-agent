import { describe, expect, it } from "vitest";
import { isSafePublicUrl } from "@/lib/research/safe-url";

describe("public URL boundary", () => {
  it("allows public HTTPS URLs", () => {
    expect(isSafePublicUrl("https://example.com/jobs/frontend")).toBe(true);
  });

  it("rejects local, credentialed, and unsupported URLs", () => {
    expect(isSafePublicUrl("http://localhost:3000")).toBe(false);
    expect(isSafePublicUrl("http://192.168.0.2/private")).toBe(false);
    expect(isSafePublicUrl("file:///tmp/secret.txt")).toBe(false);
    expect(isSafePublicUrl("https://user:pass@example.com")).toBe(false);
  });
});
