# AI integration and hallucination prevention

## Provider boundary

Pi is launched as a short-lived RPC child process:

```text
pi --mode rpc --no-session --no-builtin-tools \
  --extension scripts/genforge-extension.mjs \
  --provider opencode \
  --model opencode/deepseek-v4-flash-free \
  --thinking max
```

Text evidence, job analysis, and resume drafting use the configured text model.
Image evidence uses the configured image model. The selected model is written as
a concise activity event, never as hidden reasoning.

## Structured output

Each task has a Zod schema. The flow is:

1. Send a task-specific prompt with only the required context.
2. Parse the JSON response and validate it with Zod.
3. If validation fails, send one correction prompt requesting JSON only.
4. If validation fails again, mark the phase failed and show a retry action.

## Evidence rules

- Claims need at least one source ID.
- Source excerpts are copied from extracted or reconciled input.
- Generated wording remains labeled `agent-generated`.
- Pending, rejected, or needs-confirmation claims cannot be included in a final
  resume.
- Resume bullets retain claim IDs and source IDs through editing and export.
- Unsupported claims fail the deterministic factuality check.

## What the model cannot do

Pi cannot edit files, run arbitrary shell commands, log in to sites, submit job
applications, bypass CAPTCHAs, or invent a target job. Research and file access
are performed by server-owned, safety-checked adapters before the model sees
their bounded context.

## Honest failure behavior

Provider errors, quota errors, timeouts, blocked pages, unavailable browser
automation, and invalid model output are visible and retryable. Test-only fake
Pi responses make automated tests deterministic; they are never used as a
product fallback.
