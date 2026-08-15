import { describe, expect, it } from "vitest";
import { EvidenceClaimSchema, WorkspaceSchema } from "@/lib/domain";
import { createWorkspace } from "@/lib/demo";

describe("domain validation", () => {
  it("creates a schema-valid demo workspace with input data only", () => {
    const workspace = createWorkspace("demo");
    expect(WorkspaceSchema.parse(workspace).mode).toBe("demo");
    expect(workspace.claims).toHaveLength(0);
    expect(workspace.candidate.fullName).toBe("Maya Chen");
  });

  it("requires a source for every evidence claim", () => {
    expect(() => EvidenceClaimSchema.parse({
      id: "claim_1",
      claimText: "Built a thing",
      category: "project",
      sourceIds: [],
      provenance: "agent-generated",
      status: "pending",
      includeInResume: false,
    })).toThrow();
  });
});
