# Contributing to GenForge

Thanks for helping improve GenForge. Keep contributions small, explainable, and
safe to publish.

## Before opening a pull request

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm public:check
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

Run the Playwright suite when changing the workflow or UI. Do not add real
candidate data, API keys, private URLs, uploaded files, or generated personal
documents. Use the synthetic fixtures under `fixtures/synthetic/` instead.

## Pull requests

Describe the user-visible change, privacy implications, failure state, and the
tests you ran. Changes to prompts, models, source boundaries, or evidence rules
must update the relevant documentation under `docs/`.
