> **Location is ratification-pending.** This repository had no `docs/features/` directory and no feature-file convention before this file. The path `docs/features/bump-puppeteer-precommit-check.feature.md` is a choice made while scoping, not an existing project convention. The maintainer may move it, or fold its scenarios into the work item and delete it.
>
> **Tier B.** Every scenario below is written in executable form and is not yet bound to a test. Binding: the scenarios under "Rule: bump mode" bind to Jest cases in `scripts/checkBumpInvariants.test.ts` (the checker's test file), which run in CI. The scenarios under the other rules describe a written procedure (`.claude/commands/bump-puppeteer.md`) and `CLAUDE.md`; they are judged by review against this file and observed at the first real bump after merge. No step definitions exist.
>
> **Conditional rule.** "Rule: bump mode" applies only if the maintainer ratifies bump mode. If the maintainer rejects it, those scenarios are dropped and the procedure step runs the state-mode command.

# Feature: `/bump-puppeteer` checks the bump invariants before it commits

As the maintainer who runs `/bump-puppeteer` (or the agent running it for the maintainer),
I want the procedure to run the bump-invariant checker after it edits the four bump files and before it commits,
so that a bump commit never lands with `package.json`, `package-lock.json`, `.github/workflows/ci.yml` and `.github/workflows/publish.yml` disagreeing about the puppeteer version.

Vocabulary: `P` is the new pin (`package.json` `devDependencies.puppeteer` in the working tree). `O` is the previous pin, read from the base revision. The checker is the command `npm run check:bump`. Its exit codes: `0` no violation, `1` at least one violation, `2` call or environment error, `3` internal error in the checker.

## Example Map (solo session, scope time)

- **Story (yellow)**: the story above.
- **Rules (blue), 5**:
  1. The check gates the commit.
  2. Each non-zero exit has one prescribed response, and the checker is never edited to get a pass.
  3. The merge gate requires the `bump-invariants` CI check to pass.
  4. The documents name the command as the executable form of the rules, and route Dependabot puppeteer PRs to be superseded.
  5. (conditional) Bump mode checks the change against the base revision. This rule bundles the checker's four bump-mode rules B1–B4; counted one by one, the map has 8 rules.
- **Examples (green), 24**: the 18 single scenarios plus the 6 rows of the two Scenario Outline tables below.
- **Questions (red), 2**:
  1. Does the maintainer ratify bump mode? It decides whether Rule 5 is built at all.
  2. When the base revision lacks one of the four files (`git show <rev>:<path>` fails), is the run a call error (exit 2) or a violation with `observed=absent`? The design lists this case under "fail closed" and names no outcome.

```gherkin
Feature: /bump-puppeteer checks the bump invariants before it commits

  Rule: The check gates the commit

    Scenario: AC1 A correct bump passes and is committed
      Given the procedure has edited the four bump files for a bump from 25.16.0 to 25.17.0
      And it has regenerated the lockfile with npm install
      When the procedure runs the checker
      Then the checker exits 0
      And the procedure commits the four files with the message "(imp) puppeteer v25.17.0"

    Scenario: AC2 A missed workflow edit is caught, fixed and re-checked before the commit
      Given the edit step left publish.yml job validate at PUPPETEER_VERSION 25.16.0
      When the procedure runs the checker
      Then the checker exits 1 with a line starting "I5 .github/workflows/publish.yml"
      And the procedure fixes that value, runs the checker again, and commits only after exit 0
      But NOT committing while the checker's last exit was non-zero

    Scenario: AC3 The check step sits between the edit step and the commit step
      Given the procedure document .claude/commands/bump-puppeteer.md
      When a reviewer reads Phase 2
      Then a step running the checker appears after "Update the 4 files" and before "Commit"
      And that step commits only on exit 0

  Rule: Each non-zero exit has one prescribed response, and the checker is never edited to get a pass

    Scenario: AC4 A lockfile violation is fixed by npm install, never by hand
      Given the checker exits 1 with a line starting "I6 package-lock.json"
      When the procedure responds
      Then it runs npm install and runs the checker again
      But NOT editing package-lock.json by hand

    Scenario: AC5 A call error is fixed in the call
      Given the checker exits 2 because the base revision origin/main cannot be resolved
      When the procedure responds
      Then it reads the stderr message, runs git fetch origin, and runs the checker again

    Scenario Outline: AC6 The procedure stops and reports instead of committing
      Given the checker run ends with <outcome>
      When the procedure responds
      Then it does not commit
      And it does not edit scripts/checkBumpInvariants.js
      And it reports the checker's full output to the maintainer

      Examples:
        | outcome                                                             |
        | exit 3 with a stderr line starting "internal error:"                |
        | exit 1 on a violation that is still there after its named fix       |
        | exit 1 on a violation the agent judges to be false                  |

  Rule: The merge gate requires the bump-invariants CI check to pass

    Scenario: AC7 A red bump-invariants check blocks the merge even when every integration cell passed
      Given the pull request's integration cell count equals the matrix size and every cell passed
      And the check bump-invariants is failing
      When the procedure reaches its merge HARD GATE
      Then it does not merge

    Scenario: AC8 The pull request test plan names the check
      Given the procedure creates the bump pull request
      When it writes the pull request body
      Then the test plan lists the check bump-invariants next to the CI build and integration items

  Rule: The documents name the command as the executable form of the rules and route Dependabot puppeteer PRs to be superseded

    Scenario: AC10 CLAUDE.md names the command
      Given CLAUDE.md after this change
      When a reader opens "Build Commands" and "Puppeteer Version Bump Procedure"
      Then both name npm run check:bump
      And "Puppeteer Version Bump Procedure" calls it the executable form of the rules
      But NOT restating the checker's rules beyond naming them

    Scenario: AC11 The checker's cited section headings still exist
      Given the checker cites "CLAUDE.md § Puppeteer Version Bump Procedure › 1. package.json" through "› 4. package-lock.json" and "CLAUDE.md § Testing › Integration tests"
      When CLAUDE.md is edited by this change
      Then each of those headings is still present with the same text

    Scenario: AC12 A Dependabot puppeteer PR is superseded, not repaired
      Given a Dependabot pull request that bumps only puppeteer or puppeteer-core and the lockfile
      When the maintainer follows CLAUDE.md
      Then the maintainer closes it as superseded and runs /bump-puppeteer
      But NOT hand-fixing the Dependabot branch

  Rule: Bump mode checks the change against the base revision (conditional on the maintainer ratifying bump mode)

    Scenario: AC15 A correct minor bump passes bump mode
      Given a base revision whose pin O is 25.16.0
      And a working tree with pin P 25.17.0 that changes only the four bump files
      And the peer range is the base range followed by " || ^25.17.0"
      And the matrix is the base matrix with '25.17.0' appended
      When npm run check:bump -- --base <base> runs
      Then it exits 0
      And the summary line reports 0 violation(s), 11/11 rules evaluated (10/10 if the maintainer drops invariant I7), the base revision with O 25.16.0, and the bump type minor

    Scenario: AC16 An extra changed file is named
      Given the same bump with README.md also changed
      When bump mode runs
      Then it exits 1 with exactly one violation, B1, naming README.md

    Scenario: AC17 An untracked extra file is named
      Given the same bump with a new untracked, non-ignored file notes.txt
      When bump mode runs
      Then it exits 1 with a B1 violation naming notes.txt

    Scenario: AC18 A minor bump that did not append the peer term fails
      Given a minor bump from 25.16.0 to 25.17.0 whose peer range equals the base range
      When bump mode runs
      Then a B2 violation is reported

    Scenario: AC19 A patch bump that kept the old matrix entry fails
      Given a patch bump from 25.17.0 to 25.17.1 that appended '25.17.1' and kept '25.17.0'
      When bump mode runs
      Then a B3 violation is reported

    Scenario: AC20 A workflow still at the previous version fails
      Given a bump from 25.16.0 to 25.17.0 where one PUPPETEER_VERSION definition in publish.yml still reads 25.16.0
      When bump mode runs
      Then a B4 violation names that definition

    Scenario: AC21 A tree with no bump against the base reports it once
      Given a working tree whose pin P equals the base pin O
      When bump mode runs
      Then it exits 1 with one B4 line whose observed value is "pin unchanged against base"
      And B2 and B3 are not evaluated, so the summary's evaluated count is two less than its in-scope count

    Scenario Outline: AC22 Bump-mode inputs fail closed
      Given <condition>
      When npm run check:bump -- --base <rev> runs
      Then it exits 2 with a stderr message naming <subject>
      And it prints no summary line and no pass

      Examples:
        | condition                                  | subject                |
        | the revision does not resolve              | the revision           |
        | the working directory is not a git repository | the missing repository |
        | git is not on PATH                         | git                    |

    Scenario: AC23 Bump mode is never required in CI
      Given the CI job bump-invariants
      When it runs on a pull request
      Then it runs npm run check:bump with no --base argument
```

## Scenario count and AC coverage

- Scenarios: 18 single scenarios and 2 Scenario Outlines with 3 rows each, 24 examples in all. Rule 1: 3. Rule 2: 2 + 3 outline rows. Rule 3: 2. Rule 4: 3. Rule 5: 8 + 3 outline rows.
- Each scenario is mirrored as one acceptance criterion in the work item, tier B, under the rule it belongs to.
- The base-revision-missing-a-file case is not written as a scenario: its outcome is red question 2.
