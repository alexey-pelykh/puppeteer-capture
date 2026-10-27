# puppeteer-capture Memory

The puppeteer bump procedure itself lives in the repo: CLAUDE.md § Puppeteer Version Bump Procedure and the `/bump-puppeteer` skill. Memory holds only what those do not say.

- [Merge mechanics](bump-puppeteer-merge-mechanics.md) — every merge is `gh pr merge --rebase --admin`; BLOCKED means the phantom `lts/iron` required checks; the integration matrix is not required
- [One (major, minor) at a time](feedback-puppeteer-bump-one-at-a-time.md) — one combo per commit+release, never skip; exhaust current-major minors before crossing majors
- [Dependabot triage](dependabot-triage-stale-base.md) — red CI is often a stale branch-point, not the bump; a lockfile PR that conflicts after a merge is superseded by a fresh PR, not rebased; #266 (TypeScript 7) is blocked by ts-jest's peer range
