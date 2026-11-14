# Solution Design: CI Merge Gate (one aggregate required check)

**Created**: 2026-11-14
**PRD**: [`docs/requirements/phantom-required-checks-prd.md`](../requirements/phantom-required-checks-prd.md) (`dor_status: failed` — DoR check 6 only: six pipeline-authored requirements await owner ratification)
**Baseline**: `alexey-pelykh/puppeteer-capture` at `185a1ad`, read 2026-11-14T19:29:16Z
**Product type**: infrastructure (CI pipeline and repository governance settings)
**Tracks run**: Technical Architecture, Infrastructure (CI/CD), Security Architecture, Testing Architecture.
Not run, no signal: Data Architecture (no persistent data), UX/IA and UI/Visual (no user interface), API Design (no
API exposed or consumed beyond existing GitHub endpoints used read-only), Performance Architecture (one short job; the
only target is a wall-clock bound recorded in § 13), Integration (no new external system), UX Prototype.
**How the tracks were produced**: authored in the scoping context from the PRD, the workflow file at `185a1ad` and the
GitHub documentation cited in § 4; the design was then put to the two ratification lenses (§ 12, Ratification).

## 1. Goals and Drivers

- G1: a PR whose build and every integration cell passed merges with `gh pr merge {PR_NUMBER} --rebase`, no
  `--admin` (PRD REQ-011).
- G2: a red build or any red, cancelled or never-run integration cell blocks the merge (REQ-003, REQ-012).
- G3: the required-check list never again names a context CI does not produce, including across matrix changes
  (REQ-006, REQ-010).
- G4: the repository's merge instructions stop prescribing the bypass (REQ-020, REQ-021, REQ-022).
- Driver: owner decision of 2026-11-14 — "the aggregate `ci-ok` job WILL require build AND every integration cell";
  a capture hang blocking a merge until re-run is accepted.
- Success criteria: PRD § 4 (L1-L3, G1-G2, D1-D2).

## 1b. Non-Goals

- `enforce_admins` stays `false` (PRD § 3; reopen per decision gate D2).
- No fix for the capture hang here (gap-capture-hang owns it).
- No change to `strict` (stays `false`) and no review requirement.
- `github-pages` is not added to the gate (owner decision names build and integration; PRD OQ-1).
- The manual integration-cell count in `.claude/commands/bump-puppeteer.md` Step 2.5 is left as it is (PRD § 3;
  avoids colliding with gap-bump-invariants-unchecked).
- No timeout increases and no automatic retries.

## 2. Constraints

- Workflow permissions stay `contents: read`; actions are pinned by commit SHA (repository convention in `ci.yml`).
- The repository is rebase-merge only (`allow_rebase_merge: true`, merge and squash disabled).
- Branch protection is the only merge-rule source (`rulesets` list empty at `185a1ad`).
- The required check is bound to the GitHub Actions app (`app_id` 15368), as the current four contexts are.
- Execution of the settings change needs a repository admin; `/scope` performs no execution.
- The puppeteer bump procedure appends one `integration` matrix entry per (major, minor); the design must survive
  that without a settings change.

## 3. Context and Scope

System boundary: `.github/workflows/ci.yml` (job graph), the `main` branch protection setting, and four instruction
files (`.claude/commands/bump-puppeteer.md`, `.claude/memory/bump-puppeteer-merge-mechanics.md`,
`.claude/memory/dependabot-triage-stale-base.md`, `.claude/memory/MEMORY.md`) plus `CLAUDE.md` § Testing.
External systems: GitHub Actions (runs jobs, reports check runs), GitHub branch protection (evaluates required
contexts), the `gh` CLI (used by people and agents to merge). Out of the boundary: `publish.yml` and the release
process, the test suite.

## 4. Solution Strategy

1. **One aggregate job, `ci-ok`**, appended to `ci.yml`: `needs: [build, integration]`, `if: always()`,
   `runs-on: ubuntu-24.04`, a short `timeout-minutes`, an explicit `name: ci-ok`, no matrix, no checkout, no secrets.
   Its one step reads the `needs` context and exits non-zero unless every needed job's `result` is `success`,
   printing each job's result first, to the log and to the run's step summary (`$GITHUB_STEP_SUMMARY`), so the
   run page shows which job blocked. It does not name the failing cell; `gh run view {RUN_ID} --log-failed` does.
   - Why `if: always()`: GitHub documents that "A job depends on a failed job → The dependent job is skipped and may
     not block merging" and prescribes "Use always() with needs for required checks that depend on other jobs"
     ([GitHub Docs — "Handling skipped but required checks"](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/collaborating-on-repositories-with-code-quality-features/troubleshooting-required-status-checks#handling-skipped-but-required-checks), retrieved 2026-11-14).
     The same table says a job skipped by a conditional "reports Success", so the job must never be skippable.
   - Why `build` is listed directly: the `needs` context "doesn't include implicitly dependent jobs"
     ([GitHub Docs — "needs context"](https://docs.github.com/en/actions/reference/workflows-and-actions/contexts#needs-context), retrieved 2026-11-14),
     and its `result` values are `success`, `failure`, `cancelled` or `skipped` — the job treats every value but
     `success` as failure.
2. **One required context**: branch protection on `main` requires `ci-ok` (bound to app 15368) and nothing else.
3. **Rollout order** (REQ-013): (a) land the workflow change on `main` — the last merge that still needs the admin
   bypass, because the phantom contexts are still required; (b) confirm a `ci-ok` check run exists on `main`'s head
   commit; (c) replace the required contexts with `ci-ok`; (d) list the PRs open at the switch
   (`gh pr list --state open`): their head commits carry no `ci-ok` run, and a re-run of an old run is expected to
   reuse the old workflow file, so each is rebased onto `main` (`@dependabot rebase` for Dependabot PRs, per the
   existing stale-base flow) to get a run that reports `ci-ok`; (e) land the instruction-file edits with a plain
   `gh pr merge --rebase`, which is itself the first live proof of G1. **Rollback trigger**: if the PR of step (e)
   is not `CLEAN` once its `ci-ok` passed, restore the previous required contexts through the same API and
   investigate before retrying.
4. **Instruction files** are rewritten, not appended to, to describe the plain rebase merge and to read BLOCKED as a
   real CI signal. **One canonical home** (D-6): the merge rule lives in `CLAUDE.md` (the bump procedure's
   "Open PR, merge to main" step and § Testing); `.claude/commands/bump-puppeteer.md` Step 2.5 and the memory notes
   state the command and link there. The rule covers: the wait (a watch that blocks until the required `ci-ok`
   reports, not one that can exit before it exists — `gh pr checks {PR_NUMBER} --watch --required` is the candidate,
   to be verified); BLOCKED while `ci-ok` is pending versus red; the triage split the bump procedure already makes
   (a cell cancelled at the job timeout in "Cache npm packages" is re-run; any other failure is diagnosed with
   `gh run view {RUN_ID} --log-failed`); recording a re-run-to-green (feeds PRD G2); a break-glass rule (only the
   repository owner bypasses the gate, with the reason written on the PR); and one line in Step 2.5 that `ci-ok`
   supersedes the manual cell count until that count is removed.

## 5. Building Blocks

| ID | Component | Kind | Responsibility | Requirements |
|---|---|---|---|---|
| C1 | `ci-ok` job in `.github/workflows/ci.yml` | workflow job | Report one check that is `success` only when `build` and every `integration` cell are `success` | REQ-001 – REQ-006 |
| C2 | `main` branch protection, required status checks | repository setting | Require exactly `ci-ok` from GitHub Actions | REQ-010 – REQ-013 |
| C3 | Merge instructions | documentation (`.claude/commands/bump-puppeteer.md` Step 2.5, `.claude/memory/bump-puppeteer-merge-mechanics.md`, `.claude/memory/dependabot-triage-stale-base.md`, `.claude/memory/MEMORY.md`, `CLAUDE.md` § Testing) | Prescribe the plain rebase merge; name `ci-ok` as the gate | REQ-020 – REQ-022 |

Entity model: none persisted. The entities are configuration objects named in § 15.

## 6. Runtime View

6b. System interactions (one PR):

1. PR opened or pushed → `ci` workflow starts (`pull_request`, an eligible event for required checks).
2. `build` (2 cells) → `integration` (118 cells, starts only if `build` succeeded) → `ci-ok` (always).
3. `ci-ok` reports its check run on the head SHA. Until it reports, branch protection shows the required check as
   expected and the PR as BLOCKED.
4. `ci-ok` `success` → PR `CLEAN` → `gh pr merge {PR_NUMBER} --rebase`.
5. `ci-ok` `failure` → PR BLOCKED → maintainer reads `ci-ok`'s log (one line per needed job), re-runs failed jobs
   (`gh run rerun {RUN_ID} --failed`), which re-runs `ci-ok` too because it also failed.
6. A newer push cancels the older run (workflow `concurrency`); the older SHA's `ci-ok` result is irrelevant because
   protection evaluates the head SHA.

## 7. Deployment View

Runs on GitHub-hosted runners: `ci-ok` on `ubuntu-24.04`. No new environment, secret or permission. The settings
change (C2) is applied once through the branch-protection API or the repository settings page by a repository admin.

## 11. Crosscutting Concepts

**Security** — the routine bypass disappears; a bypass becomes a visible exception. The required context is bound to
the GitHub Actions app, so a commit status of the same name posted by another source does not satisfy it. `ci-ok`
takes no secrets and needs only `contents: read` (the workflow default here). `enforce_admins` stays off (non-goal),
leaving an emergency path.
**Observability** — `ci-ok` prints `build=<result> integration=<result>` to its log and step summary, so a BLOCKED PR says which job blocked; the failing cell itself is found with `gh run view {RUN_ID} --log-failed`.
**Error handling** — any non-`success` result fails the gate; there is no "allow skipped" path.
**Accessibility** — N/A, no interface.

**Master test plan** (Testing Architecture track; section list per `test-plan-format`, condensed for a four-component change):

| Section | Content |
|---|---|
| Scope | C1 verdict logic, C2 enforcement, C3 wording |
| Risk surface (capabilities) | CAP-01 aggregate verdict is `failure` on any non-`success` dependency; CAP-02 aggregate verdict is `success` on all-green; CAP-03 gate enforcement on `main` (BLOCKED / CLEAN); CAP-04 name stability across matrix edits; CAP-05 re-run recovery; CAP-06 instruction text |
| Levels | Static: YAML parse plus a check that the job has `if: always()`, `needs` ⊇ {build, integration}, no matrix (CAP-01, CAP-04). System: fault-injection on a throwaway draft PR before protection is switched — one run with a forced `build` failure, one with a forced single-cell failure, one with a cell failing on its first attempt only and re-run, one cancelled while cells run, and one with an appended matrix entry (CAP-01, CAP-04, CAP-05); the normal green run of the workflow PR itself (CAP-02). Acceptance: protection read-back and `mergeStateStatus` on the first PRs after the switch (CAP-03). Review: grep of instruction files (CAP-06) |
| Environments | GitHub-hosted runners; the real repository (no staging copy exists); fault-injection PR closed unmerged and its branch deleted |
| Test data | none |
| Quality gates | the workflow PR merges only after the fault-injection runs showed `ci-ok` `failure`; protection is switched only after a `ci-ok` run exists on `main` |
| Traceability | § 16 binds each requirement to a capability |
| AI / LLM components | none in this system |

## 12. Architecture Decisions

| ID | Decision | Alternatives considered | Rationale | Status |
|---|---|---|---|---|
| D-1 | Aggregate job with inline shell over the `needs` context | (b) third-party "all green" action; (c) require all 120 job contexts by name | (b) adds a supply-chain dependency for ten lines of logic; (c) is the pattern that produced the phantom checks — names drift with every matrix edit | author-chosen default, ratification pending |
| D-2 | `if: always()` (not `!cancelled()`) | `!cancelled()`; no condition | No condition → skipped → reported as success (GitHub docs, § 4). `!cancelled()` would skip `ci-ok` when a cell is cancelled by its job timeout, and a skipped required job reads as success | author-chosen default, ratification pending |
| D-3 | Keep classic branch protection, change only its required checks | migrate to a repository ruleset | Rulesets are empty today; a migration is a larger change than the defect needs; two-way door | author-chosen default, ratification pending |
| D-4 | Workflow first, protection second (REQ-013) | protection first; same time | Protection first makes every PR wait on a check that is never reported | forced by REQ-013 |
| D-5 | Gate = `build` + `integration` only | also `github-pages` | Owner decision names build and integration | owner decision (S3) |
| D-6 | `CLAUDE.md` is the one canonical home of the merge rule; the command and memory notes link to it | keep five parallel restatements | five restatements are what kept the phantom-check workaround alive unnoticed (UX lens) | author-chosen default, ratification pending |

**Ratification**: see § 17.

## 12b. Alternatives Considered and Drawbacks

- Rejected: re-add `lts/iron` to the build matrix so the phantom contexts are produced again. It removes the BLOCKED
  state but keeps per-cell contexts that drift at the next Node change, and leaves integration unrequired — against
  the owner decision.
- Rejected: just delete the two `lts/iron` contexts. Same drift class; integration stays unrequired.
- Drawbacks of the chosen design: a flaky integration cell now blocks merges (accepted, R3); one extra job per run
  (seconds); `ci-ok` appears only after all 118 cells finish, so a `gh pr checks --watch` that exits early can still
  stop before it exists — branch protection, not the watch, is now what prevents an early merge.

## 13. Quality Requirements

| Attribute | Target | Validated by |
|---|---|---|
| Gate fidelity (PRD § 15.3 `GateFidelity`) | 0 merges per 30 days with non-`success` `ci-ok` on the head SHA | lagging G1 |
| `ci-ok` duration | under 1 minute wall clock on `ubuntu-24.04` | first run's job timing |
| Required-context stability | `["ci-ok"]` before and after a puppeteer bump | protection read-back after the next bump |

## 14. Risks and Open Questions

**Feasibility summary** (every component Must-Have):

| Component | Verdict | Basis |
|---|---|---|
| C1 | FEASIBLE | documented GitHub pattern (§ 4); same runner image already in use |
| C2 | FEASIBLE | the same branch-protection API already holds four contexts; admin rights evidenced by four 2026-11-14 admin merges |
| C3 | FEASIBLE | text edits in five known files |

**Risk register** (L × I, 1-3 each):

| ID | Risk | L | I | Score | Mitigation |
|---|---|---|---|---|---|
| R1 | Protection switched before `ci-ok` exists → all PRs stuck | 2 | 3 | 6 MED | D-4 / REQ-013 read-back before the switch |
| R2 | `ci-ok` treats skipped as pass | 2 | 3 | 6 MED | D-2; fault-injection runs (CAP-01) before merge |
| R3 | Capture hang blocks merges | 2 | 2 | 4 MED | accepted by owner; re-run; decision gate D1; gap-capture-hang |
| R4 | Job renamed, context drifts | 1 | 3 | 3 LOW | explicit `name: ci-ok`; CLAUDE.md records it (REQ-022) |
| R5 | Parallel edit of `ci.yml` by gap-bump-invariants-unchecked | 2 | 1 | 2 LOW | rebase the later PR |
| R6 | Instruction files keep the bypass habit | 3 | 2 | 6 MED | C3 |

No HIGH risk. Rabbit holes: none — no component fails the design if it takes ten times longer.

**Open questions**: none load-bearing. OQ-1 (`github-pages`) is answered by the owner decision for this design;
OQ-2 (`strict`) keeps today's value. Both are recorded in the PRD.

## 15. Glossary

| Canonical name | Definition | Aliases by track |
|---|---|---|
| aggregate job | the `ci-ok` job (C1) | Technical: `ci-ok`; Infrastructure: aggregate/sentinel job; Testing: "gate job" |
| required check | a status-check context branch protection requires before merge | Security: required context |
| phantom check | a required context no workflow produces (today: `build (ubuntu-24.04, lts/iron)`, `build (windows-2022, lts/iron)`) | — |
| integration cell | one `integration` matrix job (os × puppeteer-version) | Testing: cell |
| admin bypass | `gh pr merge --admin`, merging past failed or missing required checks | — |

## 16. Requirement-to-Track Coverage Matrix

| Req | Tracks | Covered in | Capability | Status |
|---|---|---|---|---|
| REQ-001 | Technical, Infrastructure | § 4.1, § 5 C1 | CAP-01, CAP-04 | covered |
| REQ-002 | Technical, Infrastructure | § 4.1 (`if: always()`), D-2 | CAP-01 | covered |
| REQ-003 | Technical | § 4.1, § 11 Error handling | CAP-01 | covered |
| REQ-004 | Technical | § 4.1 | CAP-02 | covered |
| REQ-005 | Infrastructure | § 6b step 5 | CAP-05 | covered |
| REQ-006 | Technical | § 4.1 (`name: ci-ok`, no matrix) | CAP-04 | covered |
| REQ-010 | Security, Infrastructure | § 4.2, § 5 C2 | CAP-03 | covered |
| REQ-011 | Security | § 4.2, § 6b step 4 | CAP-03 | covered |
| REQ-012 | Security | § 6b step 5 | CAP-03 | covered |
| REQ-013 | Infrastructure | § 4.3, D-4 | CAP-03 | covered |
| REQ-020 | Technical (docs) | § 4.4, § 5 C3 | CAP-06 | covered |
| REQ-021 | Technical (docs) | § 4.4, § 5 C3 | CAP-06 | covered |
| REQ-022 | Technical (docs) | § 5 C3 | CAP-06 | covered |

UNCOVERED: none.

## 16b. Element-to-Requirement Backward-Coverage Matrix

No UX/IA track ran, so no wireframe provenance field exists; the tracked elements here are the building blocks and
decisions, traced by hand to PRD identifiers.

| Element | Type | Traces to | Provenance | Status |
|---|---|---|---|---|
| C1 `ci-ok` job | component | REQ-001 – REQ-006 | PRD § 10.1 | traced |
| C2 required checks = `ci-ok` | component | REQ-010 – REQ-013 | PRD § 10.2 | traced |
| C3 instruction edits | component | REQ-020 – REQ-022 | PRD § 10.3 | traced |
| `app_id` 15368 binding on the context | design element | REQ-010 (exactly one check, the CI one) | § 2, § 11 Security | traced |
| `ci-ok` result printout | design element | PRD § 15.3 (observability) | § 11 | traced |
| fault-injection draft PR | test element | REQ-002, REQ-003, REQ-005 | § 11 master test plan | traced |

PHANTOM: none.

## 17. Ratification

Dual-lens dispatch on 2026-11-14, each lens a separately dispatched agent that did not author the design:

| Lens | Agent | Verdict | Rationale (summary) |
|---|---|---|---|
| Product | `product-strategist` | CONFIRM | builds what the PRD needs; premises re-read via `gh api` and `ci.yml`; deferrals do not stop the gate working; the two breaking risks are covered |
| UX / structure | `ux-architect` | CONFIRM | the merge, red-gate and rollout flows are task flows and are sound; seven non-blocking completeness gaps |

Non-blocking concerns and their disposition: product — OQ-1 wording aligned in the PRD; the deferred Step 2.5
cleanup gets an interim supersede line (§ 4.4); ratification of pipeline-authored requirements stays pending.
UX — open PRs at the switch (§ 4.3 step d), triage and `--log-failed` (§ 4.1, § 4.4), wait command (§ 4.4,
unverified candidate), break-glass rule (§ 4.4), one canonical home (D-6), supersede line (§ 4.4), rollback trigger
(§ 4.3). Each is carried into the work items.

Lock state: **not locked** (brief `status: draft`). The design rests on six PRD requirements and four author-chosen
defaults (D-1, D-2, D-3, D-6) that await the owner's one-at-a-time ratification; the lenses ratify desirability and
soundness, not provenance.
