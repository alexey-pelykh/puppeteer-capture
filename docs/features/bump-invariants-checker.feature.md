# Feature: bump-invariant checker, state mode

> **Location is ratification-pending.** This project had no feature-file convention when this file
> was written (2026-11-14). `docs/features/` and the Markdown-with-Gherkin form (`.feature.md`) are a
> choice made during scoping, not an existing project rule. The owner may move or rename it.
>
> **Status: Tier B, pending.** The scenarios below are written in an executable format and are not
> yet bound. The implementing work item binds the `@binding:automated` scenarios to Jest tests in
> `scripts/checkBumpInvariants.test.ts`. No Cucumber step definitions exist and none are planned: the
> project's test framework is Jest, so a scenario is bound by a Jest test whose title carries the
> scenario's AC number.
>
> **Sources** (planning docs, landing on branch `docs/scope-council-gaps`):
> `docs/requirements/bump-invariants-unchecked-prd.md` (§ 10.1),
> `docs/design/bump-invariants-unchecked-solution-design.md` (§ 5, § 8, § 11.2, § 14.4).
> Their requirements and decisions are ratification-pending (owner).

## Example map (solo pass, 2026-11-14)

**Story (yellow card).** As the maintainer who merges puppeteer bump pull requests on CI green, I
want CI to report every disagreement among the four bump files, so that a wrong pin, workflow value,
lockfile entry or peer range cannot merge or ship unnoticed.

**Rules (blue cards), 5:**

1. Every binding of the version equals the reference pin `P` (I1, I3, I5, I6).
2. The peer range and the integration matrix carry one term or entry per (major, minor), include the
   pin's minor, agree with each other, and go no higher than the pin (I2, I4, I7).
3. Fail closed: an input that is missing, unreadable or in a shape the checker does not read is a
   violation, never a pass; a valid variant of the real files is never a violation.
4. Report contract: one line per violation, all violations in one run, a summary line, exit codes
   0/1/2/3, deterministic output, no side effects; bump mode is not available yet.
5. Delivery boundary: CI runs the check as an independent, least-privilege job on every pull request
   and push to `main`, and nothing of the checker is published.

Grouping note: one blue card per invariant would give 11 rules and trip the "more than 5 rules →
split" gate. The rules are grouped by the property they test, the same grouping the checker's
invariant table follows. The work item is not split; its granularity note says why.

**Questions (red cards), 3:**

1. Is I7 (peer minors equal matrix minors, none above the pin) ratified? (PRD Q-06.) Default: built.
   If rejected, scenario AC-07 and the `@gated:Q-06` rows drop, I7 leaves every expected set, and
   the summary reads `6/6`.
2. Is a prerelease pin such as `26.0.0-rc.1` an I1 violation? (Design Q-T1.) Default: yes, only
   `MAJOR.MINOR.PATCH` passes.
3. Will the owner ratify the PRD's Must set? (PRD readiness check 6.) Precondition for the item.

Not counted as red cards, with the reason: whether the Windows runner checks out CRLF (Q-07) — the
scenarios force LF, CRLF and mixed endings themselves, so no answer changes a scenario; whether the
check joins the `ci-ok` aggregate (Q-03) — owned by the sibling gap `gap-phantom-required-checks`,
and no scenario here depends on it.

**Examples (green cards):** 52 — one per scenario and one per Examples row below. 32 are bound by
automated tests in the implementing item, 9 by recorded evidence, review or CI observation, and 11
are tagged `@followup`.

## Conventions used in the scenarios

- A **fixture tree** is a fresh temporary directory holding copies of the live `package.json`,
  `package-lock.json`, `.github/workflows/ci.yml` and `.github/workflows/publish.yml`.
- `P` is the fixture's own `devDependencies.puppeteer`, with major `M`, minor `m` and patch `p`.
  `V` is `M.m.(p+1)`: a valid version that is not `P`. No version is hard-coded, so the scenarios
  stay valid after every bump, including a new major.
- "Exactly {…}" means the set of violation IDs printed equals that set: no ID missing, no ID extra.
- The checker runs as `node scripts/checkBumpInvariants.js` with the fixture tree as working directory.

```gherkin
@tier-B
Feature: Bump-invariant checker, state mode
  The four files a puppeteer bump touches must agree on one version.
  The checker reads them, never writes them, and reports every disagreement.

  Background:
    Given a fixture tree copied from the live repository

  Rule: Every binding of the version equals the reference pin P

    @binding:automated
    Scenario Outline: AC-01 a binding that differs from P is reported alone
      Given <edit>
      When the checker runs
      Then it exits 1
      And the violation IDs are exactly {<id>}
      And the <id> line names <where> with expected "<expected>" and observed "<observed>"

      Examples:
        | edit                                                                     | id | where                                                             | expected | observed |
        | package.json devDependencies "puppeteer-core" is set to "^P"             | I1 | package.json, devDependencies.puppeteer-core                      | P        | ^P       |
        | ci.yml build job env PUPPETEER_VERSION is set to V                       | I3 | .github/workflows/ci.yml, the build job                            | P        | V        |
        | publish.yml validate job env PUPPETEER_VERSION is set to V               | I5 | .github/workflows/publish.yml, the validate job                    | P        | V        |
        | package-lock.json packages["node_modules/puppeteer-core"].version is V   | I6 | package-lock.json, packages["node_modules/puppeteer-core"].version | P        | V        |

    @followup
    Scenario Outline: AC-02 a range operator in a pin is an I1 violation
      Given package.json devDependencies "puppeteer-core" is set to "<value>"
      When the checker runs
      Then it exits 1
      And the violation IDs are exactly {I1}

      Examples:
        | value  |
        | ~P     |
        | >=P    |
        | M.m.x  |
        | *      |

    @followup
    Scenario: AC-03 the reference value comes only from devDependencies.puppeteer
      Given package.json devDependencies "puppeteer-core" is set to V
      When the checker runs
      Then the summary line names pin P
      And the violation IDs are exactly {I1}

    @binding:automated
    Scenario: AC-04 a cache-key reference is not a definition
      Given ci.yml and publish.yml carry their "${{ env.PUPPETEER_VERSION }}" cache-key references
      When the checker runs
      Then no I3 or I5 violation is reported

  Rule: The peer range and the matrix carry one term or entry per minor, include the pin's minor, agree, and stop at the pin

    @binding:automated
    Scenario: AC-05 the pin's own peer term is missing, even where another term covers P
      Given the peer term "^M.m.0" is removed from package.json peerDependencies "puppeteer-core"
      When the checker runs
      Then it exits 1
      And the violation IDs are exactly {I2, I7}
      And the I2 line has expected "^M.m.0"
      And this holds although the remaining term "^M.0.0" covers P whenever m is greater than 0

    @binding:automated
    Scenario Outline: AC-06 matrix defects
      Given <edit>
      When the checker runs
      Then it exits 1
      And the violation IDs are exactly {<ids>}

      Examples:
        | edit                                                          | ids    |
        | the matrix gains "V" directly after "P" (a duplicate minor)   | I4     |
        | the matrix entry "P" is removed                               | I4, I7 |

    @binding:automated @gated:Q-06
    Scenario: AC-07 a peer term past the pin
      Given the peer range gains the term "^M.(m+1).0"
      When the checker runs
      Then it exits 1
      And the violation IDs are exactly {I7}

    @followup
    Scenario Outline: AC-08 boundary rows of the version-set rules
      Given <edit>
      When the checker runs
      Then it exits <code>
      And the violation IDs are exactly {<ids>}

      Examples:
        | edit                                                                         | code | ids |
        | the integration matrix gains a key "node-version" with one entry            | 0    |     |
        | the first matrix entry is removed while its peer term stays                  | 1    | I7  |
        | the peer range gains the term ">=M.0.0" (not of the form "^MAJOR.MINOR.0")   | 1    | I7  |

  Rule: Fail closed on unreadable input, never on a valid variant

    @binding:automated
    Scenario Outline: AC-09 a missing or unreadable input is a violation of every invariant that reads it
      Given <defect>
      When the checker runs
      Then it exits 1
      And the violation IDs are exactly {<ids>}
      And each of those lines has observed "<observed>" or expected "unknown (no valid pin)"

      Examples:
        | defect                                                        | ids                        | observed    |
        | package.json is deleted                                       | I1, I2, I3, I4, I5, I6, I7 | absent      |
        | package.json holds text that is not JSON                      | I1, I2, I3, I4, I5, I6, I7 | unparseable |
        | package.json devDependencies "puppeteer" is "M.m"             | I1, I2, I3, I4, I5, I6, I7 | M.m         |
        | package-lock.json is deleted                                  | I6                         | absent      |
        | package-lock.json is truncated to its first half              | I6                         | unparseable |
        | ci.yml is deleted                                             | I3, I4, I7                 | absent      |
        | ci.yml is an empty file                                       | I3, I4, I7                 | absent      |
        | publish.yml is deleted                                        | I5                         | absent      |
        | the "puppeteer-version:" key in ci.yml is renamed             | I4, I7                     | absent      |
        | the validate job's env block in publish.yml is removed        | I5                         | absent      |
        | the matrix is rewritten in flow style "[ ... ]"               | I4, I7                     | unparseable |
        | the build job's env value is replaced by a YAML alias "*ver"  | I3                         | unparseable |

    @binding:automated
    Scenario: AC-10 a flow-style matrix carries a hint
      Given the matrix is rewritten in flow style "[ ... ]"
      When the checker runs
      Then the I4 line contains "use a block sequence"

    @binding:automated
    Scenario Outline: AC-11 a valid variant of the real files is not a violation
      Given <variant>
      When the checker runs
      Then it exits 0

      Examples:
        | variant                                                                            |
        | a full-line comment is inserted inside the matrix                                  |
        | a matrix entry carries a trailing " # comment"                                     |
        | a matrix entry is double-quoted instead of single-quoted                           |
        | a commented-out line "# PUPPETEER_VERSION: 1.0.0" is added to the build job env    |
        | a "run: \|" block scalar in ci.yml gains a text line "PUPPETEER_VERSION: 1.0.0"     |

    @binding:automated
    Scenario Outline: AC-12 line endings do not change the verdict
      Given every fixture file is written with <endings> line endings
      And <state>
      When the checker runs
      Then it exits <code>
      And the printed output equals the output of the same tree written with LF endings

      Examples:
        | endings | state                                                      | code |
        | CRLF    | no other edit                                              | 0    |
        | mixed   | no other edit                                              | 0    |
        | CRLF    | publish.yml validate job env PUPPETEER_VERSION is set to V | 1    |

  Rule: Report contract

    @binding:automated
    Scenario: AC-13 the live tree passes and says what it checked
      Given no edit
      When the checker runs
      Then it exits 0
      And the last line is "bump invariants: pin P, 7/7 rules evaluated, 0 violation(s)"

    @followup
    Scenario: AC-14 every violation is reported in one run, in rule-ID order
      Given package.json devDependencies "puppeteer-core" is set to "^P"
      And publish.yml validate job env PUPPETEER_VERSION is set to V
      When the checker runs
      Then it exits 1
      And the violation lines are I1 then I5
      And the last line is "bump invariants: pin P, 7/7 rules evaluated, 2 violation(s)"

    @binding:automated
    Scenario: AC-15 violation lines follow the line format on every OS
      Given any scenario above that exits 1
      When its output is read
      Then every line except the last matches "<ID> <file> <key-path or job> expected=<value> observed=<value> (<source section>)"
      And no line contains a backslash path separator or a carriage return

    @binding:pr-evidence
    Scenario Outline: AC-16 a call error exits 2 with no summary line
      Given no edit
      When the checker runs with arguments "<args>"
      Then it exits 2
      And it prints a message on stderr and nothing on stdout

      Examples:
        | args               |
        | --base origin/main |
        | --verbose          |

    @followup
    Scenario: AC-17 an internal fault exits 3
      Given a fault is injected inside the checker
      When the checker runs
      Then it exits 3
      And stderr starts with "internal error:"
      And no summary line is printed

    @binding:pr-evidence
    Scenario: AC-18 output is deterministic
      Given no edit
      When the checker runs twice
      Then both runs print byte-identical output with no colour codes and no timestamps

    @binding:pr-evidence
    Scenario: AC-19 the checker changes nothing and needs no network
      Given no edit
      When the checker runs
      Then every file in the tree is byte-identical to before the run
      And the checker loads only Node.js built-in modules

  Rule: CI runs the check independently, and nothing of it is published

    @binding:ci-observed
    Scenario: AC-20 the check runs on the implementing pull request and on the merge commit
      Given the implementing pull request targets main
      When CI runs
      Then a check named "bump-invariants" reports success
      And it reports success again on the merge commit in main

    @binding:review
    Scenario: AC-21 the CI job is independent and least-privilege
      Given the job "bump-invariants" in .github/workflows/ci.yml
      When it is reviewed
      Then it has no "needs", no matrix, no job-level "name" key and no "npm ci" step
      And its permissions are "contents: read" only, it references no secret, and it checks out with "persist-credentials: false"
      And its only run line is "npm run check:bump"

    @binding:pr-evidence
    Scenario: AC-22 nothing of the checker is published
      Given the change is applied
      When "npm pack --dry-run --ignore-scripts" runs
      Then no listed file is under "scripts/"
      And package.json "files", "dependencies", "optionalDependencies" and "peerDependencies" are unchanged

    @binding:pr-evidence
    Scenario Outline: AC-23 historical replay finds the two known defects
      Given the four files extracted from commit <commit>
      When the checker runs on them in state mode
      Then the violation IDs are exactly {<ids>}
      And <defect>

      Examples:
        | commit  | ids            | defect                                                                                                                           |
        | 7966135 | I3, I4, I5, I7 | the I3 line has expected "24.1.0" and observed "24.1.1", and the I4 line reports the entry "24.1.0" missing                      |
        | 8d32d9c | I2, I5, I7     | the I2 line has expected "^24.0.0", and the I7 output reports minors 23.11 and 24.0 present in the matrix but not the peer range |

    @followup
    Scenario: AC-24 a Dependabot-shaped change turns the check red
      Given package.json devDependencies "puppeteer" and its lockfile entries for puppeteer are set to V
      When the checker runs
      Then the violation IDs are exactly {I1, I3, I4, I5, I6}
```

## Binding tags

| Tag | Meaning |
|---|---|
| `@tier-B` | Executable format, not yet bound |
| `@binding:automated` | Bound by a Jest test in `scripts/checkBumpInvariants.test.ts`, written by the implementing item |
| `@binding:pr-evidence` | Bound by a recorded local run quoted in the implementing pull request's body |
| `@binding:review` | Bound by review of the job definition, with a scripted grep quoted in the pull request body |
| `@binding:ci-observed` | Bound by the CI run on the pull request and on the merge commit |
| `@gated:Q-06` | Dropped if the owner rejects I7 |
| `@followup` | Kept here for the record; bound by the follow-up item that extends the tests to the full test plan |

## Notes on the expected sets

- **AC-04**: the live `ci.yml` and `publish.yml` already contain these references, so the test bound
  to AC-13 (live tree passes) also binds AC-04.
- **AC-05**: removing `^M.m.0` drops the pin's minor from the peer set while the matrix keeps it, so
  I7 fires beside I2. Without I7 (Q-06 rejected) the set is {I2}.
- **AC-06**: a duplicate minor leaves the set of minors unchanged, so I7 stays quiet. Removing `P`
  removes its minor from the matrix only, so I7 fires.
- **AC-09**: when `P` cannot be read, I1 reports it, and I2–I7 are each still evaluated and reported
  with `expected=unknown (no valid pin)`. They are never skipped.
- **AC-11, last row**: a line inside a block scalar is text, not a YAML key, so it is not a
  `PUPPETEER_VERSION:` definition. Design § 5.2 words definitions as "every line matching
  `^\s*PUPPETEER_VERSION:`", which this row contradicts; the row follows the design's test plan
  (CAP-10). Ratification-pending.
- **AC-23** expected sets were derived on 2026-11-14 by reading the four files at each commit with
  `git show`, not by running a checker, so they are written before any run. At both commits
  `publish.yml` had one job, `package`, so I5 reports the `validate` and `publish` jobs `absent`:
  noise of that era, not the defect. I7 fires at both commits because minor 23.11 was in the matrix
  and not in the peer range; at `8d32d9c` minor 24.0 was missing from the peer range as well, which
  is the defect. I1 and I6 pass at both commits; I2 passes at `7966135`; I3 and I4 pass at
  `8d32d9c`. The replay is judged on the observed values in the "defect" column.
