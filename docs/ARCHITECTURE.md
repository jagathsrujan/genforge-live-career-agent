# GenForge architecture

GenForge is a local, desktop-first Next.js application. The browser coordinates
the five-workspace experience; server-owned adapters enforce privacy, storage,
research, AI, and export boundaries.

## System map

```mermaid
flowchart TB
  subgraph Browser[Local browser]
    UI[Candidate / Evidence / Target / Resume / Export]
    Inspector[Activity + provenance inspector]
    UI <--> Inspector
  end

  subgraph Server[Next.js local server]
    Routes[Route handlers]
    Disclosure[Outbound data manifest]
    Storage[Versioned JSON + attachments]
    Research[SSRF-safe research adapters]
    Orchestrator[Workflow orchestrator]
    ATS[Deterministic ATS + factuality checks]
    Exporters[PDF / DOCX / Markdown / text renderers]
  end

  subgraph Agent[Restricted AI boundary]
    RPC[Pi RPC JSONL client]
    Extension[GenForge capability manifest]
    Pi[Pi CLI: no session, no builtin tools]
    Zen[OpenCode Zen]
  end

  UI --> Routes
  Routes --> Disclosure
  Routes --> Storage
  Routes --> Research
  Routes --> Orchestrator
  Orchestrator --> RPC
  RPC --> Extension
  RPC --> Pi
  Pi --> Zen
  Orchestrator --> ATS
  ATS --> Exporters
  Exporters --> Storage
```

## End-to-end sequence

```mermaid
sequenceDiagram
  participant C as Candidate
  participant B as Browser
  participant S as Local server
  participant R as Research adapters
  participant P as Pi RPC
  participant Z as OpenCode Zen

  C->>B: Enter facts and add sources
  B->>S: Save workspace locally
  S-->>B: Actual privacy manifest
  C->>B: Explicitly accept disclosure
  B->>S: Start live run
  S->>R: Fetch public URL + inspect browser page
  R-->>S: Bounded, reconciled observations
  S->>P: Send scoped structured task
  P->>Z: Model request using selected route
  Z-->>P: JSON response
  P-->>S: Correlated RPC result
  S->>S: Zod validation + provenance checks
  S-->>B: Ordered observable events
  C->>B: Approve evidence and edit proof-backed resume
  B->>S: Deterministic validation and export
```

## Ownership boundaries

| Concern | Owner | Why |
| --- | --- | --- |
| Candidate facts | Browser + local storage | The user controls source facts and contact details |
| Upload path and limits | Server storage adapter | Prevents path traversal, symlink traversal, and oversized files |
| Public research | Server adapters | Direct fetch and Playwright inspection are safety-checked and bounded |
| Model routing | Pi RPC client | Makes provider, model, thinking level, timeout, and cancellation observable |
| Structured truth | Zod/domain layer | Invalid model output cannot become a domain object |
| Resume inclusion | Evidence review + ATS validator | Only approved source-backed claims can be included |
| Final files | Deterministic exporters | Export does not ask a model to rewrite content |

## Workspace and recovery model

Workspaces are versioned JSON records. Writes are serialized per workspace and
use a temporary file followed by rename, so an interrupted write cannot leave a
half-written record. Attachments and run JSONL are stored outside the repository
with restrictive file modes.

Runs expose stable event IDs through SSE. A reconnect can send `Last-Event-ID`
to replay missed events in order. Cancellation propagates from the route to an
`AbortController`, then to the Pi RPC client and child process.

Provider errors, blocked or oversized pages, invalid structured output, and
browser failures remain visible and retryable. GenForge never reports a fake
successful AI result to hide an unavailable dependency.

## Public-safe deployment boundary

The app is intentionally not a hosted multi-user service. A public clone gets
the application code and synthetic fixtures, while each user supplies their own
`.env.local`, Pi installation, OpenCode key, and local data directory. The
server binds to loopback by default and the browser never receives the key.
