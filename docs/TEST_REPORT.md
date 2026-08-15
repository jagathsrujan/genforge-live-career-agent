# Test report

This file records the release rehearsal for the public-safe repository. The
live provider checks remain intentionally manual because they require the
owner's rotated credential and public research targets.

## Automated checks

| Check | Result | Notes |
|---|---|---|
| `pnpm public:check` | Passed | `Public repository check passed (76 candidate files scanned).` |
| `pnpm typecheck` | Passed | TypeScript completed without diagnostics. |
| `pnpm lint` | Passed | Repository lint check passed. |
| `pnpm test` | Passed | 7 files, 13 tests. |
| `pnpm e2e` | Passed | 2 Playwright workflows, including rapid autosave and export flow. |
| `pnpm build` | Passed | Next.js 15 production build completed. |

## Acceptance tests

- AT-1 happy path: passed through the synthetic Playwright workflow with a
  test-only fake Pi process.
- AT-2 failure/uncertainty path: covered by unit tests for malformed Pi output,
  cancellation, URL safety, and retryable run errors; live provider rehearsal
  remains manual.
- AT-3 persistence/reload path: passed, including rapid multi-field candidate
  entry followed by reload.

## Manual live checks

- Text model smoke test: pending owner credential rotation and live run.
- Image model smoke test: pending owner credential rotation and live run.
- Public URL research: covered by safe-adapter tests; live target rehearsal is
  pending.
- Final synthetic PDF visual review: passed; one-page PDF rendered with a
  synthetic-data watermark.
- Repository personal-data review: passed with the public repository scanner;
  rerun from the committed clean checkout before publication.
