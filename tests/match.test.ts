import { describe, expect, it } from "vitest";
import { calculateMatchReport } from "@/lib/research/match";
import { EvidenceClaim, JobOpportunity } from "@/lib/domain";

const job: JobOpportunity = {
  id: "job_1",
  title: "Frontend Engineer",
  companyName: "Example",
  url: "https://example.com/job",
  location: "Remote",
  employmentType: "Full-time",
  description: "",
  requirements: [
    { id: "req_1", jobId: "job_1", text: "React", category: "skill", priority: "required", status: "missing", evidenceClaimIds: [], explanation: "" },
    { id: "req_2", jobId: "job_1", text: "Testing", category: "skill", priority: "preferred", status: "missing", evidenceClaimIds: [], explanation: "" },
  ],
  sourceIds: [],
  status: "analyzed",
  discoveredAt: new Date().toISOString(),
};

describe("transparent match coverage", () => {
  it("counts approved source-backed evidence and explains the basis", () => {
    const claims: EvidenceClaim[] = [{ id: "claim_1", claimText: "React interface", category: "skill", sourceIds: ["source_1"], sourceExcerpts: ["React"], provenance: "user-provided", status: "approved", includeInResume: true }];
    const report = calculateMatchReport(job, claims);
    expect(report.coveragePercent).toBe(50);
    expect(report.explanation).toMatch(/reviewed evidence/i);
  });
});
