---
name: dependabot-triage-stale-base
description: Triaging a Dependabot PR with red CI — check branch-point staleness vs recent CI fixes before treating failures as real; a lockfile PR that conflicts after a merge is superseded, not rebased
metadata:
  node_type: memory
  type: feedback
  originSessionId: 46cb1a3e-d5eb-4aa9-8bb7-ef5336a99f85
---

When a Dependabot PR shows failing CI in this repo, **do not assume the bump caused it**. This repo lands CI-infra fixes frequently (e.g. browser-provisioning #253 / `231e7b5`, the one-entry-per-minor matrix refactor `f4b7e23`), and Dependabot branches created *before* such a fix replay the old, broken `ci.yml` — producing false failures unrelated to the dependency.

**Why:** In a 2026-06-20 triage, #256 (codecov-action) and #246 (ts-jest patch) both showed all-integration-fail, but were branched off `9a08733` (pre-#253). Root cause was the #252 browser-extraction regression (`Browser was not found at the configured executablePath`), not the bump. A `@dependabot rebase` onto fixed main turned both fully green (89 pass). By contrast #228 (typescript 6.0) failed the **build** (`TS5011: rootDir must be set`) — a genuine TS6 breaking change that a rebase would NOT fix.

**How to apply:**
1. For each red Dependabot PR, run `git merge-base origin/main <branch>` and check whether it predates recent CI-fix commits (`git merge-base --is-ancestor <fix> <branch>`).
2. Classify the failing CHECK: an `integration`-only failure on a stale branch ≈ stale-base false failure → `gh pr comment <pr> --body "@dependabot rebase"`, then re-check. A `build`/`lint` failure is more likely a real incompatibility → inspect the log (`gh run view <run> --job <job> --log-failed`). Logs older than about 90 days return HTTP 410; reproduce locally in a scratch worktree with `PUPPETEER_SKIP_DOWNLOAD=true npm ci` instead.
3. Green PRs and post-rebase-green PRs merge with `gh pr merge <pr> --rebase --admin` (BLOCKED state is the stale `build (…lts/iron)` required check — see [[bump-puppeteer-merge-mechanics]]).

**Lockfile overlap after a merge (2026-10-27):** two open lockfile PRs can rewrite the same `package-lock.json` entries (jest 30.5.2 in #298 and the brace-expansion security bump in #307 both touched the nested `brace-expansion` copies under `jest-*`). Merging the first makes the second `CONFLICTING`. `@dependabot rebase` does not rebase it then: Dependabot closes it as "Superseded by #312" and opens a fresh PR from `main` carrying only the entries still outdated. The fresh PR needs its own full CI run. Merge overlapping lockfile PRs largest-first, or expect one supersede round per overlap.

**#266 (typescript 7.0.2) is blocked upstream, not stale:** `npm ci` fails with ERESOLVE because ts-jest (29.4.15, the newest release on 2026-10-27) declares `peer typescript@">=4.3 <7"`. The diagnosis is on the PR. Before touching it again, check `npm view ts-jest@latest peerDependencies.typescript`.

Related: the bump procedure itself is in CLAUDE.md § Puppeteer Version Bump Procedure; merge mechanics in [[bump-puppeteer-merge-mechanics]].
