# Public repository checklist

Run this checklist immediately before creating the public GitHub repository.

- [ ] Rotate any OpenCode key previously pasted into chat or a terminal.
- [ ] Confirm `.env.local` is untracked and contains no key committed in history.
- [ ] Run `pnpm public:check` from a clean checkout.
- [ ] Review `git ls-files` for personal names, emails, phone numbers, URLs,
      screenshots, attachments, exports, and local filesystem paths.
- [ ] Confirm all fixtures are synthetic and visibly labeled.
- [ ] Confirm the sample PDF contains synthetic data only.
- [ ] Confirm README links do not require a private account.
- [ ] Enable secret scanning and Dependabot in GitHub repository settings.
- [ ] Verify the app binds to `127.0.0.1` and is not presented as hosted.
- [ ] Record the demo video from a reset synthetic workspace.
- [ ] Rehearse the failure path and persistence path before publishing.
