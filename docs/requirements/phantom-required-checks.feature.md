# Feature: one aggregate required CI check (`ci-ok`)

Specification stub for the aggregate job, written at scope time (Tier B: executable format, not yet bound to an
automated runner — this repository has no BDD runner; each scenario is exercised by a GitHub Actions run whose URL
the work item records). Requirements: `docs/requirements/phantom-required-checks-prd.md` § 10.1, § 10.2.

Example Mapping snapshot — Yellow: the aggregate job · Blue (rules): 4 · Green (examples): 6 · Red (open questions): 0
(the one candidate question, whether `github-pages` joins the gate, is answered "no" by the owner decision of
2026-11-14).

```gherkin
Feature: ci-ok aggregates build and every integration cell into one required check

  Rule: ci-ok always runs and reports exactly one check per workflow run

    Scenario: build fails
      Given a pull request whose build job fails
      When the ci workflow run finishes
      Then a check run named "ci-ok" exists on the head commit
      And its conclusion is "failure"
      But its conclusion is not "skipped"

    Scenario: check name does not follow the matrix
      Given a change that appends one puppeteer-version entry to the integration matrix
      When the ci workflow runs
      Then exactly one check run is named "ci-ok"
      And no check run is named "ci-ok (" followed by a matrix value

  Rule: ci-ok succeeds only when every needed job succeeded

    Scenario: all green
      Given a pull request whose 2 build cells and 118 integration cells succeed
      When the ci workflow run finishes
      Then "ci-ok" concludes "success"

    Scenario Outline: any non-success dependency fails the gate
      Given a pull request where <dependency> ends as <result>
      When the ci workflow run finishes
      Then "ci-ok" concludes "failure"

      Examples:
        | dependency                  | result    |
        | exactly one integration cell | failure   |
        | exactly one integration cell | cancelled |
        | the build job               | failure   |

  Rule: re-running failed cells re-evaluates the gate

    Scenario: transient cell failure recovered by re-run
      Given a run in which exactly one integration cell failed on attempt 1 only
      When "gh run rerun {RUN_ID} --failed" runs and that cell succeeds on attempt 2
      Then "ci-ok" on that commit concludes "success"

  Rule: the gate is required on main

    Scenario: green pull request merges without bypass
      Given branch protection on main requires only "ci-ok"
      And a pull request whose "ci-ok" concluded "success"
      When its merge state is read
      Then it is "CLEAN"
      And it merges with "gh pr merge {PR_NUMBER} --rebase"

    Scenario: red pull request is blocked
      Given branch protection on main requires only "ci-ok"
      And a pull request whose "ci-ok" concluded "failure"
      When its merge state is read
      Then it is "BLOCKED"
```
