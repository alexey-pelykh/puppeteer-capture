# Feature: TypeScript 7 toolchain

Executable-format acceptance scenarios (Tier B: written, not yet bound to step definitions) for issue #335, derived at scope time from `docs/requirements/typescript-7-toolchain-prd.md` (REQ-TC-001..005, REQ-DEP-001..002) and the master test plan in `docs/design/typescript-7-adoption-solution-design.md` § 11.1. Each scenario names the CI step or command that binds it; binding happens when #335 is implemented.

Example Mapping snapshot (2026-11-14): Blue (rules) 6 · Green (examples) 8 · Red (open questions) 1 — "adopt TypeScript 7 now, or stay on TypeScript 6?" (owner decision, open).

```gherkin
Feature: Build with TypeScript 7 while tools keep the TypeScript 6 API

  Rule: The build compiles lib/ only with TypeScript 7            # REQ-TC-001, CAP-1

    Scenario: A clean install builds with TypeScript 7
      Given a clean checkout of the branch
      When "npm ci" runs
      Then the build log contains the guard's version line with major version 7
      And lib/ exists
      But "package.json" scripts contain no bare "tsc" invocation

  Rule: The build refuses any compiler that is not TypeScript 7   # REQ-TC-002, CAP-2, #335 AC9

    Scenario: The guard rejects the TypeScript 6 compiler
      Given the guard's compiler override points at the TypeScript 6 compiler installed by the alias
      When "npm run build" runs
      Then it exits with a non-zero code
      And its output names the guard and a version starting with "6."
      But it never exits 0 with only a warning

    Scenario: The guard compiles with the compiler it version-checked
      Given the guard's compiler override points at a stub that reports "Version 7.9.9" and records its other arguments
      When "npm run build" runs, passing "--project ./tsconfig.build.json" to the guard
      Then it exits 0
      And the stub recorded "--project ./tsconfig.build.json"

  Rule: Tests and lint keep running on the TypeScript 6 API        # REQ-TC-003, CAP-3

    Scenario: Install, lint and test pass without force flags
      Given the branch's package.json and package-lock.json
      When "npm ci", "npm run lint" and "npm test" run in CI
      Then "npm ci" reports no ERESOLVE
      And lint exits 0
      And every test passing on the base passes on the branch
      But no workflow or npm script uses "--legacy-peer-deps" or "--force"

  Rule: The published output does not change                       # REQ-TC-004, CAP-4

    Scenario: TypeScript 6 and TypeScript 7 emit the same lib/
      Given lib/ built from tsconfig.build.json by TypeScript 6.0.3
      And lib/ built from tsconfig.build.json by the guard
      When the two trees are compared with "diff -rq"
      Then zero files differ, or each differing file is listed with a review note in the PR

  Rule: Sources and tests type-check under TypeScript 7            # REQ-TC-005, CAP-5

    Scenario: A type error in a test file fails CI
      Given a "*.test.ts" file containing a type error
      When "npm run typecheck" runs
      Then it exits with a non-zero code

    Scenario: The clean tree type-checks
      Given the branch without modifications
      When "npm run typecheck" runs
      Then it exits 0

  Rule: Dependabot does not re-create #266                         # REQ-DEP-001, REQ-DEP-002, CAP-6, CAP-7

    Scenario: The typescript alias is not bumped to TypeScript 7
      Given ".github/dependabot.yml" on the branch
      When it is read
      Then it ignores "typescript" versions ">=7"
      And after merge PR #266 is closed, not merged, naming the superseding PR
```
