---
scope: Dependabot alert hygiene for development-scope dependencies
created: 2026-11-14
profile: lean
formulation:
  technical-architecture: complete
  security-architecture: complete
  testing-architecture: complete
features:
  alert-89-disposition:
    stage: design
    tracks: [technical-architecture, security-architecture, testing-architecture]
artifacts:
  design-doc: docs/design/deepmerge-alert-solution-design.md
  design-brief: docs/design/deepmerge-alert-brief.md
dor_status: failed
---

# Dependabot alert hygiene: deepmerge alert #89 — Product Requirements Document

**Version**: 1.0
**Created**: 2026-11-14
**Last Updated**: 2026-11-14
**Status**: Draft — awaiting owner ratification (written by an autonomous `/scope` run; no person was present)
**Sources**: council synthesis `gap-deepmerge-alert` (2026-11-14, panel of three reviewers plus orchestrator re-checks); facts re-read by this run on 2026-11-14 (listed in § 14); the owner's standing rules in the owner's global instruction file; this repository's `SECURITY.md`.

> **Profile**: `lean`, proposed by this run because the batch is small and the uncertainty is low. The profile is ratification-pending: no person declared it. Sections 9, 11 and 13 are omitted by that declaration.
>
> **Authorship**: the TL;DR, the problem statement, the benefit hypothesis and the success criteria are the owner's to author. In this autonomous run they are drafted from the sources and marked `DRAFT — owner to confirm`. Nothing in them is a recorded owner decision.

## 1. TL;DR

`DRAFT — owner to confirm.` Dependabot alert #89 (GHSA-gcqx-w48m-w2h4, deepmerge, severity low) has been open since 2026-10-27. The CVE behind it, CVE-2026-93753, was rejected on 2026-11-02 because it "does not describe a security vulnerability". The GitHub advisory has not been withdrawn yet, and no patched deepmerge version exists. The alert therefore sits open with nothing that can fix it and nothing that records why it is still there. This PRD asks for one thing: the alert carries a recorded, auditable disposition, either dismissed with a stated reason and evidence, or kept open with a tracked close condition. Which of the two is an open owner decision (§ 8, OQ-1).

## 2. Problem Statement

`DRAFT — owner to confirm.`

- **Why this matters**: an open security alert that nothing can fix and nothing explains is noise in security triage. Every later triage pass has to rediscover why it is still open. The owner's rule is that a validated finding is fixed, or, when deferred, lands as a tracked item in a record that outlives the session.
- **Who has this problem**: the repository maintainer, who triages Dependabot alerts and Dependabot pull requests for this repository.
- **Current state**: alert #89 is `open`, `dismissed_reason` is null, `dismissed_comment` is null, and no issue tracks it. Its only cause is `jest@30.5.2 > @jest/core > jest-config@30.5.2 > deepmerge@4.3.1`, a development dependency. The package published to npm ships only `lib/**/*`, `LICENSE` and `README.md`, and its runtime dependencies are `async-mutex`, `fluent-ffmpeg`, `which` and the optional `ffmpeg-static`. deepmerge is not among them.
- **Evidence**: see § 14, rows F-1 to F-7. Every fact there was re-read on 2026-11-14 with the command shown.
- **Why now, and what it costs to do nothing**: the alert has no patch to wait for (`first_patched_version` is null; the newest deepmerge is 4.3.1, the top of the vulnerable range). If the advisory is never withdrawn, the alert never closes on its own. Doing nothing leaves a permanent unexplained open alert. Whether a later withdrawal of the advisory would close the alert automatically is not documented in the GitHub pages this run checked (assumption A-3).

## 3. Boundaries

- **Appetite**: small batch — one reversible change to the alert's state or one tracked issue, plus the evidence recorded with it. Well under one hour of maintainer time. Circuit breaker: if applying the disposition needs anything beyond the four re-reads and one API call — for example the REQ-DM-004 guard fires — stop and return the decision to the owner rather than widen the work. `Proposed by this run; ratification-pending.`
- **Out of scope, not yet**:
  - A written project convention for triaging false-positive development-scope alerts. Deferred because one alert does not establish a pattern. Reopens when a second alert in the same class needs the same handling. The sibling gap `gap-minimatch-alert` (alert #91) is the likely second case.
  - Asking upstream (github/advisory-database#10910, an open issue filed 2026-11-06 by a third party) to withdraw the advisory. Deferred because commenting on external items is execution, and the request already exists.
- **Explicitly not building**:
  - An npm `overrides` entry or a forced deepmerge version. No fixed version exists, so there is nothing to override to.
  - Replacing jest or jest-config. The alert does not justify a test-runner migration.
  - Any change to code, workflows, `package.json` or `package-lock.json`. The disposition is a change to the alert's state and to the tracker only.
  - Any automated rule that closes security alerts without a stated reason (see REQ-DM-005).

## 4. Success Criteria

`DRAFT — owner to confirm.`

- **Serves**: security-triage signal hygiene for this repository. Every open alert is either actionable or explained.
- **Leading indicators (within two weeks of the work item opening)**:
  - L-1 (implementation criterion — it shows the work was done, not that it mattered; G-1 is the outcome measure): `gh api repos/alexey-pelykh/puppeteer-capture/dependabot/alerts/89 --jq '{state,dismissed_reason,dismissed_comment}'` prints either `state: dismissed` with a non-null `dismissed_reason` and a non-empty `dismissed_comment`, or `state: open` together with an open issue in this repository that names alert #89 and its close condition. Target: true. Baseline on 2026-11-14: false.
- **Lagging indicators (30, 60 and 90 days)**:
  - G-1: at each check, the alert is in the state the disposition recorded, or a state change is explained (a reopen or an advisory withdrawal is recorded on the alert or on the tracking issue).
  - G-2: at each check, the recorded evidence still holds: CVE-2026-93753 is still `REJECTED`. If not, gate D-1 fires.
- **Decision gates**:
  - D-1: if the CVE state is no longer `REJECTED`, reopen the alert (if dismissed) and return the disposition to the owner.
  - D-2: if the advisory's `withdrawn_at` becomes non-null, close the tracking issue (keep-open branch) or record the withdrawal on the alert (dismiss branch).
  - D-3: if a deepmerge version outside the vulnerable range is published and jest-config can resolve it, prefer the update over any dismissal.

## 5. Proposed Solution

Sketch altitude. The design stage chooses between the branches.

1. The maintainer (or an agent run carrying the owner's approval) re-reads the evidence: the CVE record, the advisory's `withdrawn_at`, the state of github/advisory-database#10910, and `npm ls deepmerge --all`.
2. If the CVE is still rejected, the maintainer applies the disposition the owner chose:
   - **Dismiss branch**: dismiss alert #89 with a reason from GitHub's enum and a comment that states the reason and cites the evidence.
   - **Keep-open branch**: leave the alert open and keep a tracked issue that names the close condition (advisory withdrawn, or a fixed version published).
3. The work item quotes each command run and the line it printed, then closes.

## 6. Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| The CVE is un-rejected or reissued after a dismissal, and the dismissed alert hides a real issue | Low | Low (development scope, not shipped) | REQ-DM-004 and gate D-1; dismissed alerts can be reopened (A-4) |
| A public issue about the alert is read as disclosing a vulnerability | Low | Medium | The advisory is public and its CVE is rejected; REQ-DM-006 keeps every public text to public facts about this advisory only |
| Keep-open branch: the alert never closes because a withdrawal does not auto-close it | Medium (A-3 unverified) | Low | The tracking issue names the close condition and is re-checked at G-1 |
| The evidence moves between this run and execution | Medium | Low | REQ-DM-003 re-reads every fact at execution time |

## 7. Dependencies

- External: GitHub Advisory Database record GHSA-gcqx-w48m-w2h4; CVE record CVE-2026-93753 at cveawg.mitre.org; github/advisory-database#10910 (third-party request to withdraw).
- External: jest-config 30.5.2 declares `deepmerge: ^4.3.1`.
- Related scope work: `gap-minimatch-alert` (Dependabot alert #91, same class: development-scope transitive alert under jest). No issue existed for it when this PRD was written.
- Permission: dismissing a Dependabot alert needs write or security-manager access to the repository.

## 8. Open Questions

| ID | Question | Options | Owner | Status |
|---|---|---|---|---|
| OQ-1 | Dismiss alert #89 now, or keep it open until the advisory is withdrawn? | (a) dismiss now with reason `inaccurate`, citing the CVE rejection (council: config and security reviewers); (b) keep open with a tracked close condition (council: testing reviewer); (c) dismiss now and also track the advisory's withdrawal | Repository owner | Open — ratification-pending. The design stage records a recommendation. |
| OQ-2 | Who applies the disposition: the owner by hand, or an agent run whose task file carries the owner's approval? | owner / agent | Repository owner | Open |

## 10. Requirements

### 10.1 Alert #89 disposition {#feature-alert-89-disposition}

**REQ-DM-001** (Event-driven). When the disposition of Dependabot alert #89 is applied, the repository shall record it on the alert as exactly one of: (a) `state: dismissed` with a non-null `dismissed_reason` and a non-empty `dismissed_comment`; or (b) `state: open` together with an open issue in this repository that names alert #89 and its close condition.

- GIVEN alert #89 is `open` with no `dismissed_reason` and no tracking issue,
- WHEN the disposition is applied,
- THEN `gh api repos/alexey-pelykh/puppeteer-capture/dependabot/alerts/89` shows branch (a), or shows `state: open` and the tracking work item, GitHub issue #332, is open and its body states the close condition,
- BUT NOT `state: open` with no tracking issue,
- BUT NOT `state: dismissed` with an empty `dismissed_comment`.

**REQ-DM-002** (Unwanted behaviour). If alert #89 is dismissed, then the dismissal comment shall state the reason and cite the evidence: CVE-2026-93753's state and the date it took that state, the advisory's `withdrawn_at` value at the time of dismissal, and github/advisory-database#10910.

- GIVEN the dismiss branch was chosen and REQ-DM-003's re-read shows the CVE still `REJECTED`,
- WHEN the alert is dismissed,
- THEN `dismissed_comment` contains `CVE-2026-93753`, `REJECTED`, the rejection date, the advisory's `withdrawn_at` value, and `github/advisory-database#10910`,
- BUT NOT a statement that the advisory is withdrawn while `withdrawn_at` is null,
- BUT NOT a comment longer than 280 characters, the `dismissed_comment` maxLength in GitHub's REST reference for Dependabot alerts (read 2026-11-14). The full evidence goes in the work item; the comment carries the reason and the citations.

**REQ-DM-003** (Event-driven). When the disposition is applied, the executor shall re-read each fact the disposition relies on and quote the command and the line it printed in the work item before the work item closes: the CVE state, the advisory's `withdrawn_at`, the state of github/advisory-database#10910, and `npm ls deepmerge --all`.

- GIVEN the facts in § 14 were read on 2026-11-14,
- WHEN the disposition is applied on a later date,
- THEN the work item carries a comment quoting each of the four commands and its printed output from that date,
- BUT NOT a 2026-11-14 value restated without a re-read.

**REQ-DM-004** (Unwanted behaviour). If the re-read finds CVE-2026-93753 in any state other than `REJECTED`, or finds deepmerge reached through a runtime dependency of the published package, then the executor shall not dismiss the alert and shall return the disposition to the owner.

- GIVEN the re-read under REQ-DM-003,
- WHEN the CVE state is not `REJECTED`, or `npm ls deepmerge --all` shows a path that does not start at a development dependency,
- THEN the alert stays `open` and the work item records the changed fact and asks the owner to decide again,
- BUT NOT a dismissal with reason `inaccurate` on changed evidence.

**REQ-DM-005** (Ubiquitous). The disposition of alert #89 shall be applied by a named person, or by an agent run whose task record carries the owner's approval, and never by an automated rule that closes security alerts without a stated reason.

- GIVEN the repository's Dependabot settings,
- WHEN the disposition is applied,
- THEN the alert's timeline or the work item names who applied it and the reason,
- BUT NOT an auto-triage or auto-dismiss rule added to close this alert.

**REQ-DM-006** (Ubiquitous). Every public text written for this disposition (the issue, the dismissal comment, commit messages) shall state only public facts about GHSA-gcqx-w48m-w2h4 and CVE-2026-93753, and shall not mention any other security setting of this repository.

- GIVEN the repository is public and `SECURITY.md` forbids public disclosure of vulnerabilities,
- WHEN any text for this disposition is published,
- THEN it names only this advisory, its CVE, its upstream records and the dependency path,
- BUT NOT any other repository security setting, alert or finding.

## 12. Assumption Registry

| ID | Assumption | Type | Confidence | Evidence | Validation plan | Risk if wrong |
|---|---|---|---|---|---|---|
| A-1 | deepmerge reaches this repository only through the jest development dependency, and nothing that ships to npm loads it | Technical | 🟢 | F-6, F-7 | REQ-DM-003 re-reads `npm ls deepmerge --all` | A runtime path would make the alert relevant to consumers; REQ-DM-004 stops the dismissal |
| A-2 | The CVE rejection means the advisory does not describe a vulnerability | Domain | 🟢 | F-2: the CNA's own rejection reason | REQ-DM-003 re-reads the CVE record | A reissued CVE would make a dismissal wrong; gate D-1 |
| A-3 | A later withdrawal of the advisory would close an open alert automatically | Technical | 🔴 unverified | The GitHub pages read on 2026-11-14 (REST alerts reference; viewing and updating alerts) do not say | Design stage, or observe the alert after #10910 resolves | The keep-open branch would leave the alert open forever |
| A-4 | A dismissed alert can be reopened | Technical | 🟢 | GitHub docs "Viewing and updating Dependabot alerts": "Unfixed dismissed alerts can be reopened later." | none needed | Dismissal would be harder to undo |
| A-5 | A public issue about this public advisory is not a disclosure under `SECURITY.md` | Policy | 🟡 | The advisory and the CVE rejection are public records | Owner confirms when ratifying | A private channel would be needed instead |
| A-6 | The `lean` profile and the small-batch appetite fit this work | Process | 🟡 | One alert, one reversible action | Owner ratifies | Re-run under the full profile |

## 14. Source Traceability

Facts (re-read 2026-11-14 by this run):

| ID | Command | Printed |
|---|---|---|
| F-1 | `gh api repos/alexey-pelykh/puppeteer-capture/dependabot/alerts/89` | `state: open`, `dismissed_reason: null`, `dismissed_comment: null`, GHSA-gcqx-w48m-w2h4, CVE-2026-93753, severity low, vulnerable `>= 4.2.0, <= 4.3.1`, patched null, scope development, relationship transitive, created 2026-10-27T22:16:11Z |
| F-2 | `curl https://cveawg.mitre.org/api/cve/CVE-2026-93753` | `REJECTED 2026-11-02T16:33:19.357Z`, "This CVE ID has been rejected because it does not describe a security vulnerability." |
| F-3 | `gh api advisories/GHSA-gcqx-w48m-w2h4` | `withdrawn_at: null`, `updated_at: 2026-10-27T21:34:58Z` |
| F-4 | `gh api repos/github/advisory-database/issues/10910` | open issue "[GHSA-gcqx-w48m-w2h4] False positive - CVE-2026-93753 is already rejected", created 2026-11-06T09:23:56Z |
| F-5 | `npm view deepmerge version`; `npm view jest-config@latest version dependencies.deepmerge` | `4.3.1`; `30.5.2`, `^4.3.1` |
| F-6 | `npm ls deepmerge --all` | `jest@30.5.2 > @jest/core@30.5.2 > jest-config@30.5.2 > deepmerge@4.3.1` |
| F-7 | `package.json` | dependencies `async-mutex`, `fluent-ffmpeg`, `which`; optional `ffmpeg-static`; `files`: `lib/**/*`, `LICENSE`, `README.md` |

Requirements:

| Req ID | Source | Origin | Feature | Layer | Confidence | Ratified |
|---|---|---|---|---|---|---|
| REQ-DM-001 | Owner's global rule `fix-validated-findings-by-default` (fix, or track a deferral in a record that outlives the session), applied to the finding in the council synthesis | user-stated (applied) | alert-89-disposition | Behavioural | 🟢 | No — pending |
| REQ-DM-002 | Council brief constraint `constraint-security-escalates` ("a dismissal or override needs a stated reason the owner can audit"); evidence set from F-2 to F-4 | AI-inferred-expansion (the constraint was written by the orchestrator, not traced to an owner message) | alert-89-disposition | Behavioural | 🟡 | No — pending |
| REQ-DM-003 | Owner's global rules `quote-the-evidence-for-a-result` and `recall-is-hypothesis-read-canonical-source`; dispatch constraint `constraint-verified-facts` | user-stated (applied) | alert-89-disposition | Process | 🟢 | No — pending |
| REQ-DM-004 | This run, from A-1 and A-2 (the dismissal reason holds only while both hold) | AI-inferred-expansion | alert-89-disposition | Behavioural | 🟡 | No — pending |
| REQ-DM-005 | Council brief constraint `constraint-security-escalates` ("security items are never auto-closed") | AI-inferred-expansion (orchestrator-written constraint) | alert-89-disposition | Constraint | 🟡 | No — pending |
| REQ-DM-006 | `SECURITY.md`; owner decision `decision-publish-protection` in the scoping dispatch | user-stated | alert-89-disposition | Constraint | 🟢 | No — pending |

### 14b. Cross-Repository References

| PRD Req | Implementation repo | Spec or item | Status |
|---|---|---|---|
| — | — | populated when work items are created | — |

## 15. Cross-Cutting and Non-Functional Concerns

### 15.1 Security
REQ-DM-002, REQ-DM-004, REQ-DM-005 and REQ-DM-006 are the security requirements. The alert concerns a development dependency only (A-1).

### 15.2 Compliance and Regulatory
N/A — no regulated data or obligation is involved. The only policy in play is the repository's `SECURITY.md`, covered by REQ-DM-006.

### 15.3 Reliability and Observability
The alert state is observable through the REST API (`gh api .../dependabot/alerts/89`), which is how REQ-DM-001 and the success criteria are checked. No runtime reliability concern: nothing ships.

### 15.4 Performance and Scalability
N/A — a single administrative action with no runtime surface.

### 15.5 Operational
Applying the disposition needs write or security-manager access (§ 7). The executor is named per REQ-DM-005.

### 15.6 Lifecycle
The disposition is revisited on decision gates D-1 to D-3. A dismissed alert can be reopened (A-4). On the keep-open branch, the tracking issue closes when the advisory is withdrawn or a fixed version is published.

## Readiness Gate Record

Graded 2026-11-14 by the autonomous run, against the `lean` profile:

| Check | Result | Note |
|---|---|---|
| 1 Validated problem statement | PASS (drafted) | Traces to the council finding and § 14 facts; owner to confirm the draft |
| 2 Out-of-scope declarations | PASS | § 3 lists two deferrals and four exclusions |
| 3 Success and telemetry metrics | PASS (drafted) | L-1, G-1, G-2, D-1 to D-3; owner to confirm |
| 4 Cross-cutting concerns | PASS | Every subsection carries content or `N/A — {rationale}` |
| 5 Feature completeness | N/A by `lean` declaration | Section 13 omitted by profile |
| 6 Requirement provenance | **FAIL** | No requirement has been ratified one at a time by the owner; three are AI-inferred (REQ-DM-002, -004, -005). No person was present in this run. |

**Verdict**: `failed`. The remedy is owner ratification of REQ-DM-001 to REQ-DM-006 one at a time, then a re-grade.

## 16. Change Log

| Version | Date | Change | Rationale | Impact |
|---|---|---|---|---|
| 1.0 | 2026-11-14 | Created by an autonomous `/scope` run (Stage 1) | Corrective audit-findings route for `gap-deepmerge-alert` | New document |
| 1.1 | 2026-11-14 | Appetite gains a circuit breaker; REQ-DM-001's THEN names the tracking issue #332 instead of a text search; L-1 tagged as an implementation criterion | `/scope` Stage 3.7 coverage gate: the appetite had no circuit breaker, and the search string would not match the issue body, which writes "alert 89" without `#` | Wording only; no requirement added or removed |
