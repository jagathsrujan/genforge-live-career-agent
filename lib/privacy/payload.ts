import { CandidateProfile, PrivacyDisclosure, Workspace, nowIso } from "../domain";

export const MODEL_CANDIDATE_FIELDS = [
  "name",
  "headline",
  "summary",
  "skills",
  "experience",
  "education",
  "projects",
  "certifications",
] as const;

export function candidateForModel(candidate: CandidateProfile) {
  return {
    fullName: candidate.fullName,
    headline: candidate.headline,
    summary: candidate.summary,
    skills: candidate.skills,
    education: candidate.education,
    experience: candidate.experience,
    projects: candidate.projects,
    certifications: candidate.certifications,
  };
}

export function buildPrivacyDisclosure(workspace: Workspace, accepted = workspace.privacyDisclosure.accepted): PrivacyDisclosure {
  const sources = workspace.sources;
  return {
    ...workspace.privacyDisclosure,
    version: 1,
    shown: true,
    accepted,
    acceptedAt: accepted ? workspace.privacyDisclosure.acceptedAt || nowIso() : undefined,
    fieldsSent: [...MODEL_CANDIDATE_FIELDS],
    sourceIds: sources.map((source) => source.id),
    filesAnalyzed: sources.filter((source) => source.fileName).map((source) => source.fileName!),
    urlsFetched: sources.filter((source) => source.url).map((source) => source.url!),
    provider: "OpenCode Zen",
    textModel: process.env.GENFORGE_PI_MODEL || "opencode/deepseek-v4-flash-free",
    imageModel: process.env.GENFORGE_PI_IMAGE_MODEL || "opencode/mimo-v2.5-free",
    redactionNote: "Contact details, API keys, raw file contents, and local paths are excluded from model context and logs.",
  };
}
