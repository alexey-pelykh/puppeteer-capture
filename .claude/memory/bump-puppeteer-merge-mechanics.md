---
name: bump-puppeteer-merge-mechanics
description: Merging a puppeteer bump PR — repo is rebase-only and needs --admin (phantom required checks); the only real required checks are the two build (… lts/jod) jobs, integration matrix is not required
metadata: 
  node_type: memory
  type: project
  originSessionId: e4ddffed-cbdf-45c6-aa9d-9cda4bb220b6
---

How a `/bump-puppeteer` PR actually merges (verified during the 25.1.0 bump, PR #251 → release 1.53.0):

**Merge method = rebase only.** Merge-commit and squash are BOTH disabled on the GitHub repo. The `/bump-puppeteer` command body says `gh pr merge --merge`, which FAILS with "Merge commits are not allowed"; `--squash` also fails. Use **`gh pr merge <PR> --rebase --admin`**. (Explains the linear single-commit history on main.)

**`--admin` is required.** Branch protection lists stale required status checks — `build (ubuntu-24.04, lts/iron)` and `build (windows-2022, lts/iron)` — that the current CI no longer produces (Node was moved to 22.12+, dropping `lts/iron`). So every PR sits `mergeStateStatus: BLOCKED` waiting on phantom checks. `enforce_admins` is false, so admin bypass is the normal path. The **only real required checks are the two `build (… lts/jod)` jobs**; the `integration` matrix is NOT a required check.

**The 24.x integration regression (issue #252) — root cause & fix.** After the 25.1.0 base bump, every puppeteer 24.x integration cell went red. The integration job does `npm ci` (base = current devDep, e.g. 25.1.0), then swaps each matrix version in with `npm install --no-save puppeteer@<v> puppeteer-core@<v>`; browser provisioning is the swapped-in version's job. Root cause: puppeteer **24.x bundles `@puppeteer/browsers@2.13.2`, which on the ubuntu-24.04 runners downloads the Chrome zip but silently fails to extract it** — exit 0, leftover `.zip`, a `chrome/linux-<build>/` dir with **no executable inside** → tests fail "browser was not found". puppeteer 25.x bundles `@puppeteer/browsers@3.x`, which extracts fine — which is exactly why every 25.x cell passed and every 24.x cell failed. **Fixed in PR #253**: run the `npm install --no-save` swap with `PUPPETEER_SKIP_DOWNLOAD=true` (so 24.x's postinstall doesn't leave a partial folder that blocks re-download — `@puppeteer/browsers` has no `--force`), then provision via `npx @puppeteer/browsers@latest install chrome@<build>` + `chrome-headless-shell@<build>` at the version's pinned build (current 3.x extractor instead of 24.x's broken 2.13.2), plus a verification step that fails the job if the executables `executablePath()` points at are missing.

**Earlier misdiagnoses, corrected by #253 (for the record):** it was NOT that the swap "no longer provisions" the old browser, and the WIP attempt (local branch `imp/puppeteer-v25.1.0`, commit `b60822a`) did NOT "no-op on CI because of npx" — npx ran fine, and switching to node-direct CLI invocation no-op'd identically. The single cause was 2.13.2 downloading-without-extracting on the runner. The integration matrix is not a required check, so the regression was non-blocking while open. See [[puppeteer-bump-pattern]].
