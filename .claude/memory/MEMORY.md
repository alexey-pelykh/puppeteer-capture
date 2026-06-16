# puppeteer-capture Memory

## Puppeteer Version Bump Pattern

See [puppeteer-bump-pattern.md](puppeteer-bump-pattern.md) for the detailed checklist used when a new puppeteer version is released.

See [bump-puppeteer-merge-mechanics.md](bump-puppeteer-merge-mechanics.md) — merge with `gh pr merge --rebase --admin` (NOT `--merge`); 24.x integration regression (#252) = 24.x's bundled `@puppeteer/browsers@2.13.2` failing to extract Chrome on the CI runners, fixed in PR #253.

## Key Files

- `package.json` — devDeps pin exact versions; peerDeps use `^major.minor.0` ranges
- `.github/workflows/ci.yml` — `PUPPETEER_VERSION` env + integration test matrix
- `.github/workflows/publish.yml` — `PUPPETEER_VERSION` env

## Feedback

See [feedback-puppeteer-bump-one-at-a-time.md](feedback-puppeteer-bump-one-at-a-time.md) — one (major, minor) per commit+release, never skip; exhaust current-major minors before crossing majors
