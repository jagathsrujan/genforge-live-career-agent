import { z } from "zod";

export const WorkspaceModeSchema = z.enum(["blank", "demo"]);
export const WorkspaceStageSchema = z.enum(["candidate", "evidence", "target", "resume", "export"]);
export const SourceKindSchema = z.enum([
  "resume",
  "linkedin-export",
  "linkedin-screenshot",
  "certificate",
  "photo",
  "github",
  "portfolio",
  "company",
  "job",
  "other",
]);
export const SourceStatusSchema = z.enum(["pending", "processing", "ready", "blocked", "failed"]);
export const ClaimCategorySchema = z.enum([
  "impact",
  "skill",
  "role",
  "education",
  "project",
  "credential",
  "preference",
  "contact",
]);
export const ProvenanceSchema = z.enum(["user-provided", "agent-discovered", "agent-generated"]);
export const ClaimStatusSchema = z.enum(["pending", "approved", "rejected", "needs-confirmation"]);
export const ResumeTemplateSchema = z.enum(["ats-classic", "editorial-minimal"]);
export const ResumeStatusSchema = z.enum(["draft", "validated", "exported"]);
export const AgentRunKindSchema = z.enum([
  "source-intake",
  "research",
  "match",
  "resume",
  "validation",
  "full-workflow",
]);
export const AgentRunStatusSchema = z.enum(["queued", "running", "completed", "failed", "cancelled"]);
export const AgentEventSeveritySchema = z.enum(["info", "success", "warning", "error"]);

const IsoDate = z.string().datetime({ offset: true });

export const ExperienceSchema = z.object({
  id: z.string(),
  company: z.string(),
  title: z.string(),
  location: z.string().default(""),
  startDate: z.string(),
  endDate: z.string().default("Present"),
  bullets: z.array(z.string()).default([]),
});

export const ProjectSchema = z.object({
  id: z.string(),
  name: z.string(),
  url: z.string().optional(),
  description: z.string().default(""),
  technologies: z.array(z.string()).default([]),
});

export const CandidateProfileSchema = z.object({
  id: z.string(),
  fullName: z.string().default(""),
  headline: z.string().default(""),
  email: z.string().default(""),
  phone: z.string().default(""),
  location: z.string().default(""),
  website: z.string().default(""),
  githubUrl: z.string().default(""),
  portfolioUrl: z.string().default(""),
  summary: z.string().default(""),
  skills: z.array(z.string()).default([]),
  education: z.array(z.string()).default([]),
  experience: z.array(ExperienceSchema).default([]),
  projects: z.array(ProjectSchema).default([]),
  certifications: z.array(z.string()).default([]),
  updatedAt: IsoDate,
});

export const SourceSchema = z.object({
  id: z.string(),
  kind: SourceKindSchema,
  label: z.string().min(1).max(240),
  url: z.string().url().optional(),
  fileName: z.string().optional(),
  mimeType: z.string().optional(),
  localPath: z.string().optional(),
  excerpt: z.string().max(24_000).optional(),
  sizeBytes: z.number().int().nonnegative().max(10_000_000).optional(),
  extractionStatus: z.enum(["pending", "ready", "failed", "skipped"]).default("pending"),
  status: SourceStatusSchema,
  error: z.string().optional(),
  fetchedAt: IsoDate.optional(),
  createdAt: IsoDate,
});

export const EvidenceClaimSchema = z.object({
  id: z.string(),
  claimText: z.string(),
  category: ClaimCategorySchema,
  sourceIds: z.array(z.string()).min(1),
  sourceExcerpts: z.array(z.string()).default([]),
  provenance: ProvenanceSchema,
  status: ClaimStatusSchema,
  includeInResume: z.boolean(),
  reviewedAt: IsoDate.optional(),
  notes: z.string().optional(),
});

export const TargetCompanySchema = z.object({
  id: z.string(),
  name: z.string(),
  website: z.string().url().optional(),
  description: z.string().default(""),
  sourceIds: z.array(z.string()).default([]),
});

export const RequirementStatusSchema = z.enum(["matched", "partial", "missing", "unsupported"]);
export const JobRequirementSchema = z.object({
  id: z.string(),
  jobId: z.string(),
  text: z.string(),
  category: z.string(),
  priority: z.enum(["required", "preferred", "contextual"]),
  status: RequirementStatusSchema,
  evidenceClaimIds: z.array(z.string()).default([]),
  explanation: z.string().default(""),
});

export const JobOpportunitySchema = z.object({
  id: z.string(),
  companyId: z.string().optional(),
  title: z.string(),
  companyName: z.string(),
  url: z.string().url(),
  location: z.string().default(""),
  employmentType: z.string().default(""),
  description: z.string().default(""),
  requirements: z.array(JobRequirementSchema).default([]),
  sourceIds: z.array(z.string()).default([]),
  status: z.enum(["discovered", "needs-analysis", "analyzed", "blocked"]),
  discoveredAt: IsoDate,
});

export const MatchReportSchema = z.object({
  id: z.string(),
  jobId: z.string(),
  coveragePercent: z.number().min(0).max(100),
  matchedRequirementIds: z.array(z.string()),
  partialRequirementIds: z.array(z.string()),
  missingRequirementIds: z.array(z.string()),
  unsupportedRequirementIds: z.array(z.string()),
  explanation: z.string(),
  createdAt: IsoDate,
});

export const ResumeBulletSchema = z.object({
  id: z.string(),
  text: z.string(),
  claimIds: z.array(z.string()).default([]),
  sourceIds: z.array(z.string()).default([]),
  provenance: ProvenanceSchema,
  included: z.boolean(),
});

export const ResumeSectionSchema = z.object({
  id: z.string(),
  title: z.string(),
  kind: z.enum(["summary", "experience", "projects", "skills", "education", "certifications", "custom"]),
  body: z.string().default(""),
  bullets: z.array(ResumeBulletSchema).default([]),
});

export const AtsReportSchema = z.object({
  passed: z.boolean(),
  checks: z.array(z.object({
    id: z.string(),
    label: z.string(),
    status: z.enum(["pass", "warn", "fail"]),
    detail: z.string(),
  })),
  keywordCoverage: z.number().min(0).max(100),
  unsupportedClaimIds: z.array(z.string()).default([]),
  updatedAt: IsoDate,
});

export const ResumeVersionSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  title: z.string(),
  template: ResumeTemplateSchema,
  targetJobId: z.string().optional(),
  sections: z.array(ResumeSectionSchema).default([]),
  status: ResumeStatusSchema,
  atsReport: AtsReportSchema.optional(),
  createdAt: IsoDate,
  updatedAt: IsoDate,
});

export const AgentRunEventSchema = z.object({
  id: z.string(),
  runId: z.string(),
  type: z.string(),
  message: z.string(),
  severity: AgentEventSeveritySchema,
  createdAt: IsoDate,
  metadata: z.record(z.string(), z.string()).optional(),
});

export const AgentRunSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  kind: AgentRunKindSchema,
  status: AgentRunStatusSchema,
  startedAt: IsoDate,
  completedAt: IsoDate.optional(),
  error: z.string().optional(),
  events: z.array(AgentRunEventSchema).default([]),
});

export const PrivacyDisclosureSchema = z.object({
  version: z.number().int().positive().default(1),
  shown: z.boolean(),
  accepted: z.boolean(),
  acceptedAt: IsoDate.optional(),
  fieldsSent: z.array(z.string()),
  sourceIds: z.array(z.string()).default([]),
  filesAnalyzed: z.array(z.string()),
  urlsFetched: z.array(z.string()),
  provider: z.string().default("OpenCode Zen"),
  textModel: z.string().default("opencode/deepseek-v4-flash-free"),
  imageModel: z.string().default("opencode/mimo-v2.5-free"),
  redactionNote: z.string().default("Contact details, API keys, raw file contents, and local paths are excluded from model context and logs."),
  localStorageNote: z.string(),
});

export const WorkspaceSchema = z.object({
  schemaVersion: z.number().int().positive().default(1),
  id: z.string(),
  name: z.string(),
  mode: WorkspaceModeSchema,
  stage: WorkspaceStageSchema,
  candidate: CandidateProfileSchema,
  sources: z.array(SourceSchema).default([]),
  claims: z.array(EvidenceClaimSchema).default([]),
  companies: z.array(TargetCompanySchema).default([]),
  jobs: z.array(JobOpportunitySchema).default([]),
  matchReports: z.array(MatchReportSchema).default([]),
  resumes: z.array(ResumeVersionSchema).default([]),
  agentRuns: z.array(AgentRunSchema).default([]),
  privacyDisclosure: PrivacyDisclosureSchema,
  activeJobId: z.string().optional(),
  activeResumeId: z.string().optional(),
  lastRunId: z.string().optional(),
  createdAt: IsoDate,
  updatedAt: IsoDate,
});

export type Workspace = z.infer<typeof WorkspaceSchema>;
export type CandidateProfile = z.infer<typeof CandidateProfileSchema>;
export type Source = z.infer<typeof SourceSchema>;
export type EvidenceClaim = z.infer<typeof EvidenceClaimSchema>;
export type ClaimStatus = z.infer<typeof ClaimStatusSchema>;
export type TargetCompany = z.infer<typeof TargetCompanySchema>;
export type JobOpportunity = z.infer<typeof JobOpportunitySchema>;
export type JobRequirement = z.infer<typeof JobRequirementSchema>;
export type MatchReport = z.infer<typeof MatchReportSchema>;
export type ResumeVersion = z.infer<typeof ResumeVersionSchema>;
export type ResumeSection = z.infer<typeof ResumeSectionSchema>;
export type ResumeBullet = z.infer<typeof ResumeBulletSchema>;
export type AtsReport = z.infer<typeof AtsReportSchema>;
export type AgentRun = z.infer<typeof AgentRunSchema>;
export type AgentRunEvent = z.infer<typeof AgentRunEventSchema>;
export type PrivacyDisclosure = z.infer<typeof PrivacyDisclosureSchema>;
export type SourceKind = z.infer<typeof SourceKindSchema>;
export type WorkspaceStage = z.infer<typeof WorkspaceStageSchema>;

export const PiEvidenceOutputSchema = z.object({
  claims: z.array(z.object({
    claimText: z.string(),
    category: ClaimCategorySchema,
    sourceIds: z.array(z.string()).min(1),
    sourceExcerpts: z.array(z.string()).default([]),
    notes: z.string().default(""),
  })),
});

export const PiJobAnalysisSchema = z.object({
  title: z.string(),
  companyName: z.string(),
  location: z.string().default(""),
  employmentType: z.string().default(""),
  requirements: z.array(z.object({
    text: z.string(),
    category: z.string(),
    priority: z.enum(["required", "preferred", "contextual"]),
  })),
});

export const PiResumeDraftSchema = z.object({
  title: z.string(),
  summary: z.string(),
  sections: z.array(z.object({
    title: z.string(),
    kind: z.enum(["summary", "experience", "projects", "skills", "education", "certifications", "custom"]),
    body: z.string().default(""),
    bullets: z.array(z.object({
      text: z.string(),
      claimIds: z.array(z.string()).default([]),
      sourceIds: z.array(z.string()).default([]),
    })).default([]),
  })),
});

export const PiValidationSchema = z.object({
  passed: z.boolean(),
  issues: z.array(z.object({ id: z.string(), label: z.string(), detail: z.string(), severity: z.enum(["warning", "error"]) })),
});

export type PiEvidenceOutput = z.infer<typeof PiEvidenceOutputSchema>;
export type PiJobAnalysis = z.infer<typeof PiJobAnalysisSchema>;
export type PiResumeDraft = z.infer<typeof PiResumeDraftSchema>;
export type PiValidation = z.infer<typeof PiValidationSchema>;

export function nowIso() {
  return new Date().toISOString();
}

export function makeId(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`;
}
