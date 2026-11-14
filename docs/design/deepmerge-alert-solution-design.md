# Solution Design: Disposition of Dependabot alert #89 (deepmerge)

**Created**: 2026-11-14
**Status**: Draft — not locked (see § 14: one load-bearing open question; dual-lens ratification not run)
**Requirements**: [`docs/requirements/deepmerge-alert-prd.md`](../requirements/deepmerge-alert-prd.md) (`profile: lean`, `dor_status: failed` — requirement provenance not yet ratified by the owner)
**Produced by**: an autonomous `/scope` run (Stage 2). No person was present, so every checkpoint below is recorded as ratification-pending.

> **Intake note.** The PRD's readiness verdict is `failed`: no requirement has been ratified one at a time by the owner, and three are AI-inferred (REQ-DM-002, -004, -005). The design stage normally needs the user's explicit acknowledgment to proceed past that verdict. This run proceeded without it, because the scoping dispatch says every checkpoint takes the autonomous path and never blocks. That acknowledgment is ratification-pending.

## 1. Goals and Drivers

- **Goal**: Dependabot alert #89 (GHSA-gcqx-w48m-w2h4, deepmerge, low) ends with a recorded, auditable disposition instead of sitting open with no reason (PRD REQ-DM-001).
- **Driver**: CVE-2026-93753, the CVE behind the advisory, is `REJECTED` since 2026-11-02 ("does not describe a security vulnerability"). The advisory is not withdrawn. No patched deepmerge exists. Nothing will close the alert on its own that this run could verify.
- **Success criteria**: PRD § 4 (drafted, owner to confirm). The leading indicator L-1 is the one a work item can satisfy directly.

## 1b. Non-Goals

- No `overrides` entry, version pin or dependency change. No fixed version exists.
- No jest or jest-config migration.
- No comment, pull request or vote on github/advisory-database#10910. The withdrawal request already exists and commenting is outside the scope.
- No project-wide triage convention for false-positive alerts (PRD § 3, deferred until a second case).
- No automated dismissal rule (PRD REQ-DM-005).

## 2. Constraints

- The repository is public. Public text names only this advisory, its CVE and its upstream records (REQ-DM-006).
- `dismissed_comment` holds at most 280 characters (GitHub REST reference for Dependabot alerts, read 2026-11-14).
- `dismissed_reason` takes one of `fix_started`, `inaccurate`, `no_bandwidth`, `not_used`, `tolerable_risk` (same reference).
- Applying a disposition needs write or security-manager access to the repository.
- The owner's rule `fix-validated-findings-by-default`: fix a validated finding; defer only when the fix is out of scope, beyond capability and riskier than the defect, all three at once; a deferral lands as a tracked item.

## 3. Context and Scope

The system boundary is the repository's Dependabot alert record plus its issue tracker. External records read but never written: the CVE record at cveawg.mitre.org, the GitHub Advisory Database entry, github/advisory-database#10910, and the npm registry.

```
cveawg.mitre.org (CVE state) ─┐
GitHub Advisory DB (GHSA) ────┼─> executor re-reads ──> alert #89 (dismiss)  or  tracking issue (keep open)
advisory-database#10910 ──────┤                              │
npm ls deepmerge --all ───────┘                              └─> work item: commands + printed output quoted
```

## 4. Solution Strategy

One work item, executed by the owner or by an agent run that carries the owner's approval. It runs in three steps:

1. **Re-read the evidence** (REQ-DM-003): four reads, each quoted with its printed output.
2. **Guard** (REQ-DM-004): continue only if the CVE is still `REJECTED` and deepmerge is still reached only through development dependencies. Otherwise stop and return the decision to the owner.
3. **Apply the disposition the owner chose** (OQ-1, open):
   - **Recommended — option (a), dismiss now**: dismiss alert #89 with `dismissed_reason: inaccurate` and a dismissal comment of at most 280 characters carrying the reason and the citations (REQ-DM-002). Example of the shape (the executor fills the values it re-read):
     `CVE-2026-93753 REJECTED 2026-11-02 by its CNA: "does not describe a security vulnerability". GHSA-gcqx-w48m-w2h4 withdrawn_at=null as of <date>; withdrawal requested in github/advisory-database#10910. Dev-only path via jest-config.`
   - Option (b), keep open: leave the alert open and keep the work item open, naming the close condition: the advisory is withdrawn, or a version outside the vulnerable range is published.
   - Option (c), dismiss now and track the withdrawal: option (a), plus a tracking item that stays open until #10910 resolves.

Why (a) is recommended, on fit and principle first: the finding is validated (the CNA itself rejected the CVE), the fix is in scope and within capability, and it is less risky than the defect because a dismissed alert can be reopened. The owner's rule therefore does not permit a deferral, and keep-open is a deferral. The cost axis agrees but did not decide: (a) is one API call; (b) and (c) each leave an item open on an external party's schedule. The council split on this (configuration and security reviewers for dismissing, testing reviewer for keeping open), so the choice stays the owner's.

## 5. Building Blocks

| Element | Kind | Defined by | Notes |
|---|---|---|---|
| Alert #89 record | entity (external, GitHub) | GitHub REST | fields `state`, `dismissed_reason`, `dismissed_comment` |
| Evidence set E | entity (record in the work item) | REQ-DM-003 | four reads, each with command and printed output |
| Dismissal comment | entity | REQ-DM-002 | ≤ 280 characters |
| Tracking issue | entity (branch b/c only) | REQ-DM-001 (b) | names alert #89 and the close condition |
| Disposition work item | component | this design | the one tracked item; carries steps 1–3 |

## 6. Runtime View

### 6b. System interactions

```
executor
  ├─ curl -s https://cveawg.mitre.org/api/cve/CVE-2026-93753            → state, rejection date, reason
  ├─ gh api advisories/GHSA-gcqx-w48m-w2h4 --jq .withdrawn_at          → null | timestamp
  ├─ gh api repos/github/advisory-database/issues/10910 --jq .state     → open | closed
  ├─ npm ls deepmerge --all                                             → dependency path
  ├─ guard (REQ-DM-004) ── fails ──> stop, comment on work item, owner decides again
  └─ option (a): gh api -X PATCH repos/alexey-pelykh/puppeteer-capture/dependabot/alerts/89
                   -f state=dismissed -f dismissed_reason=inaccurate -f dismissed_comment="…"
     then: gh api repos/alexey-pelykh/puppeteer-capture/dependabot/alerts/89 --jq '{state,dismissed_reason,dismissed_comment}'
```

The PATCH call's form comes from GitHub's REST reference ("Update a Dependabot alert"); this run read the parameter enum and the comment limit there but executed nothing.

## 11. Crosscutting Concepts

**Security** (Security Architecture track, run inline — see § 12b). The alert concerns a development dependency only (PRD A-1, re-checked by REQ-DM-004). Trust boundaries: the executor's GitHub token needs alert write access; the dismissal is attributable in the alert timeline and the audit log. Public-text rule: REQ-DM-006. No new attack surface.

**Observability**: the alert state is readable through the REST API, which is the verification instrument for every check below.

**Error handling**: a failed PATCH (permission, network) leaves the alert `open`; the executor records the error on the work item and the item stays open. A comment longer than 280 characters is rejected by the API; the executor shortens it, keeping the citations.

**Accessibility**: N/A — no interface.

**Master test plan** (Testing Architecture track, run inline and kept to the size of the change — see § 12b):

| Capability | What it verifies | Requirements | Instrument | Level |
|---|---|---|---|---|
| CAP-1 alert disposition recorded | alert state and fields match the chosen branch | REQ-DM-001, REQ-DM-002, REQ-DM-005 | `gh api …/dependabot/alerts/89 --jq '{state,dismissed_reason,dismissed_comment}'`; `gh issue list` for branch (b) | manual acceptance check, run once |
| CAP-2 evidence currency | each fact re-read on the execution date | REQ-DM-003, REQ-DM-004 | the four commands in § 6b, quoted on the work item | manual acceptance check, run once |
| CAP-3 public-text review | public text names only this advisory and its records | REQ-DM-006 | reviewer reads the comment and the issue against REQ-DM-006 | manual review |

There is no code, so there are no unit, integration or end-to-end tests and no CI gate. No AI or LLM component exists. Quality gate: the work item closes only when CAP-1 to CAP-3 each have a quoted result on it.

## 12. Architecture Decisions

| ID | Decision | Status | Rationale |
|---|---|---|---|
| AD-1 | One work item carries evidence, guard and disposition together | Proposed (author-chosen default — ratification-pending) | The evidence and the guard only matter at the moment of the disposition; splitting them would create items with no value on their own |
| AD-2 | Disposition branch: (a) dismiss now / (b) keep open / (c) dismiss and track | **Open stub** — owner decision OQ-1 | Context and options in § 4; decision and consequences left open |
| AD-3 | Dismissal reason `inaccurate` (if branch a or c) | Proposed (author-chosen default — ratification-pending) | The CNA's rejection says the advisory does not describe a vulnerability; `not_used` would be false (jest-config does load deepmerge), and `tolerable_risk` would concede a risk the CNA says does not exist |
| AD-4 | Full evidence on the work item; the alert comment carries reason and citations only | Proposed (author-chosen default — ratification-pending) | Forced by the 280-character limit |
| AD-5 | No automated close rule | Proposed — derives from REQ-DM-005 | Security items are never auto-closed |

## 12b. Alternatives Considered and Drawbacks

- **Override deepmerge in `package.json`**: rejected; no fixed version exists.
- **Wait for the advisory withdrawal (branch b)**: kept as an option for the owner. Drawback: the alert stays open on a third party's schedule, and whether a withdrawal closes the alert automatically is undocumented in the pages read (PRD A-3).
- **Dismiss as `not_used` or `tolerable_risk`**: rejected in AD-3.
- **Drawbacks of the recommended branch (a)**: if the CVE were later reinstated, a dismissed alert would not reopen on its own (not verified either way); decision gate D-1 depends on someone re-checking. The development-only scope bounds the impact.
- **Process deviations of this run**: the Security Architecture and Testing Architecture tracks were run inline by this agent instead of being dispatched to their handler agents, because this run is itself a delegate and the owner's rule forbids re-delegating. The tracks are kept to the size of a one-call change, per the over-design warning.

## 13. Quality Requirements

| Attribute | Target | Validated by |
|---|---|---|
| Auditability | the alert timeline shows reason + citations; the work item shows every command and output | CAP-1, CAP-2 |
| Reversibility | a dismissal can be reopened ("Unfixed dismissed alerts can be reopened later", GitHub docs) | documentation read 2026-11-14 |
| Disclosure safety | no public text beyond this advisory's public records | CAP-3 |

## 14. Risks and Open Questions

**Feasibility**

| Component | Verdict | Basis |
|---|---|---|
| Evidence re-read | FEASIBLE | all four reads ran successfully on 2026-11-14 |
| Guard | FEASIBLE | two string checks on the re-read output |
| Dismissal via REST | FEASIBLE | documented endpoint and enum; needs a token with alert write access |
| Tracking issue (branch b/c) | FEASIBLE | standard issue |

**Risk register** (likelihood × impact, 1–3 each)

| Risk | L | I | Score | Mitigation |
|---|---|---|---|---|
| CVE reinstated after dismissal | 1 | 2 | 2 LOW | guard at execution; reopen possible; development scope only |
| Executor lacks permission | 2 | 1 | 2 LOW | work item names the needed access; failure leaves alert open |
| Comment over 280 characters | 2 | 1 | 2 LOW | AD-4 |
| Public text over-discloses | 1 | 2 | 2 LOW | REQ-DM-006, CAP-3 |

No HIGH risks. No rabbit holes: no component fails the design if it takes ten times longer.

**Open questions**

| ID | Question | Load-bearing? | Context needed to answer | Impact of deferring |
|---|---|---|---|---|
| OQ-1 | Branch (a), (b) or (c)? | **Yes** — decides what the work item does | § 4; council split; the owner's fix-or-track rule | the alert stays open with no recorded reason |
| OQ-2 | Owner by hand, or an agent run with the owner's approval in its task record? | Yes for execution, no for the design | needs alert write access | the item cannot be executed by `/do` without it |
| OQ-3 | Does an advisory withdrawal auto-close an open alert? | No under (a); yes under (b) | not documented in the pages read | branch (b) may never close |

**Gates in this run**: feasibility gate PASS (all FEASIBLE); risk gate PASS (no HIGH); quality gate PASS (security addressed above; reliability N/A — no runtime). Forward coverage: every requirement covered (§ 16). Backward coverage: every element traced (§ 16b). **Lock: not granted** — OQ-1 is load-bearing, and the product and UX ratification lenses were not dispatched (this run cannot re-delegate and no person was present). The UX lens has no subject here (no interface, task flow or information architecture), but that N/A may not be self-declared by this run, so it is recorded as unratified.

## 15. Glossary

| Canonical name | Definition | Aliases |
|---|---|---|
| Alert #89 | Dependabot alert number 89 on this repository | "the deepmerge alert" (synthesis); `dependabot/alerts/89` (REST) |
| Advisory | GitHub advisory GHSA-gcqx-w48m-w2h4 | "GHSA" |
| Disposition | the recorded end state of alert #89: dismissed with reason, or open with tracked close condition | — |
| Evidence set | the four re-reads of REQ-DM-003 | — |
| Close condition | what ends the keep-open branch: advisory withdrawn, or a fixed version published | — |

## 16. Requirement-to-Track Coverage Matrix

| Requirement | Applicable tracks | Covered in | Test capability | Status |
|---|---|---|---|---|
| REQ-DM-001 | Technical Architecture | § 4 step 3, § 5 | CAP-1 | covered |
| REQ-DM-002 | Technical Architecture, Security | § 4 step 3 (a), AD-3, AD-4 | CAP-1 | covered |
| REQ-DM-003 | Technical Architecture, Testing | § 4 step 1, § 6b | CAP-2 | covered |
| REQ-DM-004 | Technical Architecture, Security | § 4 step 2, § 6b guard | CAP-2 | covered |
| REQ-DM-005 | Security | AD-5, § 11 Security | CAP-1 | covered |
| REQ-DM-006 | Security | § 2, § 11 Security | CAP-3 | covered |

No UNCOVERED entries.

## 16b. Element-to-Requirement Backward-Coverage Matrix

| Element | Type | Traces to | Provenance | Status |
|---|---|---|---|---|
| Alert #89 record | entity | REQ-DM-001 | PRD § 10 | traced |
| Evidence set | entity | REQ-DM-003 | PRD § 10 | traced |
| Dismissal comment | entity | REQ-DM-002 | PRD § 10 | traced |
| Tracking issue | entity | REQ-DM-001 (b) | PRD § 10 | traced |
| Disposition work item | component | REQ-DM-001 to REQ-DM-006 | PRD § 10 | traced |

No screens and no calls to action exist (no interface). No PHANTOM entries.
