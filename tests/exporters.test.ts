import { describe, expect, it } from "vitest";
import { createWorkspace } from "@/lib/demo";
import { draftResumeFromApprovedEvidence } from "@/lib/agent/orchestrator";
import { resumeDocx, resumeMarkdown, resumePdf, resumePlainText, validateResume } from "@/lib/exporters";

describe("deterministic resume exporters", () => {
  it("keeps approved evidence in every output format", async () => {
    const base = createWorkspace("demo");
    const claim = {
      id: "claim_synthetic",
      claimText: "Built an accessible study planner.",
      category: "project" as const,
      sourceIds: [base.sources[1].id],
      sourceExcerpts: ["Synthetic project notes"],
      provenance: "agent-generated" as const,
      status: "approved" as const,
      includeInResume: true,
    };
    const workspace = { ...base, claims: [claim] };
    const resume = draftResumeFromApprovedEvidence(workspace, "Synthetic resume", "ats-classic");
    expect(validateResume(resume, workspace).unsupportedClaimIds).toEqual([]);
    expect(resumePlainText(resume, workspace)).toContain(claim.claimText);
    expect(resumeMarkdown(resume, workspace)).toContain(claim.claimText);
    expect((await resumeDocx(resume, workspace)).subarray(0, 2).toString()).toBe("PK");
    expect((await resumePdf(resume, workspace)).subarray(0, 4).toString()).toBe("%PDF");
  });
});
