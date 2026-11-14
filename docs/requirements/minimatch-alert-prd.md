---
scope: Development-dependency security alert handling (minimatch, Dependabot alert #91)
created: 2026-11-14
profile: full
formulation: {technical-architecture: complete, integration: complete, security-architecture: complete, testing-architecture: complete}
features: {alert-tracking: {stage: designed, tracks: [technical-architecture, integration, security-architecture, testing-architecture]}}
artifacts: {design-doc: docs/design/minimatch-alert-solution-design.md, design-brief: docs/design/minimatch-alert-brief.md}
dor_status: failed
---

# Development-Dependency Alert Handling: minimatch (Dependabot #91) — Product Requirements Document

**Version**: 1.1
**Created**: 2026-11-14
**Last Updated**: 2026-11-14
**Status**: Draft — ratification pending (captured in autonomous mode; see § 8 and § 12)
**Sources**:
- `S1` — council synthesis, section `## gap-minimatch-alert` (`.tmp/council-20261114T160522Z/synthesis.md`)
- `S2` — council evidence pack E4, E5, E6 (`.tmp/council-20261114T160522Z/evidence.md`)
- `S3` — scope working document, `## Verified facts` (`.tmp/scopes/minimatch-alert.md`, Stage 0, 2026-11-14)
- `S4` — orchestrator-verified facts handed to this stage (dispatch brief, 2026-11-14)
- `S5` — read-only checks run by this stage on 2026-11-14 (`gh api .../dependabot/alerts/91`, `package.json`, `jest.config.js`, `.github/dependabot.yml`)

> **Provenance note.** No person was present during capture. Every requirement below is pipeline-authored: either a council conclusion (`council-added`) or an expansion this stage inferred (`AI-inferred-expansion`). The only owner-confirmed input is the classification of this gap as corrective "Audit findings" work (owner, 2026-11-14). The TL;DR, problem statement, and success criteria are normally the owner's to author; they were composed from the sources and are ratification-pending.

## 1. TL;DR

Dependabot alert #91 (GHSA-g3hv-75wg-m249, medium, "minimatch has potential denial of service via globparts amplification") flags development-only copies of minimatch pulled in by jest and its coverage tooling. Nothing reaches npm consumers. Adding an npm `overrides` entry would clear the alert from the lockfile while jest's `glob@13.0.6`, which bundles its own copy of the matching code, keeps running. The decision is therefore: **no override; keep the alert open; record the decision and an objective close condition in one tracked GitHub issue; close only when upstream releases remove every in-range copy and Dependabot marks the alert fixed.** The deliverable is that tracking issue, not a code change.

## 2. Problem Statement

- **Why this matters.** An open security alert with no recorded disposition looks like neglect to anyone reading the repository, and invites the quick fix (an override) that would hide the alert without removing the code it is about. A dismissed alert would lose the signal entirely. The repository needs a visible, evidence-backed decision that someone can check later.
- **Who has this problem.** The maintainer(s) of `alexey-pelykh/puppeteer-capture` who triage Dependabot alerts and review Dependabot pull requests; secondarily, anyone auditing the repository's security posture.
- **Current state.**
  - Alert #91 is `open`, `dismissed_reason: null`, `fixed_at: null` (S5).
  - Dependabot's automatic security update failed with `security_update_not_possible` (run 43610048301; S2 E5), so no fix PR will arrive from the security-update path.
  - At capture time no tracking issue existed (S3 § Corpus Read: issue tracker swept, no open candidates). The scoping run then filed #338 as the tracking issue.
  - `package.json` carries no `overrides` field today (S5).
- **Evidence.**
  - In-range copies (S2 E6, S3): `minimatch@10.2.6` under `glob@13.0.6` in `@jest/reporters`, `jest-config`, `jest-runtime`; `minimatch@10.2.6` as a direct dependency of `test-exclude@7.0.2`; `minimatch@9.0.9` under `test-exclude`'s own `glob@10.5.0`. Path to `test-exclude`: `jest`/`ts-jest` → `@jest/transform@30.5.2` → `babel-plugin-istanbul@8.0.0` → `test-exclude@7.0.2`.
  - Out of range: `minimatch@11.0.4` (`rimraf` → `glob@14.0.3`) and `minimatch@3.1.5` (eslint tree) (S3).
  - Runtime dependencies are only `async-mutex`, `fluent-ffmpeg`, `which`, and optional `ffmpeg-static`; the published `files` are `lib/**/*`, `LICENSE`, `README.md` (S2 E6). No minimatch copy is shipped.
  - `glob@13.0.6`'s runtime entry `dist/commonjs/index.min.js` requires only Node built-ins and contains `GLOBSTAR`×20, `globParts`×8, `braceExpand`×11: it bundles its own minimatch code (S4).
  - `test-exclude@7.0.2` calls `require('minimatch')` directly (index.js line 5) and uses `glob@10.5.0`, which `require`s `minimatch@9.0.9` at runtime and reads `m.set` / `m.globParts` (glob.js:159-161, ignore.js:59-61) (S3).
  - `collectCoverage: true` in `jest.config.js` and `--coverage` in `npm run test`, so `test-exclude` runs on every test run (S5).
- **Why now, and what doing nothing costs.** The alert was raised on 2026-11-14 and the automatic fix already failed. Doing nothing leaves an unexplained open alert indefinitely and leaves no trigger for noticing when upstream ships the fix. The fix itself cannot be made in this repository: it depends on upstream releases (§ 7).

## 3. Boundaries

- **Appetite**: small batch — one tracking issue's worth of work (decision-and-tracking, not a build). Given by the scope orchestrator.
- **Out of scope, not yet** (each reopens on the named trigger):
  - *Adding an npm `overrides` / `resolutions` entry for minimatch, glob, or test-exclude.* Deferred, not forbidden forever: reopens only on a decision-change trigger in REQ-TRK-B-005.
  - *Upgrading jest / ts-jest / babel-plugin-istanbul ahead of upstream fixes.* No upstream release carries the fix yet (S3: jest latest 30.5.2 still on `glob ^13.0.6`; test-exclude latest 8.0.0 still `minimatch ^10.2.2`; babel-plugin-istanbul latest 8.0.0 still `test-exclude ^7.0.1`). Reopens when any such release ships (REQ-TRK-B-003).
  - *Contributing the fix upstream.* Upstream PRs already exist (§ 7). Reopens only if they stall past the review date in REQ-TRK-B-006.
- **Explicitly not building**:
  - *Dismissing alert #91.* A dismissal erases the signal the close condition depends on (REQ-ALR-C-001).
  - *Handling the sibling deepmerge alert (#89) in this item.* It is gap-deepmerge-alert, scoped separately; this item only cross-links it (REQ-TRK-B-007).
  - *Any change to runtime code, `package.json`, `package-lock.json`, CI workflows, or Dependabot configuration.* None is needed to record the decision.

## 4. Success Criteria

> Composed from the sources in autonomous mode; ratification-pending (owner authors success criteria).

- **Serves**: keeping the repository's security-alert posture accurate and auditable without hiding vulnerable code that still runs.
- **Leading indicators (within two weeks)**:
  - `LI-1` Exactly one open GitHub issue in `alexey-pelykh/puppeteer-capture` records the alert #91 decision, containing every field REQ-TRK-B-001 lists. Meter: open-issue search for `GHSA-g3hv-75wg-m249`; target count = 1.
  - `LI-2` Alert #91 remains `open` with `dismissed_reason: null`. Meter: `gh api repos/alexey-pelykh/puppeteer-capture/dependabot/alerts/91 --jq .state,.dismissed_reason`; target `open` / `null`.
  - `LI-3` `package.json` has no `overrides` or `resolutions` key targeting minimatch, glob, or test-exclude. Meter: `node -p "JSON.stringify({overrides: require('./package.json').overrides ?? null, resolutions: require('./package.json').resolutions ?? null})"`; target `null` for each, or no such key.
- **Lagging indicators (30 / 60 / 90 days)**:
  - `LG-1` Re-check coverage: every merged Dependabot PR that bumps a package on the minimatch paths (jest, `@jest/*`, jest-config, jest-runtime, ts-jest, babel-plugin-istanbul, test-exclude, glob) has a matching re-check comment on the tracking issue. Target: 100% of such merges.
  - `LG-2` Terminal outcome: alert #91 reaches state `fixed` (not `dismissed`) and the tracking issue closes with the close-condition evidence quoted. No date target: it depends on upstream releases. Measurement window: read at every 90-day review (REQ-TRK-B-006); each review that finds it unmet records the upstream PR states, so a stalled upstream is visible within one review period.
- **Decision gates**:
  - `DG-1` If all three clauses of the close condition (REQ-CLS-B-001) hold → close the tracking issue.
  - `DG-2` If any decision-change trigger (REQ-TRK-B-005) fires → reopen the override decision and record the new decision in the issue.
  - `DG-3` If the close condition is still unmet 90 days after the issue is filed → run the review in REQ-TRK-B-006.

## 5. Proposed Solution

One tracking issue carries the whole decision:

1. **File** — the maintainer files one issue stating the decision (no override, alert stays open), the evidence that supports it, the close condition, the re-check triggers, and the triggers that would change the decision. It links alert #91, the upstream PRs, and the sibling deepmerge item.
2. **Re-check** — whenever a Dependabot npm version-update PR touching the jest / test-exclude dependency path merges (weekly cadence, `.github/dependabot.yml`), or an upstream PR in § 7 merges and is released, the maintainer re-runs the close-condition checks and comments the result on the issue.
3. **Close** — when all three clauses hold, the maintainer closes the issue, quoting the command output. Dependabot marks the alert fixed on its own once the lockfile no longer holds an in-range version (assumption A-005).
4. **Change course** — if a decision-change trigger fires, the maintainer records the new decision in the same issue before acting.

Technical design (exact issue wording, labels) belongs to the solution design document.

## 6. Risks and Mitigations

| ID | Risk | Mitigation |
|---|---|---|
| R-1 | Upstream never ships `glob@14` in jest or minimatch 11 in test-exclude; the issue stays open indefinitely. | 90-day review (REQ-TRK-B-006) forces a recorded re-decision rather than silent drift. |
| R-2 | A contributor adds an override to "fix" the alert, hiding it while `glob@13.0.6`'s bundled code keeps running. | Guard requirement REQ-OVR-C-001; the tracking issue states why, and is linkable from review comments. |
| R-3 | Alert is dismissed by mistake, so the `fixed` clause can never be met. | REQ-ALR-C-001; LI-2 meter. A mistaken dismissal is reopened. |
| R-4 | The lockfile clears (clause a) while jest still loads `glob@13.x` with bundled matching code. | Clause (b) of the close condition checks the glob versions jest and test-exclude load, not only minimatch. |
| R-5 | The issue text describes how to trigger the DoS. Repository is public. | REQ-TRK-C-001 limits the description to the advisory's own summary. |
| R-6 | A re-check is skipped after a relevant Dependabot merge. | LG-1 meter; re-check list in REQ-TRK-B-003 names the packages. |

## 7. Dependencies

- **Upstream releases (external, not controllable here)** — state as of 2026-11-14 (S3, S4):
  - jestjs/jest#16556 and jestjs/jest#16530 — move jest to `glob` v14 (`glob` latest 14.0.6 depends on `minimatch ^11.0.5`). Open.
  - jestjs/jest#16557 — Yarn resolution of `test-exclude/minimatch` inside jest's own repository; a root-level resolution that does not reach npm consumers, so it does not by itself fix this repository. Open. It also reports that `glob@13.0.6`'s `processor.d.ts` imports `MMRegExp`, which minimatch 11 removed.
  - istanbuljs/test-exclude#79 — "fix: use patched glob and minimatch versions". Open.
  - A subsequent `babel-plugin-istanbul` release that accepts the fixed `test-exclude` (latest 8.0.0 still pins `test-exclude ^7.0.1`).
- **Dependabot** — weekly npm version updates, `open-pull-requests-limit: 10` (`.github/dependabot.yml`); these PRs are the expected carrier of the fix and the re-check trigger.
- **Sibling item** — gap-deepmerge-alert (alert #89, deepmerge via `jest-config`), scoped separately; likely resolved by the same jest upgrade (S1 context). Cross-link only.
- **GitHub Dependabot alert state machine** — the `fixed` transition is GitHub's, not the maintainer's (A-005).

## 8. Open Questions

| ID | Question | Owner | Default if unanswered |
|---|---|---|---|
| Q-1 | Is the minimatch code bundled inside `glob@13.0.6` itself within the vulnerable range? Its version was not determined (S4 shows the matching code is present, not its version). | Maintainer | Treat as in range; clause (b) requires `glob ≥ 14` regardless. |
| Q-2 | Does GitHub auto-resolve alert #91 to `fixed` once the lockfile has no in-range copy, or does it need a manual action? | Maintainer | Assume auto-resolve (A-005); if not, clause (c) is checked as "not dismissed and no in-range copy" and noted in the closing comment. |
| Q-3 | Ratification of every pipeline-authored requirement and of the decisions in § 12 / the run report (autonomous capture). | Owner | Remain ratification-pending; `dor_status` stays `failed` on check 6 until ratified. |

## 9. Object Model

### Objects

| Object | Identity | Description | Lifecycle |
|---|---|---|---|
| `SecurityAlert` (ALR) | Dependabot alert number (#91) | The GitHub Dependabot alert for GHSA-g3hv-75wg-m249 on `package-lock.json` | `open` → `fixed` (target) · `open` → `dismissed` (forbidden here) |
| `VulnerableCopy` (CPY) | package@version + dependency path | An installed minimatch copy (lockfile) or matching code bundled inside a glob build | `present-in-range` → `absent` (removed or out of range) |
| `TrackingIssue` (TRK) | GitHub issue number (assigned at filing) | The issue recording decision, evidence, close condition, triggers | `filed/open` → `rechecked` (repeats) → `closed` · `open` → `re-decided` (on trigger) |
| `CloseCondition` (CLS) | Embedded in TRK | The three-clause objective test for closing | `unmet` → `met` |
| `DependencyOverride` (OVR) | `package.json` `overrides` key | A forced-resolution entry for minimatch / glob / test-exclude | `absent` (required state) |

### Relationships

| From | To | Type | Cardinality | Navigation |
|---|---|---|---|---|
| TrackingIssue | SecurityAlert | references | 1:1 | issue links alert #91 |
| TrackingIssue | CloseCondition | contains | 1:1 | inline |
| CloseCondition | VulnerableCopy | references | 1:N | clauses (a) and (b) inspect copies |
| CloseCondition | SecurityAlert | references | 1:1 | clause (c) reads alert state |
| DependencyOverride | VulnerableCopy | would mask | N:N | guarded against (REQ-OVR-C-001) |

### CTA inventory

| Object | CTA | Feature | Preconditions | Outcome |
|---|---|---|---|---|
| TrackingIssue | File | alert-tracking | none open for GHSA-g3hv-75wg-m249 | one open issue with all required fields |
| TrackingIssue | Re-check | alert-tracking | issue open; trigger fired | comment with check output |
| TrackingIssue | Close | alert-tracking | CloseCondition met | issue closed with evidence |
| TrackingIssue | Re-decide | alert-tracking | decision-change trigger fired | new decision recorded before action |
| CloseCondition | Evaluate | alert-tracking | — | met / unmet per clause |
| SecurityAlert | Keep open | alert-tracking | condition unmet | alert stays `open` |
| DependencyOverride | Reject | alert-tracking | override proposed while decision stands | not merged |

### Attribute priority

| Object | Attribute | Type | Priority | Display context |
|---|---|---|---|---|
| SecurityAlert | number, GHSA id, state, dismissed_reason | id / enum | Primary | issue header |
| VulnerableCopy | package@version, dependency path, in-range flag | string / bool | Primary | evidence section |
| CloseCondition | clause (a)/(b)/(c) result + command output | bool / text | Primary | re-check comments |
| TrackingIssue | review date | date | Secondary | issue body |

### Feature view and Entity-Feature Matrix

Single feature, `alert-tracking` (fixed name of this PRD's one feature; not added to `features:` frontmatter, which later stages own).

| | alert-tracking | Total CTAs |
|---|---|---|
| TrackingIssue | 4 | 4 |
| CloseCondition | 1 | 1 |
| SecurityAlert | 1 | 1 |
| DependencyOverride | 1 | 1 |
| VulnerableCopy | 0 (read-only) | 0 |
| **Total** | 7 | 7 |

## 10. Requirements

### 10.1 Alert tracking {#feature-alert-tracking}

#### TrackingIssue

**REQ-TRK-B-001 — File one tracking issue** (Event-driven) · Origin: council-added · Confidence: 🟡 ASSUMED
When this scope's work item is executed, the maintainer shall file exactly one GitHub issue in `alexey-pelykh/puppeteer-capture` that records: (1) the decision "no npm override; alert #91 stays open"; (2) the evidence for it — the in-range copies and their dependency paths, the bundled matching code in `glob@13.0.6`, and the absence of any runtime/published exposure; (3) the close condition REQ-CLS-B-001; (4) the re-check triggers REQ-TRK-B-003; (5) the decision-change triggers REQ-TRK-B-005; (6) the review date REQ-TRK-B-006; (7) links to alert #91 and the upstream PRs in § 7.

```
GIVEN no open issue references GHSA-g3hv-75wg-m249
WHEN  the tracking issue is filed
THEN  one open issue exists whose body contains items (1)–(7)
AND   the evidence section names minimatch@10.2.6 (jest-runtime, jest-config, @jest/reporters, test-exclude) and minimatch@9.0.9 (test-exclude → glob@10.5.0)
BUT NOT a second issue for the same alert
BUT NOT any code, package.json, lockfile, or workflow change in the same change set
```

**REQ-TRK-B-002 — Evidence is dated and reproducible** (Ubiquitous) · Origin: AI-inferred-expansion · Confidence: 🟡 ASSUMED
The tracking issue shall state the date of each evidence fact and the command that reproduces it (`npm ls minimatch --all`, `npm ls glob --all`, `gh api repos/alexey-pelykh/puppeteer-capture/dependabot/alerts/91`).

```
GIVEN the tracking issue is filed
WHEN  a reader re-runs each quoted command on main
THEN  the reader can compare current output with the dated output in the issue
BUT NOT undated version claims
```

**REQ-TRK-B-003 — Re-check on relevant change** (Event-driven) · Origin: council-added (trigger set: AI-inferred-expansion) · Confidence: 🟡 ASSUMED
When a pull request that changes the resolved version of jest, `@jest/core`, `@jest/reporters`, `@jest/transform`, `jest-config`, `jest-runtime`, `ts-jest`, `babel-plugin-istanbul`, `test-exclude`, or `glob` merges to `main`, or when one of jestjs/jest#16556, #16530, #16557 or istanbuljs/test-exclude#79 is merged and released, the maintainer shall evaluate REQ-CLS-B-001 and post the result as a comment on the tracking issue.

```
GIVEN the tracking issue is open
WHEN  a Dependabot PR bumping jest to a release that depends on glob ^14 merges
THEN  a comment on the issue quotes `npm ls minimatch --all` and `npm ls glob --all` output from main and states which clauses are met
BUT NOT a re-check skipped because the alert already looks closed
```

**REQ-TRK-B-004 — Close on condition met** (Event-driven) · Origin: council-added · Confidence: 🟡 ASSUMED
When all three clauses of REQ-CLS-B-001 hold on `main`, the maintainer shall close the tracking issue with a comment quoting the command output for each clause.

```
GIVEN clauses (a), (b), (c) all hold
WHEN  the maintainer closes the issue
THEN  the closing comment quotes the output proving each clause
BUT NOT closing while any clause is unmet
BUT NOT closing because the alert was dismissed
```

**REQ-TRK-B-005 — Decision-change triggers** (Unwanted / If-then) · Origin: AI-inferred-expansion · Confidence: 🔴 SPECULATIVE (trigger list is author-chosen; ratification-pending)
If (a) any in-range minimatch copy, or glob code bundling it, becomes reachable from `dependencies`, `optionalDependencies`, or the published `files`; or (b) glob patterns consumed by jest or test-exclude start to come from input outside the repository's own configuration; or (c) the advisory's severity is raised to high or critical; then the maintainer shall reopen the override/upgrade decision and record the new decision and its evidence in the tracking issue before changing any dependency.

```
GIVEN the tracking issue is open with decision "no override"
WHEN  the advisory severity is raised to high
THEN  a comment records a re-decision with evidence before any dependency change merges
BUT NOT a dependency change merged without that recorded re-decision
```

**REQ-TRK-B-006 — Time-boxed review** (State-driven) · Origin: AI-inferred-expansion · Confidence: 🔴 SPECULATIVE (90-day value is author-chosen; ratification-pending)
While the close condition is unmet, the maintainer shall review the decision 90 days after the issue is filed and every 90 days thereafter, recording the upstream PR states and whether the decision stands.

```
GIVEN the issue has been open 90 days with the condition unmet
WHEN  the review date arrives
THEN  a comment records each upstream PR's state and "decision stands" or a re-decision
BUT NOT a silent extension of the review date
```

**REQ-TRK-B-007 — Sibling cross-link** (Ubiquitous) · Origin: AI-inferred-expansion · Confidence: 🟡 ASSUMED
The tracking issue shall cross-link the deepmerge alert #89 tracking item (gap-deepmerge-alert) as a related item likely resolved by the same jest upgrade, and shall not record any decision about alert #89.

**REQ-TRK-C-001 — Public-safe wording** (Constraint) · Origin: AI-inferred-expansion · Confidence: 🟢 VALIDATED (repository is public)
The tracking issue shall describe the vulnerability only by the advisory identifier, severity, and the advisory's own one-line summary ("minimatch has potential denial of service via globparts amplification").

```
GIVEN the issue is drafted
WHEN  its text is reviewed before filing
THEN  the vulnerability is described only by GHSA id, severity, and the one-line summary
BUT NOT any reproduction input, pattern, or exploit description
```

#### CloseCondition

**REQ-CLS-B-001 — Three-clause close condition** (Ubiquitous) · Origin: council-added (clause wording: AI-inferred-expansion) · Confidence: 🟡 ASSUMED
The close condition shall be met only when all of the following hold on `main`:
- **(a)** `npm ls minimatch --all` lists no minimatch version in `>=7.0.0 <11.0.1`;
- **(b)** `npm ls glob --all` lists no glob below `14.0.0` under `jest`, any `@jest/*` package, `jest-config`, `jest-runtime`, or `test-exclude` (so no bundled pre-11 matching code is loaded by jest's or the coverage tooling's glob);
- **(c)** `gh api repos/alexey-pelykh/puppeteer-capture/dependabot/alerts/91 --jq .state` returns `fixed`; or, where (a) and (b) hold and the alert still reads `open` at the next re-check (GitHub did not resolve it by itself, Q-2), the alert is not `dismissed` and the closing comment quotes both outputs and states that this fallback was used. A `dismissed` state never satisfies (c). (Fallback added 2026-11-14 after the Stage 3.7 coverage gate, to match the Q-2 default the design and issue #338 use; ratification-pending.)

```
GIVEN the lockfile on main still contains glob@13.0.6 under @jest/reporters
WHEN  clause (a) passes because minimatch was overridden
THEN  the condition is NOT met (clause (b) fails)
BUT NOT treating a lockfile-only pass as closure
```

Note: glob versions outside jest's and test-exclude's paths (e.g. `glob@7.2.3` in the eslint tree, `minimatch@3.1.5`) are outside the advisory range and outside clause (b). Clause (b)'s value `14.0.0` follows from glob 14 depending on `minimatch ^11.0.5` (S3).

#### SecurityAlert

**REQ-ALR-C-001 — Alert stays open** (State-driven) · Origin: council-added · Confidence: 🟡 ASSUMED
While the close condition is unmet, alert #91 shall remain in state `open`; it shall not be dismissed for any reason, including "tolerable risk" or "inaccurate".

```
GIVEN the close condition is unmet
WHEN  anyone views alert #91
THEN  state = open and dismissed_reason = null
BUT NOT a dismissal recorded as a substitute for the fix
```

#### DependencyOverride

**REQ-OVR-C-001 — No override while the decision stands** (Unwanted / If-then) · Origin: council-added · Confidence: 🟢 VALIDATED (evidence S4: bundled code in glob@13.0.6)
If a change adds an `overrides` (npm) or `resolutions` entry targeting minimatch, glob, or test-exclude while the "no override" decision stands, then the change shall not merge unless a re-decision under REQ-TRK-B-005 is recorded in the tracking issue first.

```
GIVEN the decision "no override" stands
WHEN  a PR adds "overrides": { "minimatch": "^11" } to package.json
THEN  the PR is not merged and the reviewer links the tracking issue
BUT NOT merging because the alert would disappear from the lockfile
```

Rationale (S4): `glob@13.0.6`'s runtime entry requires only Node built-ins and contains the matching code itself, so an override clears the alert from the lockfile while the same code keeps running. Whether an override would also break coverage at runtime is unverified (A-004); the decision does not depend on it.

#### VulnerableCopy

No CTAs: read-only subject of the close condition. Its current inventory is the evidence in § 2 and must be reproduced in the issue per REQ-TRK-B-002.

### 10.2 Quality attributes

**REQ-TRK-Q-001 — Re-check latency** · Origin: AI-inferred-expansion · Confidence: 🔴 SPECULATIVE (ratification-pending)
- TAG: ReCheckLatency
- SCALE: days from a qualifying merge or upstream release (REQ-TRK-B-003) to the re-check comment
- METER: compare merge timestamp (`gh pr view --json mergedAt`) with the comment timestamp on the tracking issue
- GOAL: ≤ 7 days (one Dependabot weekly cycle)
- STRETCH: ≤ 1 day
- PAST: not measured (new)

## 11. State Matrices

N/A — this work produces no data-driven view. The only surfaces are a GitHub issue and a GitHub alert page, whose states GitHub owns; the alert and issue lifecycles are recorded in § 9.

## 12. Assumption Registry

| ID | Assumption | Type | Confidence | Evidence | Validation plan | Risk if wrong |
|---|---|---|---|---|---|---|
| A-001 | Exploiting the DoS requires changing glob patterns in the repository's own configuration, i.e. it already requires code execution in CI. | Threat | 🟡 | Inference from S3/S4: patterns come from jest/coverage config | Confirm no test or config reads patterns from env/PR input when filing | Decision-change trigger (b) fires; override/upgrade decision reopens |
| A-002 | jest and test-exclude will ship releases that move to glob ≥14 / minimatch ≥11. | Upstream | 🟡 | Open PRs jestjs/jest#16556, #16530; istanbuljs/test-exclude#79 (S3) | Re-check per REQ-TRK-B-003; review per REQ-TRK-B-006 | Issue stays open; 90-day review re-decides |
| A-003 | An override would leave `glob@13.0.6`'s bundled matching code running. | Technical | 🟢 | S4: runtime entry requires only Node built-ins; contains GLOBSTAR/globParts/braceExpand | — (verified) | The core rationale for "no override" falls |
| A-004 | An override would break coverage at runtime. | Technical | 🔴 | S3: 11.0.4 keeps `set`/`globParts` types; filters entries; #16557 reports a type-level `MMRegExp` break. Never run. | Not needed for the decision; run `npm test` under an override only if REQ-TRK-B-005 reopens the question | None for this decision (it rests on A-003) |
| A-005 | GitHub marks alert #91 `fixed` automatically once the lockfile has no in-range version. | Platform | 🟡 | General Dependabot behaviour; not observed in this repository | Observe at closure; see Q-2 | Clause (c) needs a fallback wording |
| A-006 | The minimatch code bundled in `glob@13.0.6` is within the vulnerable range. | Technical | 🔴 | Version not determined (Q-1) | Inspect the bundle's origin version if the question becomes load-bearing | Clause (b) may be stricter than needed; no harm to safety |
| A-007 | Nothing in the published package contains minimatch. | Exposure | 🟢 | S2 E6: runtime deps and `files` list | Re-check if dependencies change (trigger (a)) | Trigger (a) fires |

## 13. Feature Completeness

| Feature | Requirement IDs | Object sections | Entity coverage | CTA coverage | Specification depth | Open questions | Verdict |
|---|---|---|---|---|---|---|---|
| alert-tracking | REQ-TRK-B-001…007, REQ-TRK-C-001, REQ-TRK-Q-001, REQ-CLS-B-001, REQ-ALR-C-001, REQ-OVR-C-001 | TrackingIssue, CloseCondition, SecurityAlert, DependencyOverride, VulnerableCopy | 5/5 | 7/7 CTAs specified | 10/12 statements with GWT; REQ-TRK-B-007 is checked by link presence and REQ-TRK-Q-001 by its Planguage METER | 2 (Q-1, Q-2) | NEAR-COMPLETE |

Gap documentation: Q-1 and Q-2 are open; neither blocks filing the issue (defaults stated in § 8). Ratification of pipeline-authored requirements is tracked separately as Q-3.

## 14. Source Traceability

| Req ID | Source | Object | CTA | Feature | Layer | Confidence |
|---|---|---|---|---|---|---|
| REQ-TRK-B-001 | S1 (council conclusion), S2 E4/E6, S3 | TrackingIssue | File | alert-tracking | Behavioral | 🟡 |
| REQ-TRK-B-002 | S3 (dated verified facts) — inferred | TrackingIssue | File | alert-tracking | Behavioral | 🟡 |
| REQ-TRK-B-003 | S1 (close condition), S3 upstream PRs, S5 dependabot.yml | TrackingIssue | Re-check | alert-tracking | Behavioral | 🟡 |
| REQ-TRK-B-004 | S1 | TrackingIssue | Close | alert-tracking | Behavioral | 🟡 |
| REQ-TRK-B-005 | S4 (exposure inference), S2 E4 severity — inferred | TrackingIssue | Re-decide | alert-tracking | Behavioral | 🔴 |
| REQ-TRK-B-006 | inferred (R-1 mitigation) | TrackingIssue | Re-check | alert-tracking | Behavioral | 🔴 |
| REQ-TRK-B-007 | S2 E4/E6 (deepmerge #89), dispatch | TrackingIssue | File | alert-tracking | Interface | 🟡 |
| REQ-TRK-C-001 | dispatch (public repository), S2 E4 summary | TrackingIssue | File | alert-tracking | Constraint | 🟢 |
| REQ-TRK-Q-001 | inferred; S5 dependabot.yml weekly | TrackingIssue | Re-check | alert-tracking | Quality | 🔴 |
| REQ-CLS-B-001 | S1, S3 (glob 14 → minimatch ^11.0.5), S4 | CloseCondition | Evaluate | alert-tracking | Behavioral | 🟡 |
| REQ-ALR-C-001 | S1 ("keep the alert open"), S5 | SecurityAlert | Keep open | alert-tracking | Constraint | 🟡 |
| REQ-OVR-C-001 | S1 ("do NOT add an override"), S4 | DependencyOverride | Reject | alert-tracking | Constraint | 🟢 |

### 14b. Cross-Repository References

| PRD Req | Implementation repo | Spec or item | Status |
|---|---|---|---|
| REQ-TRK-B-001 | alexey-pelykh/puppeteer-capture | #338 (filed 2026-11-14 by the scoping run) | Filed |

## 15. Cross-Cutting and Non-Functional Concerns

### 15.1 Security
- Decision basis: dev-scope, transitive alert with no runtime or published exposure (A-007), exploitable only via the repository's own configuration (A-001, inference).
- Public-repository wording limit: REQ-TRK-C-001.
- No suppression of the signal: REQ-ALR-C-001, REQ-OVR-C-001.
- Escalation path: REQ-TRK-B-005.

### 15.2 Compliance and Regulatory
N/A — no regulated data, accessibility surface, or localisation is involved; the work is a single internal-facing tracking issue on an MIT-licensed developer library.

### 15.3 Reliability and Observability
- The test suite (`npm run test`, coverage on) must stay unchanged by this work: no dependency change is made (§ 3).
- Observability of the decision: alert state (LI-2) and override absence (LI-3) are checkable by command; re-check comments (LG-1) form the audit trail.

### 15.4 Performance and Scalability
N/A — no runtime behaviour changes; the alert concerns development tooling only.

### 15.5 Operational
- Runbook: the re-check commands in REQ-CLS-B-001, run from a clean `npm ci` of `main`.
- Cadence: Dependabot weekly PRs (REQ-TRK-B-003) and the 90-day review (REQ-TRK-B-006).
- Rollback: N/A — nothing is deployed; a wrong decision is corrected by a recorded re-decision in the issue.

### 15.6 Lifecycle
- The tracking issue ends at closure (REQ-TRK-B-004). The "no override" guard (REQ-OVR-C-001) lapses with it.
- No data migration or schema evolution applies.

## 16. Change Log

| Version | Date | Change | Rationale | Impact |
|---|---|---|---|---|
| 1.0 | 2026-11-14 | Initial capture from council synthesis (gap-minimatch-alert), evidence E4–E6, scope verified facts | Stage 1 of `/scope` for one corrective gap; autonomous run | All requirements ratification-pending (Q-3) |
| 1.1 | 2026-11-14 | REQ-CLS-B-001 (c) gains the Q-2 fallback; § 2 and § 14b updated for issue #338 | Stage 3.7 coverage gate found REQ-CLS-B-001 (c) narrower than the design and issue #338 (both use the Q-2 fallback), and two stale "no issue yet" lines | Fallback ratification-pending (decision D-3 on #338) |
| 1.1 | 2026-11-14 | LI-3 meter also reads `resolutions`; LG-2 gains a measurement window | Stage 3.7 round 2 (N-3, N-7) | None on scope |

## Readiness (Definition of Ready) record — 2026-11-14

| Check | Result | Note |
|---|---|---|
| 1 Validated problem statement | PASS (content) | § 2 traces to sources; problem framing composed autonomously, ratification-pending |
| 2 Explicit out-of-scope | PASS | § 3, three deferred + three never items |
| 3 Success and telemetry metrics | PASS | § 4: LI-1..3 leading, LG-1..2 lagging, DG-1..3 gates |
| 4 Cross-cutting concerns | PASS | § 15, every subsection content or N/A with rationale |
| 5 Feature completeness | PASS | § 13, NEAR-COMPLETE with gap documentation |
| 6 Requirement provenance | **FAIL** | Every requirement is pipeline-authored (council-added or AI-inferred-expansion); none ratified by the owner one at a time (autonomous run) |

**Verdict: FAIL** (`dor_status: failed`) — sole cause: check 6, ratification pending. Remediation: owner ratifies (or edits) each requirement and the decisions listed in the run report, then the gate is re-run.
