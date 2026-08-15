# GenForge decisions

## Challenge

- Build an original end-to-end AI resume generator for the GenForge mini
  challenge.
- Submit a working application, public GitHub repository, README, public demo
  video, and architecture/design write-up.

## Product

- Primary surface: browser-first Next.js and TypeScript.
- Deployment: local-only; the repository is public, but the live application
  is not hosted.
- Hero loop: candidate facts and sources -> reviewed evidence -> target-job
  coverage -> proof-linked resume -> deterministic export.
- Audience: early-career technology candidates with scattered evidence.
- Personal data policy: synthetic data only in the public repository and demo.
- LinkedIn policy: user-provided exports and screenshots only; no scraping.

## AI and trust

- Pi runs through RPC with `--no-session`, `--no-builtin-tools`, and the
  GenForge extension.
- Text defaults to `opencode/deepseek-v4-flash-free` with max thinking.
- Image defaults to `opencode/mimo-v2.5-free` with max thinking.
- All model outputs are Zod-validated. One correction prompt is allowed; a
  second failure is visible and retryable.
- AI may draft wording and ordering, but it cannot add unsupported facts.
- Match scores describe reviewed evidence coverage, not hiring probability.
- Test-only fake Pi responses never run in the product.

## Visual system

- Direction: the quiet instrument panel.
- `DESIGN_VARIANCE`: 4.
- `MOTION_INTENSITY`: 2.
- `VISUAL_DENSITY`: 6.
- Graphite rail, warm neutral canvas, system typography, restrained semantic
  colors, provenance inspector, no gradients or decorative chat UI.

## Public release

- License: MIT.
- Local state, credentials, personal data, run logs, attachments, and generated
  personal documents stay outside Git.
- The release gate is `public:check`, typecheck, lint, unit tests, E2E tests,
  build, and a manual synthetic-data demo rehearsal.
