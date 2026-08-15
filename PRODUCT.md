# GenForge Live Career Agent — Product Contract

## Goal

Give early-career technology candidates a calm, local workspace for turning real experience into a targeted, evidence-backed resume. Every included claim should be traceable to a user-provided or publicly researched source.

## Primary user

An early-career technology candidate who has scattered evidence across a resume, GitHub, portfolio, certificates, LinkedIn exports, and a target job description.

## Desired feeling

Grounded, clear, and in control. The product should feel like a well-made desktop instrument: quiet surfaces, visible state, useful explanations, and no theatrical AI chat.

## Core workflows

1. Capture candidate facts and source links/files.
2. Research public GitHub, company, and job sources with an explicit privacy disclosure.
3. Review evidence claims and approve, reject, or request confirmation.
4. Compare a target job's requirements with supported evidence.
5. Draft, proof, validate, and export a targeted resume.

## Fixed product decisions

- Five workspaces: Candidate, Evidence, Target Job, Resume Studio, and Export.
- Local-first storage with atomic JSON writes and local attachments.
- Live Pi/OpenCode Zen calls are required for live runs; the product never silently substitutes generated mock output.
- Demo mode preloads synthetic inputs only. It still requires a live run to create agent output.
- LinkedIn is supported through user-provided exports or screenshots only; it is never scraped.
- Proof mode connects each resume bullet to evidence, source excerpts, provenance, and review status.
- Unsupported, rejected, and unconfirmed claims cannot be included in a final resume.
- Match scores describe requirement coverage, not hiring probability or model confidence.

## Out of scope for the first release

Cover letters, application tracking, interview preparation, alerts, analytics, credentials, application submission, and multi-agent expansion.

## Constraints

The challenge submission needs a public GitHub repository, README, architecture and design write-up, demo video, and a sample exported PDF. The app is local-only; users provide their own OpenCode Zen key.
