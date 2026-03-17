# puppeteer-capture Memory

## Puppeteer Version Bump Pattern

See [puppeteer-bump-pattern.md](puppeteer-bump-pattern.md) for the detailed checklist used when a new puppeteer version is released.

## Key Files

- `package.json` — devDeps pin exact versions; peerDeps use `^major.minor.0` ranges
- `.github/workflows/ci.yml` — `PUPPETEER_VERSION` env + integration test matrix
- `.github/workflows/publish.yml` — `PUPPETEER_VERSION` env
