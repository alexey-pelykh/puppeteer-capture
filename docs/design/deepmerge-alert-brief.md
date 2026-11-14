---
type: design-brief
date: 2026-11-14
source: deepmerge-alert-solution-design.md
workflow: /scope Stage 2 (/design-solution), autonomous run
status: draft
---

# Design Brief: Disposition of Dependabot alert #89 (deepmerge)

## Problem

Dependabot alert #89 (GHSA-gcqx-w48m-w2h4, deepmerge, low) has been open since 2026-10-27 with no recorded reason. Its CVE, CVE-2026-93753, was rejected on 2026-11-02 as not describing a vulnerability, the advisory is not withdrawn, and no fixed version exists. The maintainer needs the alert to end in a recorded, auditable state.

## Key Decisions

1. **One work item carries evidence, guard and disposition** — the evidence and guard only matter at the moment of the disposition. (Author-chosen default; ratification-pending.)
2. **Re-read every fact at execution and stop if the CVE is no longer rejected** — the facts are dated 2026-11-14 and can move. (Derives from REQ-DM-003 and REQ-DM-004.)
3. **If dismissed, the reason is `inaccurate`** — the CNA says the advisory does not describe a vulnerability; `not_used` would be false and `tolerable_risk` would concede a risk. (Author-chosen default; ratification-pending.)
4. **Full evidence lives on the work item; the alert comment carries the reason and citations only** — `dismissed_comment` holds at most 280 characters. (Author-chosen default; ratification-pending.)
5. **No automated close rule** — security items are never auto-closed. (Derives from REQ-DM-005.)

## Design Tracks

| Track | Approach | Key trade-off |
|---|---|---|
| Technical Architecture | one work item, three steps: re-read, guard, apply | simplicity over separate evidence and action items |
| Security Architecture (inline) | development-scope only; disclosure limited to public records; attributable action | none material |
| Testing Architecture (inline) | three manual acceptance checks quoted on the work item | no automation, because there is no code |

## Open Questions

- **OQ-1 (load-bearing): dismiss now (a), keep open until the advisory is withdrawn (b), or dismiss and also track the withdrawal (c)?** Context: the council split — configuration and security reviewers said dismiss with reason `inaccurate`; the testing reviewer said keep open. The owner's own rule says a validated finding is fixed unless the fix is out of scope, beyond capability and riskier than the defect; dismissal is in scope, one API call, and reversible. Recommendation: (a). Impact of deferring: the alert stays open with no recorded reason.
- **OQ-2: who applies it — the owner by hand, or an agent run carrying the owner's approval?** Context: it needs alert write access. Impact of deferring: `/do` cannot execute the item.
- **OQ-3 (not load-bearing under (a)): does an advisory withdrawal auto-close an open alert?** Not documented in the GitHub pages read on 2026-11-14. Matters only if (b) is chosen.

This brief stays `draft`: OQ-1 is load-bearing, and the product and UX ratification lenses were not run (the run was autonomous and could not dispatch them).

## Full Design

See [deepmerge-alert-solution-design.md](deepmerge-alert-solution-design.md).
