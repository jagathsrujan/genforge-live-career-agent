# Security policy

GenForge is a local-first application. It is not designed to be exposed to a
public network and does not provide authentication for its local API.

## Do not report secrets in issues

Never include OpenCode keys, screenshots, resumes, workspace JSON, private URLs,
or personal contact details in GitHub issues or pull requests. Revoke any key
that is accidentally exposed and report only the fact that it was exposed.

## Reporting a vulnerability

Use GitHub private vulnerability reporting when it is enabled for the
repository. If that option is unavailable, contact the repository maintainer
privately before opening a public issue. Include a minimal reproduction, the
affected version, and the impact without sending personal data.

## Local safety boundary

- Keep `OPENCODE_API_KEY` in an untracked `.env.local` file.
- Run the app on `127.0.0.1`; do not bind it to a public interface.
- Treat imported files and public URLs as untrusted input.
- Do not use the app to log in, submit applications, bypass CAPTCHAs, or store
  credentials.
