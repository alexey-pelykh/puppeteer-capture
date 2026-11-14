---
type: requirements-brief
date: 2026-11-14
source: docs/requirements/minimatch-alert-prd.md
workflow: /scope Stage 1 → /capture-requirements (autonomous, no person present)
status: draft
---

# Requirements brief: minimatch alert handling (Dependabot #91)

## Problem being solved

Dependabot alert #91 (GHSA-g3hv-75wg-m249, medium) flags development-only minimatch copies pulled in by jest and its coverage tooling, and Dependabot's automatic fix failed. Nothing reaches npm consumers, but an npm override would clear the alert while jest's `glob@13.0.6` keeps running its own bundled copy of the matching code. The maintainer needs a recorded, evidence-backed decision with a close condition someone can check later.

## Key requirements

1. File exactly one GitHub issue that records the decision (no override, alert stays open), the dated evidence, the close condition, and the triggers (REQ-TRK-B-001, -002).
2. The close condition holds only when all three clauses hold on `main`: no minimatch in `>=7.0.0 <11.0.1` (`npm ls minimatch --all`); no glob below 14 under jest, `@jest/*`, or test-exclude (`npm ls glob --all`); alert #91 state `fixed`, not dismissed — or, if GitHub does not resolve the alert by itself once the first two hold, the alert not dismissed and the closing comment quoting both outputs (REQ-CLS-B-001, fallback added in PRD v1.1).
3. Do not merge an `overrides`/`resolutions` entry for minimatch, glob, or test-exclude unless a re-decision is recorded first (REQ-OVR-C-001).
4. Keep alert #91 open; never dismiss it as a substitute for the fix (REQ-ALR-C-001).
5. Re-check the close condition when a relevant Dependabot PR merges or an upstream fix is released, and close the issue with quoted evidence once it holds (REQ-TRK-B-003, -004).
6. Reopen the decision if a runtime exposure path appears, glob patterns start coming from outside the repo's config, or severity rises to high/critical (REQ-TRK-B-005).
7. Describe the vulnerability only by GHSA id, severity, and the advisory's one-line summary (REQ-TRK-C-001).

## Key decisions

All are ratification-pending (autonomous run).

1. **Full PRD profile, not lean**: kept the object model and feature-completeness sections the readiness gate checks; the work stays small.
2. **Close-condition clause (b) is measured as "no glob below 14.0.0 on the jest / test-exclude paths"**: a lockfile-only test would pass under an override while bundled code still runs.
3. **Close-condition clause (c) requires state `fixed`**, with one fallback: if the first two clauses hold and GitHub has not resolved the alert by itself, the alert must still not be dismissed and the closing comment quotes both outputs. A dismissal never counts as closure.
4. **Decision-change trigger set**: runtime/published exposure, externally sourced glob patterns, severity raised to high or critical.
5. **90-day review cadence while unmet**: prevents silent drift if upstream stalls.
6. **Re-check latency goal ≤ 7 days** (one Dependabot weekly cycle).
7. **Re-check package list**: jest, `@jest/core`, `@jest/reporters`, `@jest/transform`, jest-config, jest-runtime, ts-jest, babel-plugin-istanbul, test-exclude, glob.
8. **deepmerge #89 is cross-linked only, never decided here**: it is a separate gap.
9. **Problem statement, TL;DR, and success metrics were composed from the sources**: normally the owner writes these.

## Assumptions and risks

- 🔴 A-004: an override would break coverage at runtime. Never run; the decision does not rest on it.
- 🔴 A-006: the code bundled in `glob@13.0.6` is in the vulnerable range. Version not determined; clause (b) is safe either way.
- 🟡 A-001: exploiting the issue needs a change to repo config, which means code execution in CI already (inference). Validate by confirming that no pattern comes from env or PR input.
- 🟡 A-002: upstream will ship glob ≥14 / minimatch ≥11 releases. Validated by re-checks and the 90-day review.
- 🟡 A-005: GitHub auto-marks the alert `fixed` once the lockfile clears. Observe at closure.

## Stats

- Objects: 5, Requirements: 12, Acceptance criteria: 10 GWT blocks
- Assumptions: 2 green, 3 yellow, 2 red
- Readiness gate: FAIL on check 6 only (provenance: all requirements pipeline-authored, unratified). Checks 1–5 pass.

## Full requirements document

See [minimatch-alert-prd.md](minimatch-alert-prd.md).
