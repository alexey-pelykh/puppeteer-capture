---
name: bump-puppeteer-merge-mechanics
description: Every PR in puppeteer-capture merges with `gh pr merge --rebase --admin`; the repo is rebase-only and branch protection still requires two phantom `build (… lts/iron)` checks
metadata:
  node_type: memory
  type: project
  originSessionId: e4ddffed-cbdf-45c6-aa9d-9cda4bb220b6
---

Every PR in alexey-pelykh/puppeteer-capture merges with `gh pr merge <PR> --rebase --admin`. Verified on the 25.1.0 bump (PR #251) and again on 2026-10-27 on nine Dependabot PRs (#287 to #311).

**Why:** Merge-commit and squash merges are disabled on the repo, so `--merge` and `--squash` fail with "Merge commits are not allowed". Branch protection on `main` requires four status checks: `build (ubuntu-24.04, lts/iron)`, `build (ubuntu-24.04, lts/jod)`, `build (windows-2022, lts/iron)` and `build (windows-2022, lts/jod)`. CI dropped `lts/iron` when Node moved to 22.12+, so the two `lts/iron` checks never run and every PR sits at `mergeStateStatus: BLOCKED`. `enforce_admins` is false and no review is required, so the admin bypass is the normal path. The `integration` matrix is not a required check, so a red integration cell never blocks a merge by itself.

**How to apply:** Snapshot `gh pr checks <PR> --json name,bucket` immediately before merging and require no `pending`, `fail` or `cancel` bucket. Then run `gh pr merge <PR> --rebase --admin`. Read BLOCKED as the phantom checks, not as a verdict on the PR. The 24.x integration regression (issue #252) and its fix (PR #253) are recorded in CLAUDE.md § Testing. See [[dependabot-triage-stale-base]].
