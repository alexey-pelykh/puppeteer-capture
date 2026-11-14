# Solution Design: Development-Dependency Alert Handling — minimatch (Dependabot #91)

**Created**: 2026-11-14
**Source PRD**: [`docs/requirements/minimatch-alert-prd.md`](../requirements/minimatch-alert-prd.md) (designed against version 1.0; now 1.1, `dor_status: failed`)
**Design brief**: [`minimatch-alert-brief.md`](minimatch-alert-brief.md)
**Workflow**: `/scope` Stage 2 → `/design-solution`, autonomous run (no person present)
**Status**: Draft — not locked. Every decision below is ratification-pending; see § 14.3 for why the design cannot lock in this run.
**Baseline**: `main` at `185a1ad`; read-only checks in this document ran on 2026-11-14 between 19:30Z and 19:40Z against the main checkout's installed `node_modules` (npm 11.20.0).

> **What this design builds.** Not code. It designs one GitHub issue and the small, repeatable procedures around it: how the close condition is checked, when it is re-checked, how a change of decision is recorded, and how the two "don't hide the signal" rules are kept. Nothing in `package.json`, `package-lock.json`, CI workflows, or Dependabot configuration changes.

> **Public repository.** The vulnerability is named only by its advisory id GHSA-g3hv-75wg-m249, severity medium, and the advisory's one-line summary: "minimatch has potential denial of service via globparts amplification". No other description appears here or in the issue.

---

## 1. Goals and Drivers

**Goals** (from PRD § 1, § 4, § 5):

- G-1: The open alert #91 has one visible, evidence-backed disposition that anyone can re-check (LI-1).
- G-2: The signal is not hidden: the alert stays open and no npm override masks it while vulnerable code still runs (LI-2, LI-3).
- G-3: There is an objective, command-checkable close condition, and a re-check happens each time something relevant changes (LG-1, LG-2, DG-1).
- G-4: The decision is revisited on purpose, not by drift: named triggers reopen it, and a 90-day review forces a recorded verdict (DG-2, DG-3).

**Drivers**:

- Dependabot's own security update failed (`security_update_not_possible`), so no fix PR will come from that path (PRD § 2).
- An override would clear the alert while `glob@13.0.6` keeps running its bundled matching code. Verified again on 2026-11-14: `glob@13.0.6` declares `"minimatch": "^10.2.2"` in its `package.json` under `@jest/reporters`, `jest-config`, and `jest-runtime`, so the lockfile carries a minimatch copy an override would replace, while its runtime entry bundles the matching code itself (PRD S4).
- The fix lives upstream. On 2026-11-14 all four upstream PRs were open: `gh pr view <n> -R <repo> --json state` printed `16556 OPEN`, `16530 OPEN`, `16557 OPEN` (jestjs/jest) and `79 OPEN` (istanbuljs/test-exclude).

**Success criteria**: PRD § 4 (LI-1…3, LG-1…2, DG-1…3), carried unchanged. They are ratification-pending in the PRD.

## 1b. Non-Goals

- Adding an npm `overrides` / `resolutions` entry (deferred; reopens only through § 4 C4).
- Upgrading jest, ts-jest, or babel-plugin-istanbul ahead of upstream fixes.
- Contributing the fix upstream (PRs already exist).
- Dismissing alert #91.
- Deciding anything about the deepmerge alert #89. That is the sibling item, now tracked in issue [#332](https://github.com/alexey-pelykh/puppeteer-capture/issues/332). This design only links to it.
- Any automation (CI job, scheduled workflow, bot) for the checks below. PRD § 3 excludes workflow changes; § 12b records automation as a rejected alternative with its reopen trigger.

## 2. Constraints

| ID | Constraint | Source |
|---|---|---|
| CON-1 | No change to runtime code, `package.json`, `package-lock.json`, CI workflows, or Dependabot configuration. | PRD § 3 |
| CON-2 | Public repository: the vulnerability is described only by GHSA id, severity, and the one-line summary. | REQ-TRK-C-001 |
| CON-3 | Appetite: one tracking issue's worth of work. | PRD § 3 |
| CON-4 | Exactly one issue for alert #91. | REQ-TRK-B-001 |
| CON-5 | The `fixed` transition of a Dependabot alert belongs to GitHub, not the maintainer. | PRD § 7, A-005 |
| CON-6 | Reading alert #91 through the REST API needs a token that can read the repository's Dependabot alerts (the maintainer's). Contributors without that access cannot run clause (c). | GitHub permission model; observed: the maintainer's `gh` session read alert #91 on 2026-11-14 |
| CON-7 | The design does not rest on whether an override would break coverage at runtime. That claim is unverified (A-004). The claim that minimatch 11 changed the declared shape of `set` / `globParts` is not supported by the declared types and is not used. | Scope working doc § Verified facts |

## 3. Context and Scope

**System boundary.** The "system" is a maintenance procedure owned by the repository maintainer. Its parts are one GitHub issue, the commands that evaluate it, and the maintainer's habits around Dependabot merges.

**External systems it reads** (all read-only from this design's side):

| System | What is read | How |
|---|---|---|
| GitHub Dependabot alerts | alert #91 `state`, `dismissed_reason`, `security_advisory.severity` | `gh api repos/alexey-pelykh/puppeteer-capture/dependabot/alerts/91` |
| npm installed tree on `main` | which minimatch / glob copies are installed and where | `npm ls … --all` (evidence) and `npm query` selectors (pass/fail), after `npm ci` |
| Upstream PRs | merge state of jestjs/jest#16556, #16530, #16557 and istanbuljs/test-exclude#79 | `gh pr view <n> -R <repo> --json state,mergedAt` |
| npm registry | whether a release on the path now depends on glob ≥ 14 / minimatch ≥ 11.0.1 | `npm view <pkg> dependencies` |
| This repository's merged Dependabot PRs | which merges touched the minimatch paths (re-check triggers) | `gh pr list --state merged --author app/dependabot --search "<pkg> in:title"` |

**Writes**: issue body and comments only (filing, re-checks, re-decisions, reviews, closure). In this design run, nothing is written to GitHub; filing happens at Stage 3 or later.

**In-range copies at baseline** (`npm query '#minimatch:semver(>=7.0.0 <11.0.1)'`, 2026-11-14): five — `10.2.6` at `@jest/reporters`, `jest-config`, `jest-runtime`, `test-exclude`; `9.0.9` at `test-exclude/node_modules/glob`. Out of range: `11.0.4` (rimraf → glob 14.0.3), `3.1.5` (root, eslint tree).

## 4. Solution Strategy

**Core decision (ADR-MM-1, § 12):** no npm override; alert #91 stays open; one tracking issue records the decision, the dated evidence, a three-clause close condition, re-check triggers, decision-change triggers, and a review date. The issue closes only when upstream releases remove every in-range copy and GitHub marks the alert `fixed`.

**Shape of the solution: an issue-anchored manual protocol.** One issue is the single record. Every later event (re-check, re-decision, review, closure) is a comment on that issue with a fixed template, so the comment history is the audit trail (PRD § 15.3). Checks are commands with mechanical pass predicates, so a re-check is reproducible by anyone with the right access and does not depend on judgment except where a trigger is inherently a judgment (decision-change trigger (b)).

**Why manual, not automated.** CON-1 rules out a workflow. The event rate is low: on 2026-11-14 `gh pr list --state merged --author app/dependabot --search "jest in:title" --limit 5` returned five path-relevant merges (jest, ts-jest) dated 2026-06-20 to 2026-11-14, about one a month. The query was capped at five, so this is the recent rate, not a full count. A manual protocol fits that rate. § 12b records the automated alternative and the signal that would reopen it.

**Pattern borrowed from the project.** The sibling item #332 (filed 2026-11-14T19:36:47Z, labels `dependencies`, `priority: low`, `area: security`) uses an issue body with **Why / What / How / Necessity / Invalidated if** headings, an evidence table of command → output, and a dated retrieval note per external source. This design follows that shape so the two dependency-alert items read alike (§ 12, ADR-MM-6).

## 5. Building Blocks

### 5.1 Components

| ID | Component | Responsibility | Requirements served |
|---|---|---|---|
| C1 | Tracking Issue | The single record: title, labels, and a body holding decision, evidence, close condition, triggers, review date, links | REQ-TRK-B-001, -002, -007, REQ-TRK-C-001 |
| C2 | Close-Condition Evaluator | Three commands with mechanical pass predicates; fail-closed on error | REQ-CLS-B-001, REQ-TRK-B-004 |
| C3 | Re-check Protocol | When to re-check, what a re-check comment contains, how fast | REQ-TRK-B-003, REQ-TRK-Q-001 |
| C4 | Decision-Change Monitor and Re-decision Record | Three trigger checks run inside every re-check and review; a fixed re-decision comment format recorded before any dependency change | REQ-TRK-B-005 |
| C5 | Periodic Review | Absolute review date in the issue; review comment every 90 days while unmet; sweep for skipped re-checks | REQ-TRK-B-006, LG-1 |
| C6 | Signal Guards | No-override guard (review-time) and no-dismissal guard, each with a meter | REQ-OVR-C-001, REQ-ALR-C-001 |

C1 is the container; C2–C6 are procedures whose outputs land as comments on C1. There is no shared state outside the issue and GitHub's own alert record.

### 5.2 C1 — Tracking Issue

**Title** (ADR-MM-6): `(chore) Track Dependabot alert 91 (minimatch, GHSA-g3hv-75wg-m249) until upstream ships the fix`

**Labels** (ADR-MM-7): `dependencies`, `area: security`, `area: testing`, `priority: low`. All four exist in the repository (`gh label list`, 2026-11-14).

**Body sections, in order** (each maps to a REQ-TRK-B-001 item):

| # | Heading | Content | REQ-TRK-B-001 item |
|---|---|---|---|
| 1 | **Why** | Alert #91 is open, Dependabot's security update failed, and nothing records why the alert stays open. Advisory named only by id, severity, one-line summary. | context |
| 2 | **Decision** | "No npm override; alert #91 stays open; this issue closes only when the close condition holds." One sentence on why: an override clears the lockfile while `glob@13.0.6` keeps running bundled matching code. | (1) |
| 3 | **Evidence** | Table: fact · command · output · date. Rows: in-range copies with their paths (`npm ls minimatch --all`), glob versions on the jest / test-exclude paths (`npm ls glob --all`), `glob@13.0.6` declares `minimatch ^10.2.2` and its runtime entry bundles the matching code, no copy in the production tree (`npm query '.prod:is(#minimatch, #glob, #test-exclude)'` → `[]`), published `files` are `lib/**/*`, `LICENSE`, `README.md`, alert state. Every row dated. | (2), REQ-TRK-B-002 |
| 4 | **Close condition** | The three clauses of C2 with their commands and pass predicates, verbatim from § 5.3. | (3) |
| 5 | **Re-check triggers** | Package list and upstream PR list of C3, plus the re-check comment template. | (4) |
| 6 | **Decision-change triggers** | The three triggers of C4 and the rule "record the re-decision here before any dependency change". | (5) |
| 7 | **Review date** | Absolute date, filing date + 90 days, and "every 90 days thereafter while unmet". | (6) |
| 8 | **Links** | Alert: https://github.com/alexey-pelykh/puppeteer-capture/security/dependabot/91 · Upstream: https://github.com/jestjs/jest/pull/16556, https://github.com/jestjs/jest/pull/16530, https://github.com/jestjs/jest/pull/16557, https://github.com/istanbuljs/test-exclude/pull/79 · Related, not decided here: #332 (deepmerge alert 89). | (7), REQ-TRK-B-007 |
| 9 | **Invalidated if** | Any decision-change trigger fires (points to section 6). | mirrors #332 |

All URLs above were pulled with `gh pr view … --json url`, `gh api …/alerts/91 --jq .html_url`, and `gh issue view 332 --json url` on 2026-11-14.

**Wording rule** (REQ-TRK-C-001): before filing, the drafter reads the body against one test: the vulnerability appears only as `GHSA-g3hv-75wg-m249`, `medium`, and the quoted one-line summary. No pattern, input, or mechanism. Package names, versions, and paths are allowed: they describe exposure, not exploitation.

**Duplicate check before filing** (CON-4): `gh issue list -R alexey-pelykh/puppeteer-capture --state open --search "GHSA-g3hv-75wg-m249"` must print nothing. On 2026-11-14 it printed `[]`.

### 5.3 C2 — Close-Condition Evaluator

Run from a clean `npm ci` of `main`. `npm query` reads the installed tree, so a stale or missing `node_modules` gives a wrong answer (§ 11.3).

| Clause | Pass predicate | Command (pass/fail) | Evidence command quoted beside it (REQ-TRK-B-002) | Baseline 2026-11-14 |
|---|---|---|---|---|
| (a) | no minimatch in `>=7.0.0 <11.0.1` | `npm query '#minimatch:semver(>=7.0.0 <11.0.1)' \| jq length` prints `0` | `npm ls minimatch --all` | 5 entries — **unmet** |
| (b) | no glob below `14.0.0` under jest, any `@jest/*`, `jest-config`, `jest-runtime`, or `test-exclude` | `npm query ':is(#jest, #jest-config, #jest-runtime, #test-exclude, [name^="@jest/"]) #glob:semver(<14.0.0)' \| jq length` prints `0` | `npm ls glob --all` | 4 entries (`13.0.6` ×3, `10.5.0` under test-exclude); root `glob@7.2.3` correctly excluded — **unmet** |
| (c) | alert state `fixed` | `gh api repos/alexey-pelykh/puppeteer-capture/dependabot/alerts/91 --jq .state` prints `fixed` | same command with `--jq '{state, dismissed_reason}'` | `open` — **unmet** |

**Met** only when all three pass. **Fail-closed**: if any command exits non-zero, prints an error, or prints something other than a number (a, b) or a state word (c), that clause is recorded as **unknown**, which counts as unmet.

**Clause (c) fallback** (PRD Q-2 default, A-005): if (a) and (b) pass and the alert still reads `open` at the next re-check, the maintainer records clause (c) as "not dismissed and no in-range copy" with both outputs quoted, closes the issue citing this fallback, and notes that GitHub did not auto-resolve. A `dismissed` state never satisfies (c).

**Why `npm query` in addition to `npm ls`** (ADR-MM-3): the PRD names `npm ls … --all` for evidence. Its tree output needs a human to tell the root `glob@7.2.3` (eslint tree, outside clause (b)) from the jest-path globs. The `npm query` selectors turn each clause into a count that must be zero. Both selectors were run on 2026-11-14 and returned exactly the copies listed in PRD § 2, so they encode the PRD's clauses rather than new ones.

### 5.4 C3 — Re-check Protocol

**Trigger events** (REQ-TRK-B-003):

1. A PR merges to `main` that changes the resolved version of any of: `jest`, `@jest/core`, `@jest/reporters`, `@jest/transform`, `jest-config`, `jest-runtime`, `ts-jest`, `babel-plugin-istanbul`, `test-exclude`, `glob`.
2. One of jestjs/jest#16556, #16530, #16557, or istanbuljs/test-exclude#79 merges **and** a release containing it is published.

**How triggers are noticed** (ADR-MM-4): the maintainer subscribes to the four upstream PRs on GitHub (a personal notification setting, not a repository change) and treats every Dependabot merge whose title names a listed package as a trigger. C5's sweep catches any merge that was missed.

**Re-check comment template** (one comment per trigger):

```markdown
### Re-check — <YYYY-MM-DD> — trigger: <PR #n merged | upstream <repo>#<n> released as <pkg>@<version> | scheduled review>
`main` at <short sha>, after `npm ci`.

| Clause | Command | Output | Result |
|---|---|---|---|
| (a) | npm query '#minimatch:semver(>=7.0.0 <11.0.1)' \| jq length | <n> | met / unmet / unknown |
| (b) | npm query '…#glob:semver(<14.0.0)' \| jq length | <n> | met / unmet / unknown |
| (c) | gh api …/alerts/91 --jq .state | <state> | met / unmet / unknown |

<details><summary>Evidence: npm ls minimatch --all · npm ls glob --all</summary>

<both outputs, pasted unedited>

</details>

Decision-change triggers: (a) <none / fired: evidence> · (b) <none / fired> · (c) severity = <value>
Upstream PRs: 16556 <state> · 16530 <state> · 16557 <state> · test-exclude#79 <state>
Verdict: <condition unmet — decision stands | condition met — closing | trigger fired — see re-decision below>
```

`<short sha>` comes from `git rev-parse --short HEAD`; dates come from `date -u +%F`. The template carries no description of the vulnerability.

**Latency** (REQ-TRK-Q-001): goal ≤ 7 days from merge or release to comment (one Dependabot weekly cycle); stretch ≤ 1 day. Meter: `gh pr view <n> --json mergedAt` against the comment's timestamp.

**Rule**: a re-check is never skipped because the alert already looks closed (REQ-TRK-B-003 BUT NOT).

### 5.5 C4 — Decision-Change Monitor and Re-decision Record

**Trigger checks, run inside every re-check and every review:**

| Trigger (REQ-TRK-B-005) | Check | Fires when |
|---|---|---|
| (a) in-range minimatch, or glob code bundling it, becomes reachable from `dependencies`, `optionalDependencies`, or published `files` | `npm query '.prod:is(#minimatch, #glob, #test-exclude)' \| jq length` (prints `0` at baseline) and `npm pack --dry-run` file list contains nothing outside `lib/`, `LICENSE`, `README.md`, `package.json` | the count is above zero, or the packed file list gains a dependency tree |
| (b) glob patterns consumed by jest or test-exclude come from input outside the repository's own configuration | read `jest.config.js` and the `test` script: patterns come only from the committed config (at baseline: no `collectCoverageFrom`, defaults only) and from CLI arguments the repository's own scripts set | a config or script starts reading patterns from environment variables, PR content, or other external input |
| (c) advisory severity raised to high or critical | `gh api repos/alexey-pelykh/puppeteer-capture/dependabot/alerts/91 --jq .security_advisory.severity` (prints `medium` at baseline) | the value is `high` or `critical` |

Trigger (b) is a reading, not a command; it is the only judgment-based check in the protocol, and the re-check comment records what was read.

**Re-decision record** — posted as a comment **before** any dependency change merges:

```markdown
### Re-decision — <YYYY-MM-DD> — trigger (<a|b|c>) fired
Evidence: <command and output, or the config lines read>
Options considered: <keep "no override" | targeted upgrade | override (with A-004 run: `npm test` under the override) | other>
New decision: <…>   Decided by: <maintainer>
Effect on this issue: <stays open with new decision | close condition revised to …>
```

A re-decision that adopts an override must state how it handles the bundled code in `glob@13.0.6`, because that is the reason the current decision exists (ADR-MM-1).

### 5.6 C5 — Periodic Review

- **Review date**: written into the issue body as an absolute date at filing time: filing date + 90 days, computed with `date -u -v+90d +%F` (macOS) or `date -u -d '+90 days' +%F` (Linux). Each review comment states the next date. Never extended silently (REQ-TRK-B-006 BUT NOT).
- **Review comment** = the C3 re-check template, with trigger "scheduled review", plus a **skipped re-check sweep**: `gh pr list -R alexey-pelykh/puppeteer-capture --state merged --author app/dependabot --search "<pkg> in:title" --json number,title,mergedAt` for each package in C3's list, filtered to merges after the filing date, each matched to a re-check comment. An unmatched merge is re-checked in the same comment and noted as a miss (LG-1 meter).
- **Verdict line**: "decision stands" or a link to a C4 re-decision.

### 5.7 C6 — Signal Guards

| Guard | Rule | Where it acts | Meter |
|---|---|---|---|
| No-override (REQ-OVR-C-001) | A change adding `overrides` or `resolutions` targeting minimatch, glob, or test-exclude does not merge unless a C4 re-decision is on the issue first. | PR review: the reviewer links the tracking issue and requests changes. | `node -p "JSON.stringify({overrides: require('./package.json').overrides ?? null, resolutions: require('./package.json').resolutions ?? null})"` prints `null` for each, or no such key (LI-3); both `null` on 2026-11-14 |
| No-dismissal (REQ-ALR-C-001) | Alert #91 is never dismissed while the condition is unmet. A mistaken dismissal is reopened and noted on the issue. | GitHub alert page / API. | `gh api …/alerts/91 --jq '[.state, .dismissed_reason]'` prints `["open", null]` (LI-2) |

The no-override guard is review-time only (ADR-MM-2). It relies on the issue being findable from a review, which C1's title and the GHSA id make true.

### 5.8 Entity model

The entities are the PRD's object model (§ 9), unchanged. GitHub stores all of them; this design owns no schema.

| Entity (canonical) | Stored by | Component that reads or writes it |
|---|---|---|
| SecurityAlert | GitHub Dependabot | C2 (clause c), C4 (trigger c), C6 |
| VulnerableCopy | npm installed tree / lockfile | C2 (clauses a, b), C4 (trigger a) |
| TrackingIssue | GitHub Issues | C1 (writes), C3, C4, C5 (comment) |
| CloseCondition | embedded in TrackingIssue body | C2 |
| DependencyOverride | `package.json` (required absent) | C6 |

## 6. Runtime View

(6a, task flows, is omitted: no UX/IA track ran; the feature has no interface of its own.)

### 6b. System interactions

**Filing (once).**
1. Duplicate check (§ 5.2) → empty.
2. Run C2 and the evidence commands on `main` after `npm ci`; capture outputs and `date -u +%F`.
3. Compute the review date.
4. Draft the body from § 5.2; apply the wording rule.
5. `gh issue create` with the title and labels of § 5.2.
6. Subscribe to the four upstream PRs.

**Re-check (per trigger).** Trigger noticed → `git pull` + `npm ci` on `main` → C2 three commands → C4 three checks → upstream PR states → post the C3 comment → if met, go to Closure; if a trigger fired, go to Re-decision.

**Re-decision.** Post the C4 record → only then open any dependency PR it calls for.

**Review (every 90 days while unmet).** Same as a re-check, plus the skipped re-check sweep and the next review date.

**Closure.** All three clauses met (or the clause (c) fallback applies) → closing comment quoting every clause's output → close the issue. The no-override guard lapses with closure (PRD § 15.6).

## 11. Crosscutting Concepts

### 11.1 Security

- **Exposure basis**: development-scope, transitive alert (`dependency.scope: development`, manifest `package-lock.json`, read 2026-11-14). The production tree contains no minimatch, glob, or test-exclude (`npm query '.prod:is(…)'` → `[]`). Published files are `lib/**/*`, `LICENSE`, `README.md` (PRD S2 E6). → Addressed.
- **Threat assumption** A-001 (exploitation needs a change to the repository's own configuration): carried as decision-change trigger (b), checked at every re-check. → Addressed.
- **Public-repository wording**: REQ-TRK-C-001 enforced by the wording rule (§ 5.2) and by the comment templates, which have no free-text vulnerability field. → Addressed.
- **Signal preservation**: C6. → Addressed.
- **Access**: clause (c) needs the maintainer's alert-read access (CON-6). Re-checks by others can run (a) and (b) only and must mark (c) "unknown". → Addressed.

### 11.2 Reliability

The procedure has no runtime; its reliability question is "does a check get skipped". Single point of failure: the maintainer. Mitigations: C5's sweep catches skipped re-checks; the review date is in the issue body. Residual risk recorded as RK-1 and RK-2 (§ 14). → Addressed as documented risk, acknowledged here as an author-chosen acceptance (ratification-pending).

The test suite is not touched (CON-1), so `npm run test` behaviour and Codecov reporting (`.github/workflows/ci.yml` lines 78–83) are unchanged. → Addressed.

### 11.3 Error handling

C2 is fail-closed: a failing, erroring, or non-numeric command result makes the clause **unknown**, which counts as unmet. `npm query` reads `node_modules`, so every evaluation starts from `npm ci` on a clean checkout of `main`; a result from a feature branch or a stale install is not valid evidence. → Addressed.

### 11.4 Cost

No infrastructure, no third-party purchase. Cost is maintainer time: about one re-check a month at the observed Dependabot rate, plus a review every 90 days. → Addressed.

### 11.5 Observability

The telemetry is the issue itself: LI-1 (open-issue search count), LI-2 (alert state), LI-3 (override key), LG-1 (re-check coverage via C5 sweep), REQ-TRK-Q-001 latency. Each has a command meter (§ 5.3, § 5.6, § 5.7). No SLO is defined beyond the latency goal. → Addressed.

### 11.6 Accessibility

The only surface is GitHub-rendered Markdown written in plain sentences and tables. No interface is built. → N/A with reason.

### 11.7 Master Test Plan

The plan follows the ten-section format. The "system under test" is the procedure, so the "tests" are verification checks run against GitHub and the npm tree, not test code.

**MTP-1. Goals and Risk Surface**

- Goals: (1) the issue exists once and contains every required field; (2) the issue's wording is public-safe; (3) each close-condition clause evaluates correctly against the real tree and alert; (4) the signal guards hold; (5) re-checks and reviews happen on time.
- Out of scope: coverage behaviour under an override (A-004); the version of the code bundled in `glob@13.0.6` (A-006, Q-1); anything about alert #89.
- Risk surface (capabilities, ranked by risk):

| Capability | Component | Attribute | Verifies | Risk rank |
|---|---|---|---|---|
| CAP-4 clause (b) evaluator counts only jest/test-exclude-path globs below 14 | C2 | correct | REQ-CLS-B-001 | 1 |
| CAP-3 clause (a) evaluator counts in-range minimatch | C2 | correct | REQ-CLS-B-001 | 2 |
| CAP-5 clause (c) evaluator reads alert state, fail-closed | C2 | correct | REQ-CLS-B-001, REQ-TRK-B-004 | 3 |
| CAP-7 no-override meter | C6 | guarded | REQ-OVR-C-001, LI-3 | 4 |
| CAP-6 no-dismissal meter | C6 | guarded | REQ-ALR-C-001, LI-2 | 5 |
| CAP-9 re-check coverage and latency | C3, C5 | timely | REQ-TRK-B-003, REQ-TRK-Q-001, LG-1 | 6 |
| CAP-12 decision-change trigger checks | C4 | alert | REQ-TRK-B-005 | 7 |
| CAP-10 review date present and honoured | C5 | timely | REQ-TRK-B-006 | 8 |
| CAP-2 public-safe wording | C1 | safe | REQ-TRK-C-001 | 9 |
| CAP-1 issue body completeness (items 1–7, dated evidence) | C1 | complete | REQ-TRK-B-001, REQ-TRK-B-002 | 10 |
| CAP-8 single-issue count | C1 | unique | REQ-TRK-B-001, LI-1 | 11 |
| CAP-11 sibling cross-link present, no #89 decision | C1 | scoped | REQ-TRK-B-007 | 12 |

**MTP-2. Pyramid composition.** System type: process over a hosted platform (no code). Composition: 100% acceptance-level checks — command checks (CAP-3…8, CAP-12 (a)(c), CAP-9 meter) and document inspections (CAP-1, -2, -10, -11, CAP-12 (b)). No unit or integration layer exists because nothing is built; adding one would mean writing automation that CON-1 excludes.

**MTP-3. gTAA layers.**

| Layer | Decision | Tool / pattern | Rationale | Test ADR |
|---|---|---|---|---|
| Generation | checks derived one-to-one from each requirement's GIVEN/WHEN/THEN | manual derivation, this table | 12 requirements; no generator needed | TADR-1 |
| Definition | checks live as commands in the issue body and in § 5 | Markdown command blocks | the issue is the only artifact | TADR-1 |
| Execution | run by the maintainer, locally on `main` after `npm ci` | shell + `npm` + `gh` + `jq` | CON-1: no CI job | TADR-1 |
| Adaptation | `npm query` selectors and `gh api --jq` paths absorb tree and API shape | selector strings | one place to update if npm or the API changes | TADR-1 |

**TADR-1** (test ADR, proposed): verification of this design is command-based and run by hand; no test code, no CI gate. Reopen if re-checks are missed (RK-1 fires twice) — then an automated scheduled check (ADR-MM-5 alternative) becomes the answer.

**MTP-4. Environment topology.**

| Env | Purpose | Lifecycle | Data source | Downstream | Provisioning |
|---|---|---|---|---|---|
| maintainer checkout of `main` | evaluate C2, C4 | per re-check (`npm ci` each time) | real lockfile | real GitHub API (read) | `npm ci` from the committed lockfile (the lockfile is the declarative spec; no IaC applies) |

Promotion gates: none; nothing is promoted.

**MTP-5. Test data.** Real data only: the committed lockfile and the live alert record. Privacy class: Public (lockfile) and repository-private-to-maintainer (alert API response, which carries no personal data). No generation, no anonymization.

**MTP-6. Traceability.** Schema: every re-check, review, and closing comment cites clause letters (a)(b)(c) and trigger letters, which map to REQ-CLS-B-001 and REQ-TRK-B-005; § 16 maps requirements to capabilities. Tooling: the C5 sweep (`gh pr list … --search`) is the orphan-trigger alarm (a merge with no re-check). Audit cadence: every 90-day review. Orphan-spec alarm: the review checks every C1 body section is still present.

**MTP-7. Quality gates.**

| Gate | Stage | Entry | Exit | Bypass authority | Failure action |
|---|---|---|---|---|---|
| QG-1 Filing | before `gh issue create` | draft body | CAP-1, CAP-2, CAP-8, CAP-11 pass | none | fix the draft |
| QG-2 Re-decision before dependency change | before any PR touching the minimatch paths with an override or forced upgrade merges | trigger fired or override proposed | C4 record exists on the issue | none | request changes on the PR, link the issue |
| QG-3 Closure | before closing the issue | re-check shows all clauses met (or the (c) fallback) | closing comment quotes all three outputs | none | keep open |

The quality-gates definition goes to `cicd-architect` only if TADR-1 is reopened; today no gate is a CI gate.

**MTP-8. Framework standards.** Unit, integration, contract, E2E, perf, mutation, property-based: N/A — no code is built. Tools used: `npm` (11.20.0 at baseline) `query` and `ls`, GitHub CLI `gh`, `jq` (TADR-1).

**MTP-9. AI-augmented testing.** N/A — no AI/LLM in system.

**MTP-10. Risks and open questions.**

| Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|
| A selector misses a new path (e.g. a new `@jest/*` package depending on glob 13 under a different parent) | Low | Medium | Clause (b) selector matches `[name^="@jest/"]`; the `npm ls glob --all` evidence beside it is read at each re-check | maintainer |
| `npm query` semantics change in a future npm major | Low | Medium | Fail-closed rule; `npm ls` evidence quoted beside every count | maintainer |
| Clause (c) never auto-transitions (A-005) | Medium | Low | Clause (c) fallback (§ 5.3) | maintainer |
| Re-check skipped (RK-1) | Medium | Medium | C5 sweep at every review | maintainer |

## 12. Architecture Decisions

All decisions are `proposed`, ratification-pending. "Door" is the reversibility class with the named barrier.

### ADR-MM-1 — No npm override; alert stays open; track in one issue

- **Context**: Alert #91 covers dev-only copies; Dependabot's update failed; all upstream fix PRs are open; `glob@13.0.6` bundles matching code that an override cannot replace.
- **Decision**: no override; keep the alert open; one tracking issue with a three-clause close condition (council conclusion carried by the PRD).
- **Consequences**: the alert stays visible on the Security tab until upstream ships; maintainer carries re-check work; the lockfile signal stays honest.
- **Door**: two-way. Reversal path: a C4 re-decision, then a one-line `overrides` entry — minutes of work. Nothing prevents reversal in six months.

### ADR-MM-2 — The no-override guard is review-time, not a CI check

- **Options**: (a) review-time rule anchored in the issue; (b) a CI step failing on `overrides` keys for the three packages; (c) a PR-template checkbox.
- **Decision**: (a). (b) and (c) change workflows or repository config, which CON-1 excludes; the repository has one maintainer and Dependabot never adds overrides, so the event the guard blocks is rare.
- **Door**: two-way; reopen (b) if an override PR is ever opened without a re-decision.

### ADR-MM-3 — Clause (a) and (b) pass/fail by `npm query` count, with `npm ls` as quoted evidence

- **Options**: (a) `npm ls … --all` read by eye; (b) `npm query` selector counts; (c) parse `package-lock.json` with `jq`.
- **Decision**: (b) for the predicate, (a) kept as the evidence the PRD names. (c) rejected: the lockfile's `packages` keys need path parsing to scope clause (b), which the selector already does.
- **Evidence**: both selectors ran on 2026-11-14 and returned exactly the PRD § 2 inventory; the clause (b) selector excluded root `glob@7.2.3`.
- **Door**: two-way.

### ADR-MM-4 — Re-check triggers noticed by maintainer habit plus upstream PR subscriptions; misses caught by the review sweep

- **Options**: (a) habit + subscriptions + sweep; (b) a scheduled workflow that runs C2 and comments; (c) Dependabot grouping to make relevant PRs recognisable.
- **Decision**: (a). (b) and (c) change workflows or Dependabot config (CON-1).
- **Door**: two-way.

### ADR-MM-5 — No automation of C2/C3 in this design

- Recorded separately so its reopen trigger is explicit: reopen when TADR-1's trigger fires (two missed re-checks found by the sweep) or when the owner lifts CON-1.
- **Door**: two-way.

### ADR-MM-6 — Issue title and body follow the sibling item #332's shape

- **Decision**: `(chore) …` title (matches the repository's commit-type prefix and #332), body with Why / Decision / Evidence / … / Invalidated if, evidence as command → output tables with dates.
- **Door**: two-way (an edit).

### ADR-MM-7 — Labels `dependencies`, `area: security`, `area: testing`, `priority: low`

- **Rationale**: matches #332's `dependencies` + `area: security`; `area: testing` because every copy is in the test toolchain; `priority: low` because no action is possible in this repository until upstream ships and nothing reaches consumers. The advisory's own severity (medium) is stated in the body, not in the priority label.
- **Alternative**: `priority: medium` to mirror advisory severity. Rejected because priority here ranks the maintainer's work, of which there is little.
- **Door**: two-way.

### ADR-MM-8 — The decision lives in the issue, not in a repository ADR

- **Options**: (a) issue only; (b) issue plus `docs/decisions/002-…md`.
- **Decision**: (a). The decision is time-boxed and lapses at closure (PRD § 15.6); `docs/decisions/` holds one architecture-level record (fluent-ffmpeg migration); adding a file is a repository change the PRD does not ask for.
- **Door**: two-way.

### ADR-MM-9 — Review date is an absolute date in the issue body

- **Options**: (a) absolute date in the body; (b) a milestone with a due date; (c) a calendar reminder outside GitHub.
- **Decision**: (a), computed by `date` at filing. (b) adds a repository object for one issue; (c) is invisible to anyone else.
- **Door**: two-way.

## 12b. Alternatives Considered and Drawbacks

### On the load-bearing choice: what to do about alert #91

| Option | What it does to the alert | What it does to the vulnerable code that runs | Other effects | Verdict |
|---|---|---|---|---|
| **A. No override, keep open, track (chosen)** | stays open, honest | unchanged until upstream ships | maintainer re-check work; alert visible for an unknown period | **chosen** |
| B. Global override `minimatch ^11.0.1` | lockfile clears → alert likely auto-resolves | `glob@13.0.6` keeps running its bundled matching code (A-003, 🟢); the alert would report "fixed" while the code it is about still runs | jestjs/jest#16557 reports a type-level break (`MMRegExp` import in `glob@13.0.6`'s `processor.d.ts`); runtime effect on coverage unverified (A-004) | rejected: hides the signal without removing the code |
| C. Scoped override for test-exclude only (e.g. nested `overrides` for `test-exclude` → `minimatch`, `glob ^14`) | still open: the three `minimatch@10.2.6` copies under `@jest/reporters`, `jest-config`, `jest-runtime` remain in range | fixes test-exclude's copies only; the jest-path globs stay at 13.0.6 | adds a forced resolution the upstream maintainers have not released; same unverified runtime risk for test-exclude's `m.set` / `m.globParts` use | rejected: does not clear the alert and still carries override risk |
| D. Switch coverage to the V8 provider (`coverageProvider: 'v8'`) | still open: lockfile unchanged (`babel-plugin-istanbul` → `test-exclude` stays installed via `@jest/transform`; jest-path globs unchanged) | would stop babel-based instrumentation from loading test-exclude at runtime (general jest behaviour, **not verified in this repository**) | changes coverage numbers reported to Codecov; changes `jest.config.js` (CON-1) | rejected: config change, does not clear the alert |
| E. Disable coverage (`collectCoverage: false`, drop `--coverage`) | still open (lockfile unchanged) | stops test-exclude running in this repository's tests | loses Codecov reporting (`.github/workflows/ci.yml` lines 78–83); config change | rejected |
| F. Dismiss as `tolerable_risk` | dismissed; signal lost | unchanged | the `fixed` clause can never be met; REQ-ALR-C-001 forbids it | rejected |
| G. Replace jest (e.g. another runner) | depends on the new tree | removes jest's globs | far beyond the appetite (CON-3); test-suite rewrite | rejected |
| H. Contribute upstream | none directly | none until released | PRs already exist (§ 1 Drivers) | rejected now; reopens if upstream PRs stall past a review |

**Why A wins.** It is the only option that keeps the alert's state equal to the truth about the code that runs. B and F make the alert say something false; C, D, and E change configuration without clearing the alert; G is out of appetite; H duplicates existing work.

### Drawbacks of the chosen design

- The alert stays open for an unknown time, and the Security tab shows it to every visitor (accepted: it is true).
- The whole protocol depends on one person's habit (RK-1, RK-2).
- The no-override guard only works if a reviewer remembers it (ADR-MM-2).
- Clause (b) may be stricter than needed if the code bundled in `glob@13.0.6` turns out to be outside the range (A-006). That errs toward safety.

## 13. Quality Requirements

| Attribute | Target | Validated by | Status |
|---|---|---|---|
| Re-check latency (REQ-TRK-Q-001) | ≤ 7 days, stretch ≤ 1 day | C3 meter, C5 sweep | addressed by C3/C5; ratification-pending value |
| Correctness of closure | close only when all clauses met; fail-closed | C2 predicates, QG-3 | addressed |
| Public-safety of text | GHSA id + severity + one-line summary only | C1 wording rule, QG-1 | addressed |
| Signal integrity | alert open, no override | C6 meters (LI-2, LI-3) | addressed |
| No regression | test suite unchanged | CON-1: no file changes | addressed |

## 14. Risks and Open Questions

### 14.1 Feasibility summary

| Component | Verdict | Basis |
|---|---|---|
| C1 Tracking Issue | FEASIBLE | `gh issue create` available; all four labels exist; sibling #332 is a working precedent |
| C2 Evaluator | FEASIBLE | all three commands ran on 2026-11-14 and produced the expected baseline |
| C3 Re-check Protocol | FEASIBLE | `gh pr view`/`gh pr list` searches ran; upstream PR states readable |
| C4 Monitor / Re-decision | FEASIBLE | trigger (a) `npm query` and trigger (c) commands ran (`[]` / count 0, `medium`); the `npm pack --dry-run` part of trigger (a) was not run in this design pass; trigger (b) is a file reading |
| C5 Periodic Review | FEASIBLE | sweep command ran; the `date` arithmetic for the review date was not run in this design pass |
| C6 Signal Guards | FEASIBLE | both meters ran |

No Must-Have component is UNCERTAIN or INFEASIBLE. No spike is needed.

### 14.2 Risk register

Likelihood × impact, each 1–3; 7–9 HIGH, 4–6 MEDIUM, 1–3 LOW.

| ID | Risk | L | I | Score | Mitigation / acceptance |
|---|---|---|---|---|---|
| RK-1 | A re-check is skipped after a relevant merge (PRD R-6) | 2 | 2 | 4 MEDIUM | C5 sweep at each review; TADR-1 reopen trigger |
| RK-2 | The 90-day review is missed | 2 | 2 | 4 MEDIUM | absolute date in body; each review sets the next date. Accepted: worst case a late review; blast radius this issue only; fallback is the next Dependabot-triggered re-check, whose comment records the overdue review |
| RK-3 | Upstream never ships (PRD R-1) | 2 | 2 | 4 MEDIUM | 90-day review forces a recorded re-decision; option H reopens |
| RK-4 | An override is merged by mistake (PRD R-2) | 1 | 2 | 2 LOW | C6 review-time guard; LI-3 meter at each re-check detects it after the fact |
| RK-5 | Alert dismissed by mistake (PRD R-3) | 1 | 2 | 2 LOW | LI-2 meter at each re-check; reopen |
| RK-6 | Closure on a lockfile-only pass (PRD R-4) | 1 | 3 | 3 LOW | clause (b); fail-closed |
| RK-7 | Issue text leaks exploit detail (PRD R-5) | 1 | 3 | 3 LOW | wording rule, QG-1, templates with no free-text vulnerability field |
| RK-8 | A runtime exposure appears unnoticed (trigger a) | 1 | 3 | 3 LOW | `.prod` query at every re-check and review |
| RK-9 | Clause (c) never auto-transitions | 2 | 1 | 2 LOW | clause (c) fallback |

**No HIGH risk.**

**Rabbit holes avoided**: determining the version of the code bundled in `glob@13.0.6` (Q-1 / A-006) — clause (b) makes it unnecessary; running `npm test` under an override (A-004) — only needed if C4 reopens the override question, and C4's re-decision template requires it then.

### 14.3 Open questions

| ID | Question | Load-bearing? | Context and impact of deferring |
|---|---|---|---|
| OQ-1 (PRD Q-3) | Does the owner ratify the PRD's requirements and this design's decisions ADR-MM-1…9? | **Yes** — every component rests on unratified requirements (PRD `dor_status: failed`, check 6). | Until ratified, the design stays `draft` and Stage 3 files the issue on unratified decisions. Deferring costs nothing technically; it leaves the decisions open to change. |
| OQ-2 | Dual-lens ratification (product lens, UX lens) of this design. | **Yes** — required before lock. | Not run: this design run was a delegate told not to dispatch other agents, and no person was present. The author's own assessment is not ratification. UX lens: the author considers it N/A (no interface, no task flow, no IA), but that N/A must be confirmed by a party other than the author. |
| OQ-3 (PRD Q-2) | Does GitHub auto-mark alert #91 `fixed` once the lockfile clears? | No — the clause (c) fallback answers it either way. | Observed at closure. |
| OQ-4 (PRD Q-1) | Is the code bundled in `glob@13.0.6` within the vulnerable range? | No — clause (b) requires glob ≥ 14 regardless. | Clause (b) may be stricter than needed. |

### 14.4 Open items (unknowns noted)

- The design and brief are uncommitted at the end of this run; committing them belongs to the orchestrator. Until they are committed, the brief stays `draft`.
- The PRD frontmatter updates this stage would normally write (`formulation`, `features.alert-tracking.tracks`, `artifacts.design-doc`, `artifacts.design-brief`) were not written by this stage: this run was restricted to the two design files. The scope orchestrator applied these values on 2026-11-14: `formulation: {technical-architecture: complete, integration: complete, security-architecture: complete, testing-architecture: complete}`; `features: {alert-tracking: {stage: designed, tracks: [technical-architecture, integration, security-architecture, testing-architecture]}}`; `artifacts: {design-doc: docs/design/minimatch-alert-solution-design.md, design-brief: docs/design/minimatch-alert-brief.md}`.

## 15. Glossary

| Canonical name | Definition | Technical Architecture | Integration | Security | Testing |
|---|---|---|---|---|---|
| SecurityAlert | GitHub Dependabot alert #91 for GHSA-g3hv-75wg-m249 on `package-lock.json` | "alert #91" | `dependabot/alerts/91` resource | the protected signal | clause (c) subject |
| VulnerableCopy | an installed minimatch in `>=7.0.0 <11.0.1`, or glob code bundling it, with its dependency path | "in-range copy" | `npm query` node | exposure item | clause (a)/(b) subject |
| TrackingIssue | the one GitHub issue recording the decision | C1 | issue resource | wording-rule subject | CAP-1, CAP-2, CAP-8 subject |
| CloseCondition | the three-clause objective test | C2 | — | — | CAP-3…5 |
| DependencyOverride | an `overrides` / `resolutions` entry for minimatch, glob, or test-exclude (required absent) | C6 subject | `package.json` key | masking risk | CAP-7 |

Design terms introduced here: **re-check comment** (C3 template), **re-decision record** (C4 template), **review comment** (C5), **fail-closed** (an erroring check counts as unmet), **in-range** (`>=7.0.0 <11.0.1`).

**Consistency report** (Phase 5): tracks run were Technical Architecture, Integration, Security, and Testing.

| Pair | Finding | Resolution |
|---|---|---|
| Technical ↔ Integration | PRD REQ-TRK-B-002 names `npm ls`; C2 uses `npm query` for the predicate | not a conflict: `npm ls` stays as quoted evidence (earlier layer, the PRD, governs what is quoted); `npm query` only computes pass/fail. Selectors verified to reproduce the PRD inventory |
| Technical ↔ Security | none: the wording rule constrains C1 and both templates | — |
| Technical ↔ Testing | every component has at least one capability | — |
| Integration ↔ Security | clause (c) requires alert-read access (CON-6) | recorded; non-maintainer re-checks mark (c) unknown |
| PRD ↔ current state | PRD § 2/§ 7 says no tracking item existed for the sibling; issue #332 now exists (filed 2026-11-14T19:36:47Z) | C1 links #332 concretely; REQ-TRK-B-007 unchanged |

No unresolved conflict.

## 16. Requirement-to-Track Coverage Matrix

| Requirement | Tracks | Covered in | Test capability | Status |
|---|---|---|---|---|
| REQ-TRK-B-001 | Technical, Integration | § 5.2 (C1), § 6b Filing | CAP-1, CAP-8 | covered |
| REQ-TRK-B-002 | Technical, Integration | § 5.2 row 3, § 5.3 evidence column | CAP-1 | covered |
| REQ-TRK-B-003 | Technical, Integration | § 5.4 (C3) | CAP-9 | covered |
| REQ-TRK-B-004 | Technical | § 5.3, § 6b Closure, QG-3 | CAP-5 | covered |
| REQ-TRK-B-005 | Technical, Security | § 5.5 (C4), QG-2 | CAP-12 | covered |
| REQ-TRK-B-006 | Technical | § 5.6 (C5) | CAP-10 | covered |
| REQ-TRK-B-007 | Integration | § 5.2 row 8 | CAP-11 | covered |
| REQ-TRK-C-001 | Security | § 5.2 wording rule, § 11.1, QG-1 | CAP-2 | covered |
| REQ-TRK-Q-001 | Technical, Testing | § 5.4 latency, § 13 | CAP-9 | covered |
| REQ-CLS-B-001 | Technical, Integration | § 5.3 (C2) | CAP-3, CAP-4, CAP-5 | covered |
| REQ-ALR-C-001 | Security | § 5.7 (C6) | CAP-6 | covered |
| REQ-OVR-C-001 | Security | § 5.7 (C6), ADR-MM-2, QG-2 | CAP-7 | covered |
| LI-1 / LI-2 / LI-3 | Testing | § 11.5, § 5.7 | CAP-8 / CAP-6 / CAP-7 | covered |
| LG-1 / LG-2 | Testing | § 5.6 sweep / § 6b Closure | CAP-9 / CAP-5 | covered |
| DG-1 / DG-2 / DG-3 | Technical | § 6b Closure / § 5.5 / § 5.6 | CAP-3…5 / CAP-12 / CAP-10 | covered |

No requirement is UNCOVERED.

## 16b. Element-to-Requirement Backward-Coverage Matrix

No UX/IA track ran, so no wireframe handoff package exists. The provenance audited here is the PRD's own object model and CTA inventory (§ 9) and this document's component table (§ 5.1). Each traced identifier was checked to exist in the PRD.

| Element | Type | Traces to | Provenance source | Status |
|---|---|---|---|---|
| SecurityAlert | entity | REQ-ALR-C-001, REQ-CLS-B-001 | PRD § 9 Objects | traced |
| VulnerableCopy | entity | REQ-CLS-B-001 | PRD § 9 Objects | traced |
| TrackingIssue | entity | REQ-TRK-B-001 | PRD § 9 Objects | traced |
| CloseCondition | entity | REQ-CLS-B-001 | PRD § 9 Objects | traced |
| DependencyOverride | entity | REQ-OVR-C-001 | PRD § 9 Objects | traced |
| File / Re-check / Close / Re-decide (TrackingIssue) | CTA | REQ-TRK-B-001 / -003 / -004 / -005 | PRD § 9 CTA inventory | traced |
| Evaluate (CloseCondition) | CTA | REQ-CLS-B-001 | PRD § 9 CTA inventory | traced |
| Keep open (SecurityAlert) | CTA | REQ-ALR-C-001 | PRD § 9 CTA inventory | traced |
| Reject (DependencyOverride) | CTA | REQ-OVR-C-001 | PRD § 9 CTA inventory | traced |
| C1 … C6 | component | § 5.1 column "Requirements served" | this document | traced |
| Duplicate check before filing | procedure step | REQ-TRK-B-001 ("BUT NOT a second issue") | this document § 5.2 | traced |
| Upstream PR subscriptions | procedure step | REQ-TRK-B-003 | this document § 5.4 | traced |
| Skipped re-check sweep | procedure step | REQ-TRK-B-003, LG-1 | this document § 5.6 | traced |
| Labels (ADR-MM-7), title (ADR-MM-6) | issue attribute | REQ-TRK-B-001 (the issue must exist and be findable) | this document § 5.2 | traced; values are author-chosen defaults, ratification-pending |

No element is PHANTOM.
