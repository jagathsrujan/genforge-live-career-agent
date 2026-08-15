# GenForge technical write-up

## Product thesis

Early-career candidates often have enough raw material but not enough time to
turn it into a role-specific, defensible narrative. GenForge treats a resume as
a small evidence system: facts enter first, claims are reviewed second, and
wording is generated only after the source trail is visible.

## AI integration

Pi is used as a constrained model gateway rather than as an autonomous coding
agent. The server prepares bounded context, launches Pi in RPC mode without
sessions or builtin tools, routes text work to DeepSeek, routes image work to
MiMo, and parses each response with a Zod schema. This keeps provider details
observable while keeping file access, network access, and exports under server
control.

## Hallucination prevention

GenForge separates three kinds of provenance: user-provided facts,
agent-discovered observations, and agent-generated wording. A claim must cite a
source ID and excerpt. Claims begin pending; only an approved claim can be
included. Each resume bullet carries claim IDs and source IDs through editing,
proof mode, deterministic checks, and exports. Unsupported inclusion fails the
factuality check rather than being silently rewritten.

## Privacy design

The first live run is gated by a disclosure generated from the actual workspace:
candidate fields, source IDs, file names, public URLs, provider, and models. The
model payload excludes direct contact fields. Logs redact contact details, API
keys, file paths, and raw content. LinkedIn is intentionally limited to files or
screenshots supplied by the user; there is no login, scraping, CAPTCHA bypass,
credential storage, or application submission.

## Design decisions

The interface uses a quiet instrument-panel metaphor: a graphite navigation rail,
warm neutral canvas, crisp dividers, restrained status colors, and a central
task workspace with a provenance inspector. The visual system is deliberately
calm because the product is asking users to make high-trust decisions about
their own career claims. “Proof mode” is the signature interaction: a selected
bullet opens the claim, source, excerpt, and wording provenance beside it.

## Trade-offs

- Local-first storage makes privacy and inspection straightforward, but users
  must install Pi and configure their own provider key.
- Source-backed generation is slower than a free-form chat prompt, but it gives
  the candidate a reviewable stopping point before drafting.
- Public research refuses unsafe redirects and blocked job boards, which means
  a user may need to paste a final job URL manually.
- Deterministic renderers keep exports stable, while model output is limited to
  wording and ordering inside the domain contract.

## Challenge alignment

The implementation delivers a working end-to-end AI resume workflow, public
source and setup documentation, a synthetic demo package, an architecture
diagram, AI integration notes, a design explanation, and deterministic export
artifacts. The public repository boundary is part of the product: personal data
and credentials are intentionally absent from source, fixtures, screenshots,
and generated sample files.
