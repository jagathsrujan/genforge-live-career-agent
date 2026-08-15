import { EvidenceClaim, JobOpportunity, MatchReport, makeId, nowIso } from "../domain";

export function calculateMatchReport(job: JobOpportunity, claims: EvidenceClaim[]): MatchReport {
  const matched: string[] = [];
  const partial: string[] = [];
  const missing: string[] = [];
  const unsupported: string[] = [];

  for (const requirement of job.requirements) {
    const related = claims.filter((claim) => requirement.evidenceClaimIds.includes(claim.id) || claim.claimText.toLowerCase().includes(requirement.text.toLowerCase().split(" ")[0] || "__never__"));
    const approved = related.filter((claim) => claim.status === "approved" && claim.includeInResume);
    const needsConfirmation = related.filter((claim) => claim.status === "needs-confirmation");
    if (approved.length > 0) matched.push(requirement.id);
    else if (needsConfirmation.length > 0) partial.push(requirement.id);
    else if (related.length > 0) unsupported.push(requirement.id);
    else missing.push(requirement.id);
  }

  const total = job.requirements.length || 1;
  const coveragePercent = Math.round(((matched.length + partial.length * 0.5) / total) * 100);
  return {
    id: makeId("match"),
    jobId: job.id,
    coveragePercent,
    matchedRequirementIds: matched,
    partialRequirementIds: partial,
    missingRequirementIds: missing,
    unsupportedRequirementIds: unsupported,
    explanation: "Coverage is calculated from reviewed evidence claims. It is not a hiring prediction or model confidence score.",
    createdAt: nowIso(),
  };
}
