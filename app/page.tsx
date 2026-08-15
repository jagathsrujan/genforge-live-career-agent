"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  BadgeCheck,
  BookOpen,
  BriefcaseBusiness,
  Check,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  CircleDashed,
  Download,
  FileCheck2,
  FileText,
  FolderOpen,
  Github,
  Globe2,
  Info,
  PanelRight,
  Lightbulb,
  Link2,
  LockKeyhole,
  Menu,
  PencilLine,
  Play,
  Plus,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Upload,
  UserRound,
  X,
} from "lucide-react";
import type { ComponentType, FocusEvent, ReactNode } from "react";
import type {
  AgentRunEvent,
  ClaimStatus,
  EvidenceClaim,
  ResumeBullet,
  ResumeVersion,
  SourceKind,
  Workspace,
  WorkspaceStage,
} from "@/lib/domain";

type Icon = ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;

const LayoutPanelRight = PanelRight;

const stages: Array<{ id: WorkspaceStage; label: string; note: string; icon: Icon }> = [
  { id: "candidate", label: "Candidate", note: "Facts & sources", icon: UserRound },
  { id: "evidence", label: "Evidence", note: "Review claims", icon: FileCheck2 },
  { id: "target", label: "Target job", note: "Coverage map", icon: BriefcaseBusiness },
  { id: "resume", label: "Resume studio", note: "Draft & proof", icon: PencilLine },
  { id: "export", label: "Export", note: "Validate & ship", icon: Download },
];

const sourceOptions: Array<{ value: SourceKind; label: string }> = [
  { value: "github", label: "GitHub profile" },
  { value: "portfolio", label: "Portfolio" },
  { value: "company", label: "Company site" },
  { value: "job", label: "Job page" },
  { value: "linkedin-export", label: "LinkedIn export" },
  { value: "linkedin-screenshot", label: "LinkedIn screenshot" },
  { value: "resume", label: "Existing resume" },
  { value: "certificate", label: "Certificate" },
  { value: "other", label: "Other source" },
];

const stageCopy: Record<WorkspaceStage, { eyebrow: string; title: string; description: string }> = {
  candidate: { eyebrow: "01 / Candidate", title: "Put the facts in order.", description: "Capture the raw material first. GenForge keeps candidate facts separate from generated wording." },
  evidence: { eyebrow: "02 / Evidence", title: "Review what can be said.", description: "Approve the claims that can survive a source check. Anything else stays out of the final resume." },
  target: { eyebrow: "03 / Target job", title: "Aim at a real role.", description: "Bring one public job page into the workspace and map its requirements to supported evidence." },
  resume: { eyebrow: "04 / Resume studio", title: "Draft with the receipts nearby.", description: "Edit the artifact in context. Proof mode keeps every included bullet tied to its evidence trail." },
  export: { eyebrow: "05 / Export", title: "Ship a version you can defend.", description: "Run deterministic checks, then export the same reviewed content as PDF, DOCX, Markdown, or text." },
};

function classNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function formatDate(value?: string) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

function statusLabel(status: string) {
  return status.replace(/-/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function eventTone(event: AgentRunEvent) {
  if (event.severity === "error") return "error";
  if (event.severity === "warning") return "warning";
  if (event.severity === "success") return "success";
  return "neutral";
}

function AppIcon({ icon: IconComponent, size = 18 }: { icon: Icon; size?: number }) {
  return <IconComponent size={size} strokeWidth={1.8} aria-hidden="true" />;
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return <label className="field"><span className="field-label">{label}</span>{children}{hint ? <span className="field-hint">{hint}</span> : null}</label>;
}

function StatusPill({ status, children }: { status: string; children?: ReactNode }) {
  const tone = status.includes("approved") || status.includes("ready") || status.includes("matched") || status === "completed" || status === "validated" || status === "pass" ? "success" : status.includes("rejected") || status.includes("failed") || status.includes("missing") || status === "fail" ? "danger" : status.includes("partial") || status.includes("confirmation") || status.includes("warn") || status === "running" ? "warning" : "neutral";
  return <span className={`status-pill ${tone}`}><span className="status-dot" />{children || statusLabel(status)}</span>;
}

function EmptyState({ icon: IconComponent, eyebrow, title, description, action }: { icon: Icon; eyebrow: string; title: string; description: string; action?: ReactNode }) {
  return <div className="empty-state"><div className="empty-icon"><AppIcon icon={IconComponent} size={20} /></div><span className="eyebrow">{eyebrow}</span><h3>{title}</h3><p>{description}</p>{action ? <div className="empty-action">{action}</div> : null}</div>;
}

export default function HomePage() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [activeStage, setActiveStage] = useState<WorkspaceStage>("candidate");
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [disclosureOpen, setDisclosureOpen] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [busyAction, setBusyAction] = useState("");
  const [sourceKind, setSourceKind] = useState<SourceKind>("github");
  const [sourceLabel, setSourceLabel] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [jobUrl, setJobUrl] = useState("");
  const [selectedClaimId, setSelectedClaimId] = useState("");
  const [selectedBulletId, setSelectedBulletId] = useState("");
  const [liveEvents, setLiveEvents] = useState<AgentRunEvent[]>([]);
  const workspaceRef = useRef<Workspace | null>(null);
  const saveQueueRef = useRef(Promise.resolve());
  const candidateRevisionRef = useRef(0);
  const candidatePersistedRevisionRef = useRef(0);
  const candidateSaveTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const candidateSaveQueueRef = useRef(Promise.resolve());

  function applyWorkspace(next: Workspace) {
    const local = workspaceRef.current;
    const candidateIsDirty = candidateRevisionRef.current > candidatePersistedRevisionRef.current;
    const resolved = candidateIsDirty && local ? { ...next, candidate: local.candidate } : next;
    workspaceRef.current = resolved;
    window.localStorage.setItem("genforge.workspaceId", resolved.id);
    setWorkspace(resolved);
    setActiveStage(resolved.stage);
    return resolved;
  }

  useEffect(() => {
    const workspaceId = window.localStorage.getItem("genforge.workspaceId");
    if (!workspaceId) return;
    fetch(`/api/workspaces/${workspaceId}`).then(async (response) => {
      if (!response.ok) return;
      const payload = await response.json();
      if (payload.workspace) {
        candidateRevisionRef.current = 0;
        candidatePersistedRevisionRef.current = 0;
        applyWorkspace(payload.workspace as Workspace);
      }
    }).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (workspace) {
      workspaceRef.current = workspace;
      window.localStorage.setItem("genforge.workspaceId", workspace.id);
    }
  }, [workspace]);

  const activeRun = useMemo(() => workspace?.agentRuns.find((run) => run.id === workspace.lastRunId) || workspace?.agentRuns.at(-1), [workspace]);
  const activeResume = useMemo(() => workspace?.resumes.find((resume) => resume.id === workspace.activeResumeId) || workspace?.resumes.at(-1), [workspace]);
  const activeJob = useMemo(() => workspace?.jobs.find((job) => job.id === workspace.activeJobId) || workspace?.jobs.at(-1), [workspace]);
  const activeReport = useMemo(() => workspace?.matchReports.find((report) => report.jobId === activeJob?.id), [activeJob, workspace]);
  const selectedClaim = workspace?.claims.find((claim) => claim.id === selectedClaimId);
  const selectedBullet = activeResume?.sections.flatMap((section) => section.bullets).find((bullet) => bullet.id === selectedBulletId);
  const completedStages = useMemo(() => {
    if (!workspace) return 0;
    return [
      Boolean(workspace.candidate.fullName || workspace.sources.length),
      workspace.claims.some((claim) => claim.status === "approved"),
      Boolean(activeJob && activeReport),
      Boolean(activeResume),
      Boolean(activeResume?.status === "validated" || activeResume?.status === "exported"),
    ].filter(Boolean).length;
  }, [activeJob, activeReport, activeResume, workspace]);

  function clearMessages() {
    setStatusMessage("");
    setErrorMessage("");
  }

  async function createWorkspace(mode: "blank" | "demo") {
    clearMessages();
    setBusyAction(mode);
    try {
      const response = await fetch("/api/workspaces", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not create workspace.");
      candidateRevisionRef.current = 0;
      candidatePersistedRevisionRef.current = 0;
      applyWorkspace(payload.workspace);
      setActiveStage("candidate");
      setStatusMessage(mode === "demo" ? "Demo inputs loaded. The next run will use the live runtime." : "Blank workspace created locally.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not create workspace.");
    } finally {
      setBusyAction("");
    }
  }

  async function patchWorkspace(patch: Partial<Workspace>, message = "Saved locally") {
    const current = workspaceRef.current || workspace;
    if (!current) return;
    const optimistic = { ...current, ...patch } as Workspace;
    workspaceRef.current = optimistic;
    setWorkspace(optimistic);
    const save = async () => {
      try {
        const response = await fetch(`/api/workspaces/${current.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Could not save workspace.");
        applyWorkspace(payload.workspace);
        if (message) setStatusMessage(message);
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "Could not save workspace.");
      }
    };
    saveQueueRef.current = saveQueueRef.current.then(save, save);
    await saveQueueRef.current;
  }

  function updateCandidateDraft(field: keyof Workspace["candidate"], value: string) {
    const current = workspaceRef.current || workspace;
    if (!current) return;
    const revision = candidateRevisionRef.current + 1;
    const candidate = { ...current.candidate, [field]: value, updatedAt: new Date().toISOString() };
    const next = { ...current, candidate, updatedAt: new Date().toISOString() };
    candidateRevisionRef.current = revision;
    workspaceRef.current = next;
    setWorkspace(next);
    if (candidateSaveTimerRef.current) clearTimeout(candidateSaveTimerRef.current);
    candidateSaveTimerRef.current = setTimeout(() => {
      candidateSaveTimerRef.current = undefined;
      const save = async () => {
        try {
          const response = await fetch(`/api/workspaces/${next.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ candidate }) });
          const payload = await response.json();
          if (!response.ok) throw new Error(payload.error || "Could not save candidate facts.");
          candidatePersistedRevisionRef.current = Math.max(candidatePersistedRevisionRef.current, revision);
          if (revision === candidateRevisionRef.current) {
            applyWorkspace(payload.workspace);
            setStatusMessage("Candidate facts saved locally");
          }
        } catch (error) {
          if (revision === candidateRevisionRef.current) setErrorMessage(error instanceof Error ? error.message : "Could not save candidate facts.");
        }
      };
      candidateSaveQueueRef.current = candidateSaveQueueRef.current.then(save, save);
    }, 300);
  }

  async function addSource(event?: React.FormEvent) {
    event?.preventDefault();
    if (!workspace) return;
    clearMessages();
    if (!sourceUrl.trim() && !sourceLabel.trim()) {
      setErrorMessage("Add a public URL or choose a file before saving a source.");
      return;
    }
    setBusyAction("source");
    try {
      const response = await fetch(`/api/workspaces/${workspace.id}/sources`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: sourceKind, label: sourceLabel || sourceUrl, url: sourceUrl || undefined }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not add source.");
      applyWorkspace(payload.workspace);
      setSourceLabel("");
      setSourceUrl("");
      setStatusMessage("Source added. It will be fetched only after a disclosed live run.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not add source.");
    } finally {
      setBusyAction("");
    }
  }

  async function uploadSource(file: File) {
    if (!workspace) return;
    setBusyAction("upload");
    clearMessages();
    try {
      const form = new FormData();
      form.append("kind", sourceKind);
      form.append("label", file.name);
      form.append("file", file);
      const response = await fetch(`/api/workspaces/${workspace.id}/sources`, { method: "POST", body: form });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not save attachment.");
      applyWorkspace(payload.workspace);
      setStatusMessage(`${file.name} saved to local attachments.`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not save attachment.");
    } finally {
      setBusyAction("");
    }
  }

  async function acceptDisclosure() {
    if (!workspace) return;
    const privacyDisclosure = {
      ...workspace.privacyDisclosure,
      version: 1,
      shown: true,
      accepted: true,
      acceptedAt: new Date().toISOString(),
      fieldsSent: ["name", "headline", "summary", "skills", "experience", "education", "projects", "certifications"],
      sourceIds: workspace.sources.map((source) => source.id),
      filesAnalyzed: workspace.sources.filter((source) => source.fileName).map((source) => source.fileName!),
      urlsFetched: workspace.sources.flatMap((source) => source.url ? [source.url] : []),
      provider: "OpenCode Zen",
      textModel: "opencode/deepseek-v4-flash-free",
      imageModel: "opencode/mimo-v2.5-free",
      redactionNote: "Contact details, API keys, raw file contents, and local paths are excluded from model context and logs.",
    };
    await patchWorkspace({ privacyDisclosure }, "Disclosure accepted. Live runs are now available.");
    setDisclosureOpen(false);
  }

  async function startLiveRun() {
    if (!workspace) return;
    clearMessages();
    if (!workspace.privacyDisclosure.accepted) {
      setDisclosureOpen(true);
      return;
    }
    setBusyAction("run");
    try {
      const response = await fetch(`/api/workspaces/${workspace.id}/runs`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ disclosureAccepted: true }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not start live run.");
      applyWorkspace(payload.workspace);
      setLiveEvents([]);
      setStatusMessage("Live run started. Observable activity will appear here.");
      let streamFinished = false;
      const stream = new EventSource(`/api/runs/${payload.run.id}/events`);
      stream.addEventListener("agent", (event) => {
        const next = JSON.parse((event as MessageEvent).data) as AgentRunEvent;
        setLiveEvents((events) => [...events, next]);
      });
      stream.addEventListener("done", async (event) => {
        const result = JSON.parse((event as MessageEvent).data) as { status: string; error?: string };
        streamFinished = true;
        stream.close();
        const refreshed = await fetch(`/api/workspaces/${workspace.id}`);
        if (refreshed.ok) applyWorkspace((await refreshed.json()).workspace);
        setBusyAction("");
        if (result.status === "completed") setStatusMessage("Live run completed. Review the evidence before drafting.");
        else if (result.status === "cancelled") setStatusMessage("Live run cancelled. Saved events and partial work remain available.");
        else setErrorMessage(result.error || "Live run failed. Check the activity panel and retry.");
      });
      stream.onerror = () => {
        if (!streamFinished) setErrorMessage("The activity stream is reconnecting. Saved events remain available, and the browser will resume from the last event.");
      };
    } catch (error) {
      setBusyAction("");
      setErrorMessage(error instanceof Error ? error.message : "Could not start live run.");
    }
  }

  async function cancelLiveRun() {
    const run = activeRun;
    if (!run || run.status !== "running") return;
    try {
      const response = await fetch(`/api/runs/${run.id}/cancel`, { method: "POST" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "This run is no longer active.");
      setStatusMessage("Cancellation requested. The active Pi turn will stop at its next safe boundary.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not cancel the live run.");
    }
  }

  async function updateClaimStatus(claimId: string, status: ClaimStatus) {
    if (!workspace) return;
    setBusyAction(`claim-${claimId}`);
    try {
      const response = await fetch(`/api/evidence/${claimId}/status`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not update claim.");
      applyWorkspace(payload.workspace);
      setSelectedClaimId(claimId);
      setStatusMessage(status === "approved" ? "Claim approved for resume inclusion." : `Claim marked ${statusLabel(status).toLowerCase()}.`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not update claim.");
    } finally {
      setBusyAction("");
    }
  }

  async function discoverJob(event?: React.FormEvent) {
    event?.preventDefault();
    if (!workspace || !jobUrl.trim()) return;
    setBusyAction("job");
    clearMessages();
    try {
      const response = await fetch(`/api/workspaces/${workspace.id}/jobs/discover`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: jobUrl.trim() }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || payload.error || "Could not research job page.");
      applyWorkspace(payload.workspace);
      setJobUrl("");
      setStatusMessage("Public job page captured. Analyze requirements when ready.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not research job page.");
    } finally {
      setBusyAction("");
    }
  }

  async function analyzeJob() {
    if (!workspace || !activeJob) return;
    setBusyAction("analyze-job");
    clearMessages();
    try {
      const response = await fetch(`/api/workspaces/${workspace.id}/jobs/${activeJob.id}/analyze`, { method: "POST" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not analyze requirements.");
      applyWorkspace(payload.workspace);
      setStatusMessage("Requirements analyzed and mapped to transparent coverage.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not analyze requirements.");
    } finally {
      setBusyAction("");
    }
  }

  async function generateResume(template: "ats-classic" | "editorial-minimal") {
    if (!workspace) return;
    setBusyAction("resume");
    clearMessages();
    try {
      const response = await fetch(`/api/workspaces/${workspace.id}/resumes`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ template }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not draft resume.");
      applyWorkspace(payload.workspace);
      setActiveStage("resume");
      setStatusMessage("Resume draft created from approved evidence. Select a bullet to inspect proof.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not draft resume.");
    } finally {
      setBusyAction("");
    }
  }

  function resumeWithBullet(resume: ResumeVersion, bulletId: string, value: string) {
    return {
      ...resume,
      sections: resume.sections.map((section) => ({ ...section, bullets: section.bullets.map((bullet) => bullet.id === bulletId ? { ...bullet, text: value } : bullet) })),
      updatedAt: new Date().toISOString(),
    };
  }

  async function saveBullet(event: FocusEvent<HTMLTextAreaElement>, bullet: ResumeBullet) {
    if (!workspace || !activeResume) return;
    const nextResume = resumeWithBullet(activeResume, bullet.id, event.currentTarget.value);
    const response = await fetch(`/api/resumes/${activeResume.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ resume: nextResume }) });
    const payload = await response.json();
    if (response.ok) {
      applyWorkspace(payload.workspace);
      setStatusMessage("Resume edit saved and checks refreshed.");
    } else setErrorMessage(payload.error || "Could not save resume edit.");
  }

  function exportResume(format: "pdf" | "docx" | "md" | "txt") {
    if (!activeResume) return;
    window.location.assign(`/api/resumes/${activeResume.id}/export?format=${format}`);
  }

  function renderCandidate() {
    if (!workspace) return null;
    const candidate = workspace.candidate;
    return <>
      <div className="split-grid candidate-grid">
        <section className="panel panel-large">
          <div className="panel-heading"><div><span className="eyebrow">Candidate profile</span><h2>The human facts</h2><p>These fields stay under your control. The agent can organize them, not quietly change them.</p></div><StatusPill status={candidate.fullName ? "ready" : "pending"}>{candidate.fullName ? "Profile started" : "Needs input"}</StatusPill></div>
          <div className="form-grid two-col">
            <Field label="Full name"><input value={candidate.fullName} onChange={(event) => updateCandidateDraft("fullName", event.target.value)} placeholder="Your name" /></Field>
            <Field label="Headline" hint="One line, plain language"><input value={candidate.headline} onChange={(event) => updateCandidateDraft("headline", event.target.value)} placeholder="What do you build?" /></Field>
            <Field label="Email"><input type="email" value={candidate.email} onChange={(event) => updateCandidateDraft("email", event.target.value)} placeholder="you@example.com" /></Field>
            <Field label="Phone"><input value={candidate.phone} onChange={(event) => updateCandidateDraft("phone", event.target.value)} placeholder="Optional" /></Field>
            <Field label="Location"><input value={candidate.location} onChange={(event) => updateCandidateDraft("location", event.target.value)} placeholder="City, country or remote" /></Field>
            <Field label="Personal site"><input value={candidate.website} onChange={(event) => updateCandidateDraft("website", event.target.value)} placeholder="https://" /></Field>
          </div>
          <Field label="Professional summary" hint="Optional until you have evidence to support it"><textarea className="textarea-large" value={candidate.summary} onChange={(event) => updateCandidateDraft("summary", event.target.value)} placeholder="A short, factual summary of your direction and strengths." /></Field>
        </section>
        <section className="panel signal-panel"><div className="signal-mark"><AppIcon icon={ShieldCheck} size={20} /></div><span className="eyebrow">Local by default</span><h2>Your data has a boundary.</h2><p>Candidate details, uploads, generated files, and redacted run events live in your local GenForge data directory.</p><button className="text-button" onClick={() => setDisclosureOpen(true)}>Review live-data disclosure <AppIcon icon={ArrowRight} size={15} /></button></section>
      </div>
      <section className="panel source-panel"><div className="panel-heading"><div><span className="eyebrow">Evidence intake</span><h2>Bring the trail together.</h2><p>Add public links or local files. LinkedIn is supported through exports and screenshots only.</p></div><span className="count-label">{workspace.sources.length} sources</span></div>
        <form className="source-form" onSubmit={addSource}><div className="select-wrap"><select value={sourceKind} onChange={(event) => setSourceKind(event.target.value as SourceKind)} aria-label="Source type">{sourceOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select><ChevronDown size={15} /></div><input value={sourceLabel} onChange={(event) => setSourceLabel(event.target.value)} placeholder="Label, e.g. GitHub profile" aria-label="Source label" /><div className="url-field"><Link2 size={16} /><input value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} placeholder="https://public-url.example" aria-label="Public source URL" /></div><button className="button button-primary" type="submit" disabled={busyAction === "source"}><AppIcon icon={Plus} size={16} />Add source</button><label className="button button-quiet upload-button"><Upload size={16} />Upload<input type="file" accept=".pdf,.doc,.docx,.txt,.md,.png,.jpg,.jpeg" onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadSource(file); event.currentTarget.value = ""; }} /></label></form>
        {workspace.sources.length ? <div className="source-list">{workspace.sources.map((source) => <div className="source-row" key={source.id}><div className="source-type"><AppIcon icon={source.url ? Globe2 : FileText} size={16} /></div><div className="source-meta"><strong>{source.label}</strong><span>{source.url || source.fileName || "Local attachment"}</span></div><StatusPill status={source.status} /></div>)}</div> : <div className="source-empty"><CircleDashed size={17} /><span>No evidence sources yet. Start with a public GitHub profile, portfolio, or an existing resume.</span></div>}
      </section>
      <div className="section-footer"><span><LockKeyhole size={15} />Your OpenCode key never enters workspace JSON.</span><button className="button button-primary" onClick={() => setDisclosureOpen(true)}><Play size={15} />Prepare a live run <AppIcon icon={ArrowRight} size={15} /></button></div>
    </>;
  }

  function renderEvidence() {
    if (!workspace) return null;
    const approved = workspace.claims.filter((claim) => claim.status === "approved").length;
    return <>
      <section className="panel evidence-header"><div><span className="eyebrow">Review queue</span><h2>Make the wording earn its place.</h2><p>Generated claims begin as pending. Select one to inspect its sources, then approve, reject, or request confirmation.</p></div><div className="review-counter"><strong>{approved}</strong><span>approved<br />for resume</span></div></section>
      {workspace.claims.length ? <div className="evidence-layout"><section className="claim-list">{workspace.claims.map((claim) => <article className={classNames("claim-card", selectedClaimId === claim.id && "selected")} key={claim.id} onClick={() => setSelectedClaimId(claim.id)}><div className="claim-card-top"><StatusPill status={claim.status} /> <span className="claim-category">{statusLabel(claim.category)}</span></div><h3>{claim.claimText}</h3><div className="claim-foot"><span><Link2 size={14} />{claim.sourceIds.length} source{claim.sourceIds.length === 1 ? "" : "s"}</span><span>{statusLabel(claim.provenance)}</span></div></article>)}</section><section className="panel claim-inspector">{selectedClaim ? renderClaimInspector(selectedClaim) : <EmptyState icon={Search} eyebrow="Proof mode" title="Select a claim to inspect it." description="The source trail will appear here before you make a review decision." />}</section></div> : <section className="panel"><EmptyState icon={FileCheck2} eyebrow="No claims yet" title="Run the live agent to create the review queue." description="GenForge will fetch only the public sources you listed, reconcile the observations, and ask Pi for structured claims. It will not create a fallback output." action={<button className="button button-primary" onClick={startLiveRun}><Play size={15} />Start disclosed live run</button>} /></section>}
    </>;
  }

  function renderClaimInspector(claim: EvidenceClaim) {
    if (!workspace) return null;
    const sources = claim.sourceIds.map((id) => workspace.sources.find((source) => source.id === id)).filter(Boolean);
    return <div className="proof-detail"><div className="proof-detail-head"><div><span className="eyebrow">Proof mode</span><h3>Can this claim travel?</h3></div><StatusPill status={claim.status} /></div><div className="claim-quote">“{claim.claimText}”</div><dl className="proof-facts"><div><dt>Wording</dt><dd>{statusLabel(claim.provenance)}</dd></div><div><dt>Category</dt><dd>{statusLabel(claim.category)}</dd></div><div><dt>Resume inclusion</dt><dd>{claim.includeInResume ? "Allowed" : "Blocked until approved"}</dd></div></dl><div className="source-excerpts"><span className="eyebrow">Linked sources</span>{sources.length ? sources.map((source) => <div className="excerpt-card" key={source!.id}><div className="excerpt-head"><strong>{source!.label}</strong><span>{source!.url || source!.fileName || "Local source"}</span></div><p>{claim.sourceExcerpts[0] || source!.excerpt || "Source excerpt will appear after extraction."}</p></div>) : <p className="muted">No valid source links were attached to this claim. It cannot be included.</p>}</div><div className="review-actions"><button className="button button-primary" disabled={busyAction === `claim-${claim.id}`} onClick={() => void updateClaimStatus(claim.id, "approved")}><Check size={15} />Approve claim</button><button className="button button-secondary" onClick={() => void updateClaimStatus(claim.id, "needs-confirmation")}><CircleAlert size={15} />Needs confirmation</button><button className="button button-danger" onClick={() => void updateClaimStatus(claim.id, "rejected")}><X size={15} />Reject</button></div></div>;
  }

  function renderTarget() {
    if (!workspace) return null;
    return <>
      <section className="panel target-intro"><div><span className="eyebrow">One real target</span><h2>Bring the job page into focus.</h2><p>Paste a public job URL. GenForge will run direct fetch and browser inspection in parallel, then wait for a live Pi analysis before scoring requirements.</p></div><StatusPill status={activeJob ? activeJob.status : "pending"}>{activeJob ? activeJob.title : "No target selected"}</StatusPill></section>
      <form className="job-form" onSubmit={discoverJob}><div className="url-field large"><Link2 size={17} /><input value={jobUrl} onChange={(event) => setJobUrl(event.target.value)} placeholder="https://company.example/jobs/frontend-engineer" aria-label="Public job URL" /></div><button className="button button-primary" type="submit" disabled={busyAction === "job"}><Search size={15} />Research job page</button></form>
      {activeJob ? <><div className="target-summary"><div className="panel job-card"><div className="job-card-head"><div className="company-mark"><BriefcaseBusiness size={18} /></div><div><span className="eyebrow">Target job</span><h2>{activeJob.title}</h2><p>{activeJob.companyName} {activeJob.location ? `· ${activeJob.location}` : ""}</p></div></div><a className="external-link" href={activeJob.url} target="_blank" rel="noreferrer">Open source page <ArrowRight size={14} /></a><div className="job-description">{activeJob.description ? activeJob.description.slice(0, 460) : "Job text is waiting for research."}</div><div className="job-actions"><StatusPill status={activeJob.status} />{activeJob.status !== "analyzed" ? <button className="button button-primary" onClick={() => void analyzeJob()} disabled={busyAction === "analyze-job"}><Sparkles size={15} />Analyze requirements</button> : null}</div></div><div className="panel coverage-card">{activeReport ? <><div className="coverage-number"><strong>{activeReport.coveragePercent}%</strong><span>supported coverage</span></div><div className="coverage-bar"><span style={{ width: `${activeReport.coveragePercent}%` }} /></div><p>{activeReport.explanation}</p><div className="coverage-legend"><span><i className="legend-dot matched" />Matched {activeReport.matchedRequirementIds.length}</span><span><i className="legend-dot partial" />Partial {activeReport.partialRequirementIds.length}</span><span><i className="legend-dot missing" />Missing {activeReport.missingRequirementIds.length}</span><span><i className="legend-dot unsupported" />Unsupported {activeReport.unsupportedRequirementIds.length}</span></div></> : <EmptyState icon={Lightbulb} eyebrow="Coverage map" title="Analyze this job to see requirement coverage." description="The score will describe evidence coverage, not hiring probability." />}</div></div>{activeJob.requirements.length ? <section className="panel requirement-panel"><div className="panel-heading"><div><span className="eyebrow">Requirement map</span><h2>What the role asks for.</h2></div><span className="count-label">{activeJob.requirements.length} requirements</span></div><div className="requirement-list">{activeJob.requirements.map((requirement) => <div className="requirement-row" key={requirement.id}><div><strong>{requirement.text}</strong><span>{statusLabel(requirement.priority)} · {requirement.category}</span></div><StatusPill status={requirement.status}>{statusLabel(requirement.status)}</StatusPill></div>)}</div></section> : null}</> : <section className="panel"><EmptyState icon={BriefcaseBusiness} eyebrow="No public job page" title="A match report needs a real target." description="If a job board blocks discovery, GenForge leaves you with this recoverable URL-needed state instead of inventing a result." /></section>}
    </>;
  }

  function renderResume() {
    if (!workspace) return null;
    if (!activeResume) return <section className="panel resume-start"><div className="template-intro"><span className="eyebrow">Resume studio</span><h2>Choose a page with a proof trail.</h2><p>Drafting is available after at least one evidence claim is approved. The model may shape wording, but every included bullet must retain claim and source IDs.</p></div><div className="template-grid"><button className="template-card" onClick={() => void generateResume("ats-classic")} disabled={!workspace.claims.some((claim) => claim.status === "approved") || busyAction === "resume"}><div className="template-preview classic"><span /><span /><i /><i /><i /></div><strong>ATS Classic</strong><p>Plain hierarchy, dependable parsing, one column.</p><span className="template-action">{workspace.claims.some((claim) => claim.status === "approved") ? "Generate version" : "Approve evidence first"}<ArrowRight size={14} /></span></button><button className="template-card" onClick={() => void generateResume("editorial-minimal")} disabled={!workspace.claims.some((claim) => claim.status === "approved") || busyAction === "resume"}><div className="template-preview editorial"><span /><span /><i /><i /><i /></div><strong>Editorial Minimal</strong><p>More breathing room while staying single-column.</p><span className="template-action">{workspace.claims.some((claim) => claim.status === "approved") ? "Generate version" : "Approve evidence first"}<ArrowRight size={14} /></span></button></div></section>;
    return <><section className="resume-toolbar"><div><span className="eyebrow">{statusLabel(activeResume.template)}</span><h2>{activeResume.title}</h2><p>Last edited {formatDate(activeResume.updatedAt)} · {activeResume.status === "validated" ? "Checks passed" : "Draft needs review"}</p></div><div className="toolbar-actions"><button className="button button-secondary" onClick={() => void patchWorkspace({ stage: "export" })}><ArrowRight size={15} />Open export</button><StatusPill status={activeResume.status} /></div></section><div className="resume-layout"><section className={classNames("resume-paper", activeResume.template)}><div className="resume-header"><h1>{workspace.candidate.fullName || "Untitled candidate"}</h1><p>{workspace.candidate.headline}</p><span>{[workspace.candidate.email, workspace.candidate.phone, workspace.candidate.location].filter(Boolean).join(" · ")}</span></div>{activeResume.sections.map((section) => <div className="resume-section" key={section.id}><h3>{section.title}</h3>{section.body ? <p>{section.body}</p> : null}{section.bullets.filter((bullet) => bullet.included).map((bullet) => <div className={classNames("resume-bullet", selectedBulletId === bullet.id && "selected")} key={bullet.id} onClick={() => setSelectedBulletId(bullet.id)}><span>•</span><textarea defaultValue={bullet.text} aria-label={`Edit ${section.title} bullet`} onFocus={() => setSelectedBulletId(bullet.id)} onBlur={(event) => void saveBullet(event, bullet)} /></div>)}</div>)}</section><section className="panel proof-panel">{selectedBullet ? renderBulletProof(selectedBullet) : <EmptyState icon={Link2} eyebrow="Proof mode" title="Select a bullet." description="GenForge will show the exact claim, source, and provenance behind the wording." />}</section></div></>;
  }

  function renderBulletProof(bullet: ResumeBullet) {
    if (!workspace) return null;
    const claims = bullet.claimIds.map((id) => workspace.claims.find((claim) => claim.id === id)).filter(Boolean);
    const sources = bullet.sourceIds.map((id) => workspace.sources.find((source) => source.id === id)).filter(Boolean);
    return <div className="proof-detail"><div className="proof-detail-head"><div><span className="eyebrow">Proof mode</span><h3>Bullet provenance</h3></div><StatusPill status={bullet.included ? "approved" : "rejected"}>{bullet.included ? "Included" : "Blocked"}</StatusPill></div><div className="claim-quote">“{bullet.text}”</div><div className="proof-stack"><div><span className="eyebrow">Claims</span>{claims.length ? claims.map((claim) => <div className="proof-line" key={claim!.id}><CircleCheck size={15} /><span>{claim!.claimText}</span></div>) : <p className="muted">No claim IDs attached.</p>}</div><div><span className="eyebrow">Sources</span>{sources.length ? sources.map((source) => <div className="proof-line" key={source!.id}><Link2 size={15} /><span>{source!.label}<small>{source!.url || source!.fileName || "Local file"}</small></span></div>) : <p className="muted">No source IDs attached.</p>}</div><div className="provenance-note"><Info size={15} /><span>Wording provenance: {statusLabel(bullet.provenance)}. Editing the sentence keeps the source links visible for review.</span></div></div></div>;
  }

  function renderExport() {
    if (!workspace) return null;
    if (!activeResume) return <section className="panel"><EmptyState icon={Download} eyebrow="No exportable version" title="Finish a reviewed draft first." description="Your final artifact will appear here after a live draft and deterministic validation." action={<button className="button button-primary" onClick={() => setActiveStage("resume")}><PencilLine size={15} />Open resume studio</button>} /></section>;
    const report = activeResume.atsReport;
    return <><section className="panel export-head"><div><span className="eyebrow">Final artifact</span><h2>{activeResume.title}</h2><p>Exports are deterministic renderings of the reviewed resume. The export route never re-asks the model to rewrite your file.</p></div><div className="export-status">{report ? <StatusPill status={report.passed ? "validated" : "warn"}>{report.passed ? "Ready to export" : "Review checks"}</StatusPill> : <StatusPill status="pending">Checks not run</StatusPill>}</div></section><div className="export-layout"><section className="panel checks-panel"><div className="panel-heading"><div><span className="eyebrow">ATS & factuality</span><h2>Quality checks</h2></div><button className="icon-button" aria-label="Refresh checks" onClick={() => void refreshResumeChecks()}><RefreshCw size={16} /></button></div>{report ? <div className="check-list">{report.checks.map((check) => <div className="check-row" key={check.id}><div className={`check-icon ${check.status}`}><AppIcon icon={check.status === "pass" ? Check : check.status === "fail" ? X : CircleAlert} size={15} /></div><div><strong>{check.label}</strong><p>{check.detail}</p></div><StatusPill status={check.status} /></div>)}</div> : <EmptyState icon={CircleDashed} eyebrow="Deterministic check" title="Save an edit to run checks." description="GenForge checks sections, text extraction, contact fields, dates, keywords, and unsupported claims." />}</section><section className="panel export-options"><span className="eyebrow">Download</span><h2>Choose a format.</h2><div className="format-list">{([ ["pdf", "PDF", "Visual handoff and sample artifact", FileText], ["docx", "DOCX", "Editable document", FileText], ["md", "Markdown", "Portable plain structure", BookOpen], ["txt", "Plain text", "ATS-friendly text extract", FileText] ] as const).map(([format, label, description, IconComponent]) => <button className="format-row" key={format} onClick={() => exportResume(format)}><span className="format-icon"><AppIcon icon={IconComponent} size={17} /></span><span><strong>{label}</strong><small>{description}</small></span><Download size={16} /></button>)}</div><p className="export-note"><LockKeyhole size={14} />Only reviewed, included bullets are rendered.</p></section></div></>;
  }

  async function refreshResumeChecks() {
    if (!workspace || !activeResume) return;
    setBusyAction("checks");
    const response = await fetch(`/api/resumes/${activeResume.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ resume: activeResume }) });
    const payload = await response.json();
    if (response.ok) {
      applyWorkspace(payload.workspace);
      setStatusMessage("Deterministic checks refreshed.");
    } else setErrorMessage(payload.error || "Could not refresh checks.");
    setBusyAction("");
  }

  function renderStage() {
    if (activeStage === "candidate") return renderCandidate();
    if (activeStage === "evidence") return renderEvidence();
    if (activeStage === "target") return renderTarget();
    if (activeStage === "resume") return renderResume();
    return renderExport();
  }

  function renderInspector() {
    const events = liveEvents.length ? liveEvents : activeRun?.events || [];
    return <aside className={classNames("inspector", inspectorOpen && "is-open")} aria-label="Agent activity and provenance">
      <div className="inspector-head"><div><span className="eyebrow">Inspector</span><h2>What is happening</h2></div><button className="icon-button inspector-close" onClick={() => setInspectorOpen(false)} aria-label="Close inspector"><X size={17} /></button></div>
      <div className="runtime-card">
        <div className="runtime-status"><span className={classNames("live-dot", activeRun?.status === "running" && "pulsing")} /><strong>{activeRun?.status === "running" ? "Live run in progress" : "Pi / OpenCode Zen"}</strong></div>
        <p>{activeRun?.status === "failed" || activeRun?.status === "cancelled" ? activeRun.error : "Observable activity is saved locally. Hidden reasoning is never shown."}</p>
        {!workspace?.privacyDisclosure.accepted ? <button className="button button-secondary full-width" onClick={() => setDisclosureOpen(true)}><ShieldCheck size={15} />Review privacy boundary</button> : activeRun?.status === "running" ? <button className="button button-secondary full-width" onClick={() => void cancelLiveRun()}><X size={15} />Cancel live run</button> : <button className="button button-primary full-width" onClick={startLiveRun} disabled={busyAction === "run"}><Play size={15} />Start live run</button>}
      </div>
      <div className="activity-section"><div className="activity-heading"><span className="eyebrow">Activity</span>{events.length ? <span>{events.length} events</span> : null}</div>{events.length ? <div className="activity-feed">{events.slice(-12).map((event) => <div className="activity-event" key={event.id}><span className={`activity-icon ${eventTone(event)}`}>{event.severity === "success" ? <Check size={13} /> : event.severity === "error" ? <X size={13} /> : event.severity === "warning" ? <CircleAlert size={13} /> : <Sparkles size={13} />}</span><div><p>{event.message}</p><small>{formatDate(event.createdAt)}</small></div></div>)}</div> : <div className="activity-empty"><CircleDashed size={16} /><span>Run activity will appear here after an explicit live start.</span></div>}</div>
      <div className="inspector-note"><Info size={15} /><p>Sources and claim states are preserved through drafting and export. Your API key is read from the process environment only.</p></div>
    </aside>;
  }

  if (!workspace) return <main className="landing-shell"><div className="landing-top"><div className="brand-lockup"><span className="brand-mark">G</span><span>GenForge</span></div><span className="product-label">Live career agent · local-first</span></div><div className="landing-main"><div className="landing-copy"><span className="eyebrow">A resume should hold up under a question.</span><h1>Make every career claim <em>defensible.</em></h1><p>GenForge gathers your real evidence, researches one real target role, and drafts a resume with the source trail still attached.</p><div className="landing-actions"><button className="button button-primary button-large" onClick={() => void createWorkspace("demo")} disabled={busyAction === "demo"}><Sparkles size={17} />Load demo workspace <ArrowRight size={16} /></button><button className="button button-secondary button-large" onClick={() => void createWorkspace("blank")} disabled={busyAction === "blank"}>Start blank workspace</button></div><div className="landing-trust"><span><ShieldCheck size={15} />Local storage</span><span><Link2 size={15} />Source-backed claims</span><span><LockKeyhole size={15} />No application submission</span></div></div><div className="landing-index"><div className="index-top"><span>Five workspaces</span><span>01—05</span></div>{stages.map((stage, index) => <div className="index-row" key={stage.id}><span className="index-number">0{index + 1}</span><AppIcon icon={stage.icon} size={17} /><div><strong>{stage.label}</strong><span>{stage.note}</span></div><ChevronRight size={15} /></div>)}<div className="index-footer"><CircleDashed size={15} /><span>Live calls start only after disclosure.</span></div></div></div><div className="landing-footer"><span>GenForge mini challenge build</span><span>Pi · OpenCode Zen · Next.js</span></div></main>;

  const copy = stageCopy[activeStage];
  return <div className="app-shell"><aside className="sidebar"><div className="sidebar-brand"><span className="brand-mark">G</span><span>GenForge</span></div><div className="workspace-selector"><span className="workspace-caption">WORKSPACE</span><strong>{workspace.name}</strong><span className="workspace-mode"><span className="tiny-dot" />{workspace.mode === "demo" ? "Synthetic inputs" : "Blank inputs"}</span></div><nav className="stage-nav" aria-label="Workspaces">{stages.map((stage, index) => { const IconComponent = stage.icon; return <button key={stage.id} className={classNames("stage-nav-item", activeStage === stage.id && "active")} onClick={() => { setActiveStage(stage.id); void patchWorkspace({ stage: stage.id }, "Workspace stage saved"); }} aria-current={activeStage === stage.id ? "page" : undefined}><span className="stage-index">0{index + 1}</span><span className="stage-icon"><AppIcon icon={IconComponent} size={17} /></span><span className="stage-text"><strong>{stage.label}</strong><small>{stage.note}</small></span>{completedStages > index ? <Check size={14} className="stage-complete" /> : null}</button>; })}</nav><div className="sidebar-bottom"><div className="progress-caption"><span>Workspace progress</span><strong>{completedStages}/5</strong></div><div className="progress-track"><span style={{ width: `${(completedStages / 5) * 100}%` }} /></div><button className="sidebar-link" onClick={() => setDisclosureOpen(true)}><ShieldCheck size={15} />Privacy boundary</button><button className="sidebar-link" onClick={() => { setWorkspace(null); window.localStorage.removeItem("genforge.workspaceId"); }}><Plus size={15} />New workspace</button></div></aside><main className="workspace-main"><header className="topbar"><div className="topbar-context"><button className="mobile-menu" onClick={() => document.body.classList.toggle("sidebar-open")} aria-label="Toggle navigation"><Menu size={19} /></button><span>GenForge</span><ChevronRight size={14} /><strong>{workspace.name}</strong></div><div className="topbar-actions"><span className="save-state"><span className="tiny-dot" />Saved locally</span><button className="inspector-toggle" onClick={() => setInspectorOpen(true)}><LayoutPanelRight size={16} />Inspector</button></div></header><div className="stage-header"><div><span className="eyebrow">{copy.eyebrow}</span><h1>{copy.title}</h1><p>{copy.description}</p></div><div className="stage-header-actions"><button className="button button-secondary disclosure-button" onClick={() => setDisclosureOpen(true)}><ShieldCheck size={15} />Privacy</button><button className="button button-primary" onClick={startLiveRun} disabled={busyAction === "run"}><Play size={15} />{activeRun?.status === "running" ? "Running live" : "Start live run"}</button></div></div>{statusMessage ? <div className="notice notice-success" role="status"><CircleCheck size={16} />{statusMessage}<button onClick={() => setStatusMessage("")} aria-label="Dismiss saved message"><X size={15} /></button></div> : null}{errorMessage ? <div className="notice notice-error" role="alert"><CircleAlert size={16} />{errorMessage}<button onClick={() => setErrorMessage("")} aria-label="Dismiss error"><X size={15} /></button></div> : null}<div className="stage-content">{renderStage()}</div></main>{renderInspector()}{inspectorOpen ? <button className="drawer-backdrop" aria-label="Close inspector" onClick={() => setInspectorOpen(false)} /> : null}{disclosureOpen ? <div className="modal-backdrop" role="presentation"><section className="disclosure-modal" role="dialog" aria-modal="true" aria-labelledby="disclosure-title"><div className="modal-head"><div className="signal-mark"><ShieldCheck size={20} /></div><button className="icon-button" onClick={() => setDisclosureOpen(false)} aria-label="Close disclosure"><X size={17} /></button></div><span className="eyebrow">Before the first live run</span><h2 id="disclosure-title">You decide what leaves this machine.</h2><p>GenForge will send only the listed candidate fields and selected source context to OpenCode Zen through Pi. Public URLs are fetched directly and inspected in a browser; LinkedIn is never scraped.</p><div className="disclosure-grid"><div><span>Candidate fields</span><strong>{workspace.privacyDisclosure.fieldsSent.join(", ")}</strong></div><div><span>Files</span><strong>{workspace.sources.filter((source) => source.fileName).map((source) => source.fileName).join(", ") || "None yet"}</strong></div><div><span>Public URLs</span><strong>{workspace.sources.filter((source) => source.url).length || "None yet"} listed sources</strong></div><div><span>Stored locally</span><strong>Workspace JSON, attachments, exports, redacted activity</strong></div></div><div className="disclosure-callout"><LockKeyhole size={16} /><span>The app never stores your API key, logs file contents, submits applications, stores credentials, or bypasses CAPTCHAs.</span></div><div className="modal-actions"><button className="button button-secondary" onClick={() => setDisclosureOpen(false)}>Not yet</button><button className="button button-primary" onClick={() => void acceptDisclosure()}><Check size={15} />I understand — enable live runs</button></div></section></div> : null}</div>;
}
