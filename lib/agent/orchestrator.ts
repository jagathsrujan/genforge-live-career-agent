import {
  AgentRun,
  AgentRunEvent,
  EvidenceClaim,
  JobOpportunity,
  PiEvidenceOutputSchema,
  PiJobAnalysisSchema,
  PiResumeDraftSchema,
  ResumeVersion,
  Source,
  Workspace,
  makeId,
  nowIso,
} from "../domain";
import { extractLocalSource } from "../research/extract";
import { calculateMatchReport } from "../research/match";
import { researchPublicUrl } from "../research/public";
import { PiRpcClient } from "./pi-rpc";
import { buildPrivacyDisclosure, candidateForModel } from "../privacy/payload";
import { redactLogText } from "../storage";

type EventWriter = (event: Omit<AgentRunEvent, "id" | "runId" | "createdAt">) => Promise<void>;

function asContext(workspace: Workspace, observations: Array<{ url: string; reconciledText: string }>, localText: Map<string, string>) {
  const candidate = JSON.stringify(candidateForModel(workspace.candidate));
  const sources = workspace.sources.map((source) => ({ id: source.id, kind: source.kind, label: source.label, url: source.url, excerpt: localText.get(source.id) || source.excerpt })).filter((source) => source.url || source.excerpt);
  const web = observations.map((observation) => ({ url: observation.url, text: observation.reconciledText.slice(0, 8_000) }));
  return JSON.stringify({ candidate, sources, web });
}

export async function runLiveWorkflow(workspace: Workspace, writeEvent: EventWriter, signal?: AbortSignal) {
  if (!process.env.OPENCODE_API_KEY) throw new Error("OPENCODE_API_KEY is required before a live run can start.");

  const textClient = new PiRpcClient();
  const imageClient = new PiRpcClient({
    model: process.env.GENFORGE_PI_IMAGE_MODEL || "opencode/mimo-v2.5-free",
    thinking: process.env.GENFORGE_PI_IMAGE_THINKING || "max",
  });
  const abortClients = () => {
    void textClient.abort();
    void imageClient.abort();
  };
  const ensureActive = () => {
    if (signal?.aborted) {
      const error = new Error("Live run cancelled by the user.");
      error.name = "AbortError";
      throw error;
    }
  };
  const closeClients = async () => {
    signal?.removeEventListener("abort", abortClients);
    return Promise.all([textClient.close(), imageClient.close()]);
  };
  signal?.addEventListener("abort", abortClients, { once: true });
  const observations: Array<{ url: string; reconciledText: string }> = [];
  const localText = new Map<string, string>();
  const images: Array<{ mimeType: string; data: string }> = [];
  const extractedImageSourceIds = new Set<string>();
  const failedSourceIds = new Set<string>();
  const urlSources = workspace.sources.filter((source): source is Source & { url: string } => Boolean(source.url));
  const fileSources = workspace.sources.filter((source) => Boolean(source.localPath));

  try {
    await writeEvent({ type: "run.started", message: "Live agent run started", severity: "info" });
    await writeEvent({ type: "privacy.confirmed", message: "Privacy disclosure accepted; outbound work is scoped to the listed fields and public URLs", severity: "info" });

    for (const source of fileSources) {
      ensureActive();
      try {
        const extraction = await extractLocalSource(source);
        if (extraction.text) localText.set(source.id, extraction.text);
        if (extraction.image) {
          images.push(extraction.image);
          extractedImageSourceIds.add(source.id);
        }
        await writeEvent({ type: "source.extracted", message: `${source.label} extracted for live evidence analysis`, severity: extraction.text || extraction.image ? "success" : "warning" });
      } catch (error) {
        failedSourceIds.add(source.id);
        await writeEvent({ type: "source.extraction_failed", message: `${source.label} could not be extracted: ${error instanceof Error ? error.message : "extraction failed"}`, severity: "warning" });
      }
    }

    if (urlSources.length > 0) {
      await writeEvent({ type: "research.started", message: `Researching ${urlSources.length} public source${urlSources.length === 1 ? "" : "s"} in parallel`, severity: "info" });
      const results = await Promise.all(urlSources.map(async (source) => {
        try {
          const result = await researchPublicUrl(source.url);
          observations.push({ url: result.url, reconciledText: result.reconciledText });
          await writeEvent({ type: "research.reconciled", message: `${source.label} reconciled from direct fetch and browser inspection`, severity: result.reconciledText ? "success" : "warning" });
          return { source, result };
        } catch (error) {
          await writeEvent({ type: "research.failed", message: `${source.label} needs attention: ${error instanceof Error ? error.message : "research failed"}`, severity: "warning" });
          return { source, result: undefined };
        }
      }));
      ensureActive();
      if (results.some(({ result }) => result?.reconciledText)) {
        await writeEvent({ type: "research.complete", message: `${results.filter(({ result }) => result?.reconciledText).length} public sources reconciled`, severity: "success" });
      } else {
        await writeEvent({ type: "research.empty", message: "No public source produced usable text; the run remains recoverable", severity: "warning" });
      }
    } else {
      await writeEvent({ type: "research.skipped", message: "No public URLs listed yet; continuing with candidate inputs", severity: "info" });
    }

    const context = asContext(workspace, observations, localText);
    ensureActive();
    await writeEvent({ type: "evidence.started", message: "Extracting source-backed candidate claims", severity: "info" });
    const evidenceClient = images.length > 0 ? imageClient : textClient;
    await writeEvent({
      type: "model.selected",
      message: images.length > 0 ? "Image inputs routed to MiMo V2.5 Free" : "Text inputs routed to DeepSeek V4 Flash Free with max thinking",
      severity: "info",
    });
    const evidencePrompt = [
      "You are the GenForge evidence analyst. Work only from the JSON context below. Do not infer facts.",
      "Return one JSON object only, with no markdown or commentary. Use real quoted string values; never return type placeholders such as string, string[], or one of.",
      "Return claims that can be traced to at least one exact source id. Set sourceExcerpts to short excerpts copied from the context.",
      "{\"claims\":[{\"claimText\":\"Improved keyboard navigation in a React project\",\"category\":\"impact\",\"sourceIds\":[\"source_123\"],\"sourceExcerpts\":[\"Implemented keyboard navigation\"],\"notes\":\"Directly supported by the source excerpt.\"}]}",
      "Allowed categories: impact, skill, role, education, project, credential, preference, contact.",
      "{\"claims\":[]} is the correct response when there are no defensible claims.",
    ].join("\\n") + "\\n\\nCONTEXT:\\n" + context;
    const evidence = await evidenceClient.promptStructured(
      evidencePrompt,
      PiEvidenceOutputSchema,
      images,
      signal,
    );
    const claimIds = new Set(workspace.claims.map((claim) => claim.id));
    const claims: EvidenceClaim[] = [...workspace.claims];
    for (const claim of evidence.claims) {
      const sourceIds = claim.sourceIds.filter((sourceId) => workspace.sources.some((source) => source.id === sourceId));
      if (!sourceIds.length) continue;
      const duplicate = claims.find((existing) => existing.claimText.trim().toLowerCase() === claim.claimText.trim().toLowerCase());
      if (duplicate) continue;
      const next: EvidenceClaim = {
        id: makeId("claim"),
        claimText: claim.claimText,
        category: claim.category,
        sourceIds,
        sourceExcerpts: claim.sourceExcerpts ?? [],
        provenance: "agent-generated",
        status: "pending",
        includeInResume: false,
        notes: claim.notes,
      };
      if (!claimIds.has(next.id)) claims.push(next);
    }
    await writeEvent({ type: "evidence.complete", message: `${claims.length - workspace.claims.length} new evidence claims ready for review`, severity: "success" });

    let jobs = workspace.jobs;
    let matchReports = workspace.matchReports;
    let resumes = workspace.resumes;
    const activeJob = jobs.find((job) => job.id === workspace.activeJobId) || jobs[0];
    if (activeJob) {
      ensureActive();
      await writeEvent({ type: "requirements.started", message: `Analyzing requirements for ${activeJob.title}`, severity: "info" });
      const requirementsPrompt = [
        "Analyze the target job in this JSON context. Do not invent requirements.",
        "Return one JSON object only, with no markdown or commentary. Use real quoted string values; never return type placeholders such as string or string[].",
        "{\"title\":\"Frontend Engineer\",\"companyName\":\"Example Co\",\"location\":\"Remote\",\"employmentType\":\"Full-time\",\"requirements\":[{\"text\":\"TypeScript experience\",\"category\":\"skill\",\"priority\":\"required\"}]}",
        "Each requirement priority must be exactly required, preferred, or contextual.",
        "{\"requirements\":[]} is the correct response when there are no explicit requirements.",
      ].join("\\n") + "\\n\\nJOB:\\n" + JSON.stringify({ title: activeJob.title, companyName: activeJob.companyName, description: activeJob.description, url: activeJob.url }) + "\\n\\nEVIDENCE:\\n" + JSON.stringify(claims);
      const analysis = await textClient.promptStructured(
        requirementsPrompt,
        PiJobAnalysisSchema,
        [],
        signal,
      );
      const updatedJob: JobOpportunity = {
        ...activeJob,
        title: analysis.title,
        companyName: analysis.companyName,
        location: analysis.location ?? "",
        employmentType: analysis.employmentType ?? "",
        requirements: analysis.requirements.map((requirement, index) => ({
          id: makeId(`requirement${index}`),
          jobId: activeJob.id,
          ...requirement,
          status: "missing" as const,
          evidenceClaimIds: [],
          explanation: "Awaiting transparent evidence mapping.",
        })),
        status: "analyzed",
      };
      jobs = jobs.map((job) => job.id === activeJob.id ? updatedJob : job);
      const report = calculateMatchReport(updatedJob, claims);
      matchReports = [...matchReports.filter((item) => item.jobId !== updatedJob.id), report];
      await writeEvent({ type: "requirements.complete", message: `${updatedJob.requirements.length} requirements classified and coverage calculated`, severity: "success" });
    }

    if (activeJob && activeJob.status === "analyzed" && claims.some((claim) => claim.status === "approved" && claim.includeInResume)) {
      await writeEvent({ type: "resume.ready", message: "Approved evidence is available for targeted resume drafting", severity: "info" });
    } else {
      await writeEvent({ type: "resume.waiting", message: "Resume drafting waits for at least one approved evidence claim", severity: "info" });
    }

    await closeClients();
    const sources = workspace.sources.map((source) => {
      const researched = Boolean(source.url && observations.some((observation) => observation.url === source.url));
      const extracted = localText.has(source.id) || extractedImageSourceIds.has(source.id);
      return extracted || researched
        ? { ...source, status: "ready" as const, extractionStatus: extracted ? "ready" as const : "skipped" as const, excerpt: localText.get(source.id) || source.excerpt, fetchedAt: nowIso() }
        : failedSourceIds.has(source.id)
          ? { ...source, status: "failed" as const, extractionStatus: "failed" as const }
          : source;
    });
    const nextWorkspace = { ...workspace, sources, claims, jobs, matchReports, resumes, updatedAt: nowIso() };
    return { ...nextWorkspace, privacyDisclosure: buildPrivacyDisclosure(nextWorkspace, true) };
  } catch (error) {
    await closeClients();
    throw error;
  }
}

export function makeRun(workspaceId: string, kind: AgentRun["kind"] = "full-workflow"): AgentRun {
  return {
    id: makeId("run"),
    workspaceId,
    kind,
    status: "queued",
    startedAt: nowIso(),
    events: [],
  };
}

export function makeEvent(runId: string, event: Omit<AgentRunEvent, "id" | "runId" | "createdAt">): AgentRunEvent {
  return {
    ...event,
    message: redactLogText(event.message).slice(0, 600),
    metadata: event.metadata ? Object.fromEntries(Object.entries(event.metadata).map(([key, value]) => [key, redactLogText(value).slice(0, 300)])) : undefined,
    id: makeId("event"),
    runId,
    createdAt: nowIso(),
  };
}

export function draftResumeFromApprovedEvidence(workspace: Workspace, title: string, template: ResumeVersion["template"]): ResumeVersion {
  const approved = workspace.claims.filter((claim) => claim.status === "approved" && claim.includeInResume);
  const sections = [
    {
      id: makeId("section"),
      title: "Summary",
      kind: "summary" as const,
      body: workspace.candidate.summary || workspace.candidate.headline,
      bullets: [],
    },
    {
      id: makeId("section"),
      title: "Selected evidence",
      kind: "custom" as const,
      body: "",
      bullets: approved.map((claim) => ({
        id: makeId("bullet"),
        text: claim.claimText,
        claimIds: [claim.id],
        sourceIds: claim.sourceIds,
        provenance: "agent-generated" as const,
        included: true,
      })),
    },
  ];
  return {
    id: makeId("resume"),
    workspaceId: workspace.id,
    title,
    template,
    targetJobId: workspace.activeJobId,
    sections,
    status: "draft",
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
}
