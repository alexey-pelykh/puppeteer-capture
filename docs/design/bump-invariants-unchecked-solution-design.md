# Solution Design: Puppeteer version-bump invariant checker

**Feature**: `bump-invariant-guard` (PRD § 10.1)
**Requirements input**: [`docs/requirements/bump-invariants-unchecked-prd.md`](../requirements/bump-invariants-unchecked-prd.md) (`dor_status: failed`, provenance check only)
**Design brief**: [`bump-invariants-unchecked-design-brief.md`](bump-invariants-unchecked-design-brief.md)
**Baseline**: repository revision `185a1ad` (`main`)
**Date**: 2026-11-14
**Status**: draft. Produced by `/design-solution` in autonomous mode. Nobody answered during the run. Every decision below that the owner has not made is marked ratification-pending (§ 12, § 14).

---

## 0. How this run was conducted

| Phase | What happened | Gate outcome |
|---|---|---|
| 1 Intake | Read the PRD, the four bump files, both workflows, `.github/dependabot.yml`, `jest.config.js`, the three `tsconfig` files, `CLAUDE.md` and `.claude/commands/bump-puppeteer.md`. The readiness verdict is `failed` on check 6, provenance (20 of 26 requirements are not owner-ratified). | HARD GATE (failed verdict). Taken on the autonomous path: proceed, with the PRD treated as the requirements input. The acknowledgment is recorded here as ratification-pending (DD-00). |
| Design-decision interview | Prior decisions D-01 to D-17 and questions Q-01 to Q-05 are carried forward unchanged, not re-decided. The forks this stage owns were triaged in § 12. None of them is a one-way door, so no open ADR stub was needed. | Decided per fork, each ratification-pending |
| 2 Shape | Product type: developer tooling (a CLI script) plus a CI job. Tracks selected in § 0.1. | Autonomous: selection recorded, not confirmed by a person |
| 3 Route | Technical, API (CLI contract), Security, Performance and Infrastructure (CI) were run in this context, which is the CI/CD architect's own specialty. Testing Architecture was dispatched to the `testing-architect` agent. | Every selected track produced output |
| 4 Validate | Feasibility § 14.1, risk register § 14.2, quality pillars § 13.2 | All Must-Have components FEASIBLE. No HIGH risk. No critical quality gap. |
| 5 Compare | Entity glossary § 15, consistency report § 15.2 | No conflict left open |
| 6 Synthesize | Forward matrix § 16, backward matrix § 16b. Dual-lens ratification § 17. | See § 17 |
| 7 Deliver | Brief written beside this file, with `status: draft` | Not committed by this run (§ 17.3) |

### 0.1 Track selection

| Track | Selected | Signal, or why it is absent |
|---|---|---|
| Technical Architecture | yes | A new component with its own boundaries (checker, CI job, procedure step) |
| Data Architecture | no | No persistent data. The "entities" are keys in four existing files. They are read and never stored. |
| UX/IA | no | No user interface. The only human-facing surface is terminal output, specified as a CLI contract in § 8. |
| API Design | yes, light | The CLI is an interface that CI, `/bump-puppeteer` and the sibling `ci-ok` aggregate consume (§ 8) |
| Security Architecture | yes, light | A CI job that runs code from pull requests, including fork and Dependabot PRs (trust boundary) |
| Performance Architecture | yes, light | REQ-CHK-Q-001 sets a runtime target |
| UX Prototype, UI/Visual | no | No UI |
| Infrastructure (CI pipeline) | yes | A new job in `ci.yml`, an optional step in `publish.yml` |
| Integration | folded into Infrastructure | Dependabot and the sibling `ci-ok` job are the only external parties, and both meet the design through CI |
| Testing Architecture | yes (never skipped) | Master test plan in § 11.2 |

---

## 1. Goals and Drivers

- **G1**: make the six documented cross-file bump invariants (I1–I6), and the inferred seventh (I7), executable. Today they exist only as prose in `CLAUDE.md` § Puppeteer Version Bump Procedure and `.claude/commands/bump-puppeteer.md`.
- **G2**: give CI an independent gate that sees these invariants. The `integration` job tests the matrix version through `npm install --no-save`, so it never reads the pin, the workflow values or the peer range (PRD § 2).
- **G3**: give `/bump-puppeteer` a pre-commit self-check. It runs the same command CI runs (REQ-CHK-I-001).
- **Driver**: audit finding `gap-bump-invariants-unchecked`. Two historical violations were measured (PRD § 2): `7966135` and `8d32d9c` (neither was tagged as a release; `git log --decorate` shows tag `1.8.0` on the commit after `7966135`, and tag `1.6.0` on the peer-range fix after `8d32d9c`).
- **Success criteria**: PRD § 4, unchanged. The design adds no metric.

## 1b. Non-Goals

- The npm registry "latest patch of each minor" rule (Q-01). It stays prose-only on pull requests.
- Making the check a required status. That belongs to the sibling `gap-phantom-required-checks` (Q-03).
- Any change to `.github/dependabot.yml` until Q-02 is answered.
- Changing the `integration` job's version swap, or the bump rules themselves.
- Detecting a version that is consistent everywhere but does not exist. `npm ci` already fails on that.
- Checking the "never skip an intermediate minor" rule (`.claude/commands/bump-puppeteer.md` § Rules). Only part of it needs the registry: knowing whether 24.44 exists before crossing to 25.0. The local part needs no registry: minors consecutive within each major, and a new major starting at `.0`. The baseline matrix is consecutive today (24.3–24.43, 25.0–25.17). The local part is excluded here only because no PRD requirement asks for it. Whether to add it is the owner's choice (Q-T2).
- GitHub `::error` annotations printed by the checker. They would make CI output differ from local output (REQ-CHK-I-001). A problem matcher in the job would avoid that and is deferred, not rejected (§ 12 DD-09).
- Anything under `~/.claude` (`/verify`, the harness instruction).

## 2. Constraints

| Constraint | Source | Effect on design |
|---|---|---|
| Offline, read-only, no package installation | REQ-CHK-C-001 | Node built-ins only. No `npm ci` in the check job. |
| Nothing shipped | REQ-CHK-C-002, `package.json` `files: ["lib/**/*", "LICENSE", "README.md"]` | Lives outside `src/`, because `tsconfig.build.json` compiles `src` into `lib`, which is published |
| One command for CI, local runs and `/bump-puppeteer` | REQ-CHK-I-001 | An npm script that wraps one file |
| Runs on the bump author's machine (macOS, Linux; Windows possible) and in CI on `ubuntu-24.04`. The test file also runs on `windows-2022`. | Dispatch fields; `ci.yml` `build` matrix | Platform-neutral Node. CRLF-tolerant reads. |
| Node `>=22.12` (`engines.node`) | `package.json` | Nothing newer than Node 22.12 is used (no type stripping, no `import.meta.main`) |
| Lint is `ts-standard` over the whole repository | `package.json` `lint` script | The script and its test must pass `ts-standard` |
| Tests are Jest with ts-jest, co-located `*.test.ts` | `CLAUDE.md` § Testing, `jest.config.js` | Test is `scripts/checkBumpInvariants.test.ts` |
| Least privilege in CI | REQ-CIJ-C-001 | `contents: read`, no secrets, no `pull_request_target` |
| Appetite: about one working day | PRD D-02 (ratification-pending) | The full design exceeds it. That is an estimate, not a measurement. § 14.4 names the minimum slice that fits and the order in which work is cut. |

## 3. Context and Scope

```
                 reads (never writes)
 ┌───────────────────────────────────────────────────────────────┐
 │ package.json          package-lock.json                       │
 │ .github/workflows/ci.yml   .github/workflows/publish.yml      │
 └───────────────▲───────────────────────────────────────────────┘
                 │
        ┌────────┴─────────┐   git show / git diff (bump mode only, local git)
        │ checker (C1)     │───────────────────────────────▶ base revision
        │ npm run check:bump│
        └──▲───────▲──────▲┘
           │       │      │
   CI job (C4)  /bump-puppeteer   maintainer's terminal
   bump-invariants   step (C5)
           │
           ▼
   ci-ok aggregate (sibling gap-phantom-required-checks; joins by job id, Q-03)
```

- **Inside the boundary**: the checker, its npm script, its tests, the CI job, the procedure step and the document edits.
- **Outside the boundary**: the npm registry (never contacted), branch protection and the `ci-ok` job (sibling), Dependabot (unchanged, Q-02), the `integration` job (unchanged).
- **Who triggers it**: pull requests and pushes to `main` (CI), the agent running `/bump-puppeteer`, and the maintainer running it by hand.

## 4. Solution Strategy

1. **One CommonJS JavaScript file, built-ins only** (`scripts/checkBumpInvariants.js`, with `// @ts-check` and JSDoc types). It must run where `npm ci` fails. That includes a bump whose lockfile was not regenerated, which is exactly the state I6 reports. So it cannot depend on `node_modules`. JavaScript rather than TypeScript, because Node 22.12 cannot run `.ts` without a flag. A probe on Node 26.13.0 also showed that a CommonJS-style `.ts` file is re-detected as ESM and fails on `require` (§ 12 DD-01).
2. **A purpose-built YAML-subset extractor instead of a YAML library.** It reads block mappings and block sequences of scalars by indentation and fails closed on anything else (§ 5.2, DD-02). This answers Q-04 at the design stage: no development dependency.
3. **An invariant table** with seven entries. Each entry carries its ID, its rule, the document section that states it, and an evaluator. This gives REQ-BMP-C-001 its per-invariant source citation and keeps the rules in one place.
4. **Two modes.** State mode reads only the tree (CI). Bump mode also reads a base revision through local `git` (`/bump-puppeteer`). The previous pin `O` comes from the base's `package.json`, not from an argument (DD-05).
5. **Black-box tests over the CLI contract.** A TypeScript Jest test spawns the script against temporary fixture trees. A probe showed that importing the `.js` file from a `.ts` test fails ts-jest with TS7016, and that a `.test.js` file fails `ts-standard` (DD-03).
6. **An independent CI job** `bump-invariants`. No matrix, no `needs`, no install. Its job ID is the stable check name that the sibling's `ci-ok` aggregate references.

## 5. Building Blocks

### 5.1 Components

| ID | Component | Path | Kind | Must/Could | Requirements |
|---|---|---|---|---|---|
| C1 | Checker | `scripts/checkBumpInvariants.js` (new `scripts/` directory) | CommonJS script, Node built-ins only | Must (state mode); bump mode is C1.3 | REQ-INV-C-001…007, REQ-CHK-B-001…005, REQ-CHK-C-001, REQ-CHK-C-002, REQ-CHK-Q-001 |
| C1.1 | Readers | in C1 | JSON reader (two files); workflow YAML-subset extractor (two files) | Must | REQ-CHK-B-003 |
| C1.2 | Invariant table | in C1 | `I1`…`I7` entries `{id, rule, source, evaluate}` | Must | REQ-INV-*, REQ-BMP-C-001 |
| C1.3 | Bump-mode checks | in C1 | `B1`…`B4` entries, active only with `--base` | Should; built in tracker item #2, gated on Q-08 | REQ-CHK-B-006 |
| C1.4 | Reporter | in C1 | Violation lines, summary line, exit code | Must | REQ-CHK-B-001, REQ-CHK-B-002, REQ-CHK-B-004 |
| C2 | npm script | `package.json` `scripts["check:bump"] = "node scripts/checkBumpInvariants.js"` | Entry point | Must | REQ-CHK-I-001 |
| C3 | Test suite | `scripts/checkBumpInvariants.test.ts` | Jest + ts-jest, spawns C1 | Must | REQ-CHK-Q-002, and verifies all of C1 |
| C4 | CI job | `.github/workflows/ci.yml` job `bump-invariants` | GitHub Actions job | Must | REQ-CIJ-B-001, REQ-CIJ-B-002, REQ-CIJ-C-001, REQ-CIJ-I-001 |
| C5 | Procedure wiring | `.claude/commands/bump-puppeteer.md` changes:<br>• a new step between 2.2 and 2.3, with the exit 0/1/2/3 branches and the stop-and-report rule of § 6b;<br>• `bump-invariants` added to the Step 2.4 test plan and to the Step 2.5 HARD GATE;<br>• a Rules line.<br>`CLAUDE.md` § Puppeteer Version Bump Procedure changes:<br>• it names the command as the executable form of the rules;<br>• it adds the "close a Dependabot puppeteer PR as superseded" sentence.<br>`CLAUDE.md` § Build Commands adds the command. | Documents | Must (B-001), Should (C-001) | REQ-BMP-B-001, REQ-BMP-C-001, REQ-CHK-I-001 |
| C6 | Release-time check | `.github/workflows/publish.yml` `validate`: `npm run check:bump` after checkout, before `npm ci` | Workflow step | Could, gated on Q-05 | REQ-CIJ-B-003 |
| C7 | Dependabot ignore | `.github/dependabot.yml` `npm` block `ignore` for `puppeteer`, `puppeteer-core` | Config | Could, gated on Q-02. Not built by default. | REQ-DEP-C-001 |
| — | `ci-ok` join | One `needs:` entry `bump-invariants` in the sibling's aggregate job | Interface only | Owned by the sibling (Q-03) | REQ-CIJ-I-001 (consumer side) |

The repository has no `scripts/` directory today, and no earlier example of a repository-tooling script. `scripts/` is this design's choice, not an existing project convention. The file name follows the project's camelCase rule for function files (`CLAUDE.md` § Code Conventions). Alternatives are in § 12b.

### 5.2 Readers (C1.1)

**JSON**: `package.json` and `package-lock.json` are read with `fs.readFileSync` + `JSON.parse`. If the file is missing, I1, I2 and I5 (or I6) report `absent`. If parsing fails, they report `unparseable`. Reading the 349 KB lockfile and parsing all three inputs took 0.11 s wall-clock on the author's machine (measured with `time node -e …` at `185a1ad`).

**Workflow YAML subset**: the extractor builds an indentation tree from the file text. Its rules:

1. Split on `/\r?\n/`. This handles CRLF checkouts on Windows. The repository has no `.gitattributes`, and whether the Windows runner sets `core.autocrlf=true` is unverified.
2. Ignore blank lines and lines whose first non-space character is `#`. Strip a trailing ` #…` comment from a scalar value.
3. A line `key: value` or `key:` at indent *n* is a mapping entry. Its children are the following lines indented more than *n*. A line `- value` is a sequence item of the nearest enclosing key.
4. Scalar values have matching `'…'` or `"…"` quotes removed.
5. **Fail closed**: an anchor (`&`), an alias (`*`), a block scalar (`|`, `>`), a flow collection (`[`, `{`) or a tab in the indentation, on a path an invariant reads, makes that path `unparseable`. A path that does not exist is `absent`. Either one becomes a violation of every invariant that reads the path (REQ-CHK-B-003).

Paths read:

| Path | File | Invariants |
|---|---|---|
| `jobs.build.env.PUPPETEER_VERSION` | `ci.yml` | I3 |
| every `PUPPETEER_VERSION` mapping key the extractor finds (a definition; `${{ env.PUPPETEER_VERSION }}` references never match, and text inside a `run: \|` block scalar is not a definition — resolved at scope time in #344 so the CAP-10 no-false-red cases hold; an earlier wording said "every line matching `^\s*PUPPETEER_VERSION:`") | `ci.yml`, `publish.yml` | I3, I5, B4 |
| `jobs.integration.strategy.matrix.puppeteer-version` (sequence) | `ci.yml` | I4, I7, B3 |
| `jobs.validate.env.PUPPETEER_VERSION`, `jobs.publish.env.PUPPETEER_VERSION` | `publish.yml` | I5 |

A full YAML parser was rejected for this job (DD-02). The extractor only needs the four paths above, and it fails closed whenever a file leaves the shape these files have had through 69 bump commits (PRD A-02).

### 5.3 Invariant table (C1.2)

`P` = `package.json` `devDependencies.puppeteer` (REQ-CHK-B-005), with (M, m) as its (major, minor). If `P` is absent or not `X.Y.Z`, I1 reports it. I2–I7 then report `observed=<their value>` and `expected=unknown (no valid pin)`. They are counted as evaluated-and-violated, never skipped.

| ID | Rule (summary; the full statement is the PRD requirement) | Source cited in the violation line | Requirement |
|---|---|---|---|
| I1 | `puppeteer` and `puppeteer-core` in `devDependencies` are both `^\d+\.\d+\.\d+$` and equal | `CLAUDE.md` § Puppeteer Version Bump Procedure › 1. `package.json` | REQ-INV-C-001 |
| I2 | `peerDependencies.puppeteer-core` split on `\|\|`, trimmed, holds the literal `^M.m.0` | same › 1. `package.json` | REQ-INV-C-002 |
| I3 | `jobs.build.env.PUPPETEER_VERSION` exists, and every `PUPPETEER_VERSION:` definition in `ci.yml` equals `P` | same › 2. `ci.yml` | REQ-INV-C-003 |
| I4 | The `puppeteer-version` sequence is all `X.Y.Z`, has no duplicate (major, minor), and contains `P`. Other matrix keys are ignored. | same › 2. `ci.yml`; `CLAUDE.md` § Testing › Integration tests | REQ-INV-C-004 |
| I5 | `validate` and `publish` each define `env.PUPPETEER_VERSION`, and every definition in `publish.yml` equals `P` | same › 3. `publish.yml` | REQ-INV-C-005 |
| I6 | Lockfile `packages[""].devDependencies.puppeteer` / `["puppeteer-core"]` and `packages["node_modules/puppeteer"].version` / `["node_modules/puppeteer-core"].version` all equal `P` | same › 4. `package-lock.json` | REQ-INV-C-006 |
| I7 | Every peer term matches `^\^(\d+)\.(\d+)\.0$`. The set of (major, minor) pairs from the peer terms equals the set from the matrix, and no pair is greater than (M, m). | `CLAUDE.md` § Testing › Integration tests ("from 24.3 up to the current pin") | REQ-INV-C-007 (Should, ratification-pending) |

A peer term that does not match `^M.m.0` is reported under I7 (fail closed, DD-07). It is not silently dropped from the set. If the owner ever changes the peer-range style, I2 and I7 must change in the same commit (PRD R6).

### 5.4 Bump-mode checks (C1.3)

Active only with `--base <rev>`. Base files are read through `git show <rev>:<path>`. Changed files come from `git diff --name-only <rev>`, which compares the working tree (staged and unstaged) with the base. `O` = `<rev>:package.json` `devDependencies.puppeteer`. The bump type is patch if (major, minor) of `O` equals (M, m), and minor or major otherwise.

| ID | Rule | Requirement |
|---|---|---|
| B1 | The changed-file set is exactly `{package.json, package-lock.json, .github/workflows/ci.yml, .github/workflows/publish.yml}`. The set is the union of `git diff --name-only <rev>` (tracked, staged and unstaged) and `git ls-files --others --exclude-standard` (untracked). Each extra or missing file is reported. | REQ-CHK-B-006 |
| B2 | Minor or major bump: new peer range = base range + `" \|\| ^M.m.0"`. Patch bump: peer range unchanged. | REQ-CHK-B-006 |
| B3 | Minor or major bump: new matrix = base matrix with `'P'` appended. Patch bump: the base entry of (M, m) is replaced by `'P'` in place, with no second entry. | REQ-CHK-B-006 |
| B4 | No `PUPPETEER_VERSION:` definition in either workflow still equals `O`. If `O == P` (no bump against the base), B4 reports one violation, `observed=pin unchanged against base`, instead of one per definition, and B2 and B3 are not evaluated. | REQ-CHK-B-006, REQ-CHK-B-002 |

If the base revision cannot be resolved, or `git` is missing, the run is a usage error (exit 2). The message names the revision. It never becomes a pass.

## 6. Runtime View

### 6b. System interactions

**Pull request or push to `main`**
1. `ci.yml` starts. The `bump-invariants` job starts at once, in parallel with `build` (no `needs`).
2. Checkout (`persist-credentials: false`), then setup-node `lts/jod`, then `npm run check:bump`. There is no `npm ci`.
3. C1 reads the four files and evaluates I1–I7. It prints the violation lines and the summary line, and exits 0 or 1. The job result is the check `bump-invariants` on the commit SHA.
4. The sibling's `ci-ok` aggregate, if it lists `bump-invariants` (Q-03), fails when this job fails.

**`/bump-puppeteer` run**
1. Step 2.2 edits the four files and runs `npm install`.
2. New step: `npm run check:bump -- --base origin/main`. This is state mode plus B1–B4 against the branch point. If Q-08 rejects bump mode, the step is `npm run check:bump` (state mode only).
3. On exit 1: fix the named file and re-run. For the lockfile, re-run `npm install`; never edit it by hand. Never edit the checker to make it pass (REQ-BMP-B-001, PRD R4).
4. On exit 2: read stderr and fix the call. For example, `git fetch origin` when the base cannot be resolved. Then re-run.
5. On exit 3, or on a violation that persists after its named fix, or one the agent judges false: stop. Do not commit and do not edit the checker. Report the full output to the maintainer. A false red is fixed in the checker before the next bump (PRD § 4 decision gate).
6. On exit 0: Step 2.3 commit.
7. Step 2.4: the PR test plan lists `bump-invariants`. Step 2.5: the merge HARD GATE requires `bump-invariants` to be `pass`, next to the integration cell count. The merge uses `--admin`, so the procedure's own gate is the only thing that holds it.
8. CI runs state mode again as the independent gate.

**Dependabot puppeteer PR**:
1. Dependabot changes only `devDependencies.puppeteer` (or `-core`) and the lockfile.
2. I1 fails. I3–I6 then report the bindings that no longer match. The check is red, which is the intended signal.
3. Last step: the maintainer closes the PR as superseded and runs `/bump-puppeteer` (PRD § 5 scenario 3). The maintainer does not hand-fix the Dependabot branch, because that would bypass the one-release-per-minor cycle. `CLAUDE.md` § Puppeteer Version Bump Procedure gains this sentence (C5).

**Release (only if Q-05 is answered yes)**: `publish.yml` `validate` runs `npm run check:bump` before `npm ci`. A violation fails `validate`, and `publish` never starts.

## 7. Deployment View

| Environment | What runs | Notes |
|---|---|---|
| CI job `bump-invariants` | C1, state mode | `ubuntu-24.04`, `timeout-minutes: 5`. One job, no matrix. |
| CI `build` (`ubuntu-24.04`, `windows-2022`) | C3 tests, through `npm run test` | Exercises CRLF tolerance on Windows if the checkout is CRLF |
| CI `integration` cells (118) | C3 tests, through `npm run test` | `npm install --no-save` swaps only `node_modules`. `package.json` and the lockfile stay as committed, so the fixtures stay valid. |
| `publish.yml` `validate` | C1, state mode | Only if C6 is built (Q-05) |
| Maintainer or agent machine (macOS, Linux, Windows) | C1, state or bump mode | Needs only Node `>=22.12` and, for bump mode, `git` |

Job definition (target shape; the implementer copies the pinned action SHAs already used in `ci.yml`):

```yaml
  bump-invariants:
    runs-on: ubuntu-24.04
    timeout-minutes: 5
    permissions:
      contents: read
    steps:
      - name: Checkout
        uses: actions/checkout@<same pinned SHA as the other jobs>
        with:
          persist-credentials: false
      - name: Use Node.js lts/jod
        uses: actions/setup-node@<same pinned SHA as the other jobs>
        with:
          node-version: lts/jod
      - name: Check bump invariants
        run: npm run check:bump
```

## 8. Interface Contracts

### 8.1 CLI contract (consumed by CI, `/bump-puppeteer`, the maintainer)

| Element | Contract |
|---|---|
| Command | `npm run check:bump` (state mode); `npm run check:bump -- --base <rev>` (bump mode, from tracker item #2 and only if Q-08 ratifies it; before then `--base` is an unknown argument, exit 2). Equivalent: `node scripts/checkBumpInvariants.js [--base <rev>]`. |
| Working directory | The repository root. The script resolves every file against `process.cwd()`, never against `__dirname`, so the tests can point it at fixture trees. |
| Violation line | `<ID> <file> <key-path or job> expected=<value> observed=<value> (<source section>)`, one per violation. `<ID>` is `I1`…`I7` or `B1`…`B4`. `<file>` always uses POSIX `/` separators relative to the root, on every OS. `observed` may be `absent` or `unparseable`. A flow-style matrix is reported as `unparseable`, with the hint `use a block sequence`. No guessed cause (REQ-CHK-B-002). |
| Line order | Violation lines appear in rule-ID order (`I1`…`I7`, then `B1`…`B4`), then by file and key. In a cascade, the root cause therefore comes first. Examples: the Dependabot case gives {I1, I3, I4, I5, I6}; an invalid pin gives I1 and then `expected=unknown` lines. |
| Summary line (last line of the checker's output, printed on exit 0 and exit 1) | `bump invariants: pin <P>, <e>/<s> rules evaluated, <k> violation(s)`. `<s>` is the number of rules in scope: 7 in state mode (6 if Q-06 drops I7), plus 4 in bump mode. `<e>` is the number evaluated. In bump mode with `O == P`, B2 and B3 are not evaluated, so `<e>` is two less than `<s>`, and the B4 line says why. In bump mode the summary also gives `base <rev> (<O>), <bump type>`. The pin appears last, not first as PRD § 9 "Attribute priority" suggests: a CI log is read from its tail. This deviation is recorded here. Measured: `npm run` prints a two-line header before the script's output and nothing after a failing script, with exit code 1 passed through (npm 11.20.0, and npm 10.9.10 run through `npx`). |
| Exit codes | `0` no violation. `1` at least one violation. `2` call or environment error: unknown argument, unresolvable base revision, missing `git` in bump mode. Only a stderr message is printed, with no summary line. `3` internal error in the checker itself (an uncaught exception). Only a stderr message starting `internal error:` is printed. Exits `2` and `3` never print a pass. |
| Determinism | Same tree gives byte-identical output, locally and in CI (REQ-CHK-I-001). No colour, no timestamps, no CI-specific annotations. |
| Side effects | None. No writes, no network (REQ-CHK-C-001). |

Example (illustrative, not measured):

```
I5 .github/workflows/publish.yml jobs.validate.env.PUPPETEER_VERSION expected=25.17.0 observed=25.16.0 (CLAUDE.md § Puppeteer Version Bump Procedure › 3. publish.yml)
bump invariants: pin 25.17.0, 7/7 rules evaluated, 1 violation(s)
```

### 8.2 CI check contract (consumed by the sibling `ci-ok` aggregate and by branch protection)

- **Job ID and check name**: `bump-invariants`. There is no `name:` key and no matrix, so the check name equals the job ID and never varies by run (REQ-CIJ-I-001).
- **How it joins `ci-ok`**: the sibling's aggregate adds `bump-invariants` to its `needs:` list. This design does not edit the sibling's job. If Q-03 is answered "include", the item that lands second carries that one-line `needs` entry, recorded as a tracker relation between the two items (DD-11, ratification-pending). If the answer is "exclude", the check stays advisory.
- **Name stability rule**: renaming the job ID is a breaking interface change. It must update the `ci-ok` `needs` list in the same commit.

## 11. Crosscutting Concepts

### 11.1 Security

- **Trust boundary**: the job runs code from the pull request's own tree, including Dependabot PRs and fork PRs. It runs under the `pull_request` event. It never runs under `pull_request_target`, so fork PRs get a read-only token and no secrets (REQ-CIJ-C-001).
- **Permissions**: the job declares `permissions: contents: read`, which matches the workflow default. It references no `secrets.*` value.
- **Injection**: the `run:` line is a constant (`npm run check:bump`). It interpolates no `${{ github.event.* }}` value.
- **Credential persistence**: `persist-credentials: false` on checkout, because the job never pushes.
- **Supply chain**: no new dependency. The actions are the same SHA-pinned versions the other jobs use.
- **What a malicious PR can do**: edit the checker so it passes. The diff shows that edit, and the reviewer sees it. This is the same exposure as for any test in the repository (PRD R4).

### 11.2 Testing — master test plan

Authored by the Testing Architecture track (`testing-architect` agent), condensed here. The section list follows `test-plan-format`. MTP section on AI/LLM components: N/A, because the system has no AI or LLM component.

**Pyramid.**
- About 85% CLI black-box cases on fixtures, table-driven, roughly 90 cases.
- About 12% bump-mode cases against a real temporary git repository, about 14 cases.
- About 3% one static constraint: a `require` allowlist of `fs`, `path` and `child_process`.
- No contract, performance or end-to-end automation layer. The process boundary is the only seam, and there is no integration layer apart from git.
- Case counts are planned, not measured.

**Oracle rule.** This is stricter than the PRD wording. A negative test requires exit 1, parses every non-summary line with the anchored line regex, and requires the set of violation IDs to equal the expected set exactly. Under fail-closed, a broken fixture reports every invariant as `absent`, which would also satisfy "contains the ID". No Jest snapshots are used, because expected values come from the PRD GWT and not from what the checker printed.

**Fixtures.**
- Each fixture is a copy of the live four files in an `fs.mkdtempSync` directory. Every value is derived at run time from that fixture's own `P`, for example a duplicate minor is `M.m.(patch+1)`. So the fixtures stay valid across bumps, including a 26.0 crossing.
- An `edit()` helper throws if its match count is wrong, so a no-op edit cannot pass silently.
- Each case forces LF, CRLF and mixed line endings in the test itself, rather than relying on the runner's `core.autocrlf`.
- Bump-mode cases run git with hermetic settings: an empty `GIT_CONFIG_GLOBAL`, `GIT_CONFIG_NOSYSTEM=1`, `commit.gpgsign=false` and `core.autocrlf=false`. A missing `git` fails the suite. It never skips.
- A `beforeAll` guard runs the checker on the unedited copy. If that fails, it throws one message ("the live tree violates the invariants; fix that first") instead of about 100 misleading failures.

**Historical replay.** This is a one-off local acceptance check, because CI checkouts are shallow. The two commits' four files are extracted with `git archive` and state mode is run on them.

| Commit | Expected result |
|---|---|
| `7966135` | I3: expected `24.1.0`, observed `24.1.1`. I4: expected entry `24.1.0` absent. I1 and I2 pass. |
| `8d32d9c` | I2: expected `^24.0.0`. I7 reports the 24.0 mismatch. |

At both commits `publish.yml` had a single job named `package`, so I5 reports `absent`. That is structural noise of that era, not the defect. Judge the replay on the observed values. Expected results are written before the run.

**Capability matrix (risk = likelihood × impact).**

| CAP | Verifies | Level | Risk |
|---|---|---|---|
| CAP-01…07 | Detection of I1…I7, each with its PRD GWT rows and BUT-NOT rows (operators, semantic peer coverage, `${{ env.* }}` references, extra matrix keys, a missing job, each of the four lockfile keys, an extra peer term or dropped matrix minor) | CLI | 6 each (I7: 4) |
| CAP-08 | Baseline passes: exit 0, `7/7` evaluated, `0 violation(s)` | CLI | 6 |
| CAP-09 | Fail closed for each file: absent, empty, truncated, garbage; a missing key, job or env block; an unreadable `P` cascades | CLI | 6 |
| CAP-10 | No false red on valid variants: full-line and trailing comments, quoted scalars, a commented-out definition, block-scalar text containing `PUPPETEER_VERSION:`, unrelated block scalars (`ci.yml` has `run: \|` at lines 49, 174 and 205) | CLI | 6 |
| CAP-11 | Report all in one run. The Dependabot-shaped fixture (only `devDependencies.puppeteer` moved to the next patch) gives exactly {I1, I3, I4, I5, I6}. | CLI | 4 |
| CAP-12 | Violation line format: anchored regex, POSIX paths on Windows, no `\r`, no cause text | CLI | 4 |
| CAP-13 | Exit codes 0, 1, 2 and 3: an unknown flag and `--base` with no value give 2; an injected internal fault gives 3 with the `internal error:` prefix; the summary line is printed only on 0 and 1; violation lines appear in rule-ID order | CLI | 2 |
| CAP-14 | The reference value comes only from `devDependencies.puppeteer` | CLI | 4 |
| CAP-15 | LF, CRLF and mixed line endings give identical verdicts | CLI | 6 |
| CAP-16 | Offline and read-only: runs with an empty `PATH`; the fixture tree hash is unchanged afterwards; static `require` allowlist | CLI + static | 2 |
| CAP-17…20 | B1…B4: four-file set (including untracked and deleted files); peer append or no change; matrix append or replace; stale `O`; the `O == P` case | CLI, git repo | 4 each |
| CAP-21 | Bump-mode inputs fail closed: unresolvable base, base missing a file, not a git repository | CLI, git repo | 4 |
| CAP-22 | Scale: 2000 matrix entries and peer terms, with no pathological regex backtracking | CLI | 4 |
| CAP-23 | Nothing shipped: `npm pack --dry-run --ignore-scripts` lists no checker file; no new runtime or peer dependency; `files` unchanged | one-off + review | 3 |
| CAP-24 | CI wiring: runs on PR and push to `main`, no path filter, no `needs`, no matrix, stable name, no `npm ci` | review + CI-observed + throwaway-PR probes | 6 |
| CAP-25 | Least privilege, checked by a scripted grep of the job block: `contents: read`, no `secrets.`, no `github.event` or `head_ref` in `run:`, no `pull_request_target`, `persist-credentials: false` | review | 3 |
| CAP-26 | Procedure and documents: the step sits between 2.2 and 2.3 and commits only on exit 0; the documents name the checker without restating its logic | review; CI-observed at the first real bump | 4 |
| CAP-27 | Runtime: median of the first 10 CI runs ≤ 10 s, plus one local `time` | CI-observed | 1 |
| CAP-28 | Release-time step, if C6 is built: before `npm ci`, no secrets | review | 2 |

Every test title carries its `REQ-…` ID, so `grep -o 'REQ-[A-Z]*-[A-Z]-[0-9]*'` over the test file lists the requirements it covers. A test without a tag, and a requirement without a test, are both review findings. REQ-DEP-C-001 is non-testable for now because it is not built (Q-02).

**Environments.**

| Environment | What runs there |
|---|---|
| Local, macOS or Linux | Checker, tests and acceptance checks |
| CI `build`, ubuntu and windows | Tests. The Windows leg catches path-separator and CRLF bugs. |
| 118 `integration` cells | Tests again. Redundant, and harmless. |
| `bump-invariants` job | The checker only |

**Quality gates for the implementing PR (handoff to CI).**

| Gate | When | What must hold |
|---|---|---|
| G1 | Local, before push | `npm run lint`, `npm run test -- scripts/` and `npm run check:bump` all exit 0 |
| G2 | CI, before merge | `bump-invariants` green; `build` green on both OS; all `integration` cells green; no `.skip` or `.todo` in the new test file. A red `bump-invariants` cannot be bypassed. |
| G3 | Evidence in the PR body | See the list below |
| G4 | After merge | `bump-invariants` green on the merge commit. A red check lasting more than one day blocks releases (PRD § 4). |
| G5 | First `/bump-puppeteer` run after merge | Its transcript shows the step ran and exited 0 before the commit |

G3 evidence in the PR body:
- The replay table above.
- Seven manual mutants, one flipped comparison per invariant, each killed by a named test.
- Probe P1: a throwaway PR with `validate` left at the old version must turn `bump-invariants` red.
- Probe P2: a throwaway PR with a lint error but valid invariants must keep `bump-invariants` green while `build` is red.
- The `npm pack --dry-run` file list.
- A local `time` of the checker.
- The CAP-25 grep output.

**Test decisions (ratification-pending).**

| ID | Decision |
|---|---|
| T-1 | Exact ID-set oracle |
| T-2 | Fixtures copied from the live tree |
| T-3 | No snapshots |
| T-4 | Historical replay is a one-off, not a committed or environment-gated test |
| T-5 | Line endings forced in the test |
| T-6 | Hermetic git configuration |
| T-7 | Static `require` allowlist |
| T-8 | No timing assertion in Jest |
| T-9 | CI wiring proved by throwaway-PR probes rather than by parsing `ci.yml` in Jest |
| T-10 | Manual mutants instead of Stryker |
| T-11 | Never skip when `git` is absent |
| T-13 | The Dependabot-shaped expected set is derived from the PRD rules |
| T-14 | Live-tree precondition guard |
| T-15 | Measure suite runtime locally, and trim table rows if the Windows leg exceeds about 15 s |

The track's design-risk findings and how this document resolved them:

| Track finding | Resolution in this document |
|---|---|
| Fail-closed must be scoped to read paths | § 5.2 rule 5 |
| B1 misses untracked files | § 5.4 B1 |
| B4 behaves badly when `O == P` | § 5.4 B4 |
| Path separators in output | § 8.1 |
| Exit codes for environment errors | § 11.4 |
| Reads must resolve against `process.cwd()` | § 8.1 |

Still open: Q-T1 (prerelease pins) and Q-T2 (whether bump mode should check P > O and "no skipped minor"), in § 14.3.

### 11.3 Observability

The violation line is the observability surface: invariant ID, file, key, expected and observed value. The CI log keeps it per commit SHA. The false-red rate in PRD § 4 is measured by a triage note on each red check. No telemetry is added.

### 11.4 Error handling

| Condition | Behaviour |
|---|---|
| Input file missing or unreadable | A violation for each invariant that reads it, `observed=absent` (exit 1) |
| JSON or YAML subset not parseable on a needed path | A violation, `observed=unparseable` (exit 1) |
| Pin not `X.Y.Z` | I1 violation. I2–I7 still evaluated and reported with `expected=unknown (no valid pin)`. |
| Bad argument, unresolvable `--base`, no `git` | Call or environment error on stderr, exit 2. The message names what to fix, for example the revision to fetch. |
| Unexpected exception | Caught at top level. The stack is printed on stderr after the prefix `internal error:`, and the exit code is 3. A checker bug therefore never reads as a mistake in the call. Never exit 0. |

### 11.5 Accessibility

N/A. There is no visual interface. The output is plain ASCII text with no colour.

## 12. Architecture Decisions

All decisions below were taken by this run without the owner and are **ratification-pending**. PRD decisions D-01 to D-17 are carried forward unchanged. Reversibility: every one of them is a two-way door, because reversing it means rewriting a script of about 300 lines. So no open ADR stub was emitted. The decision records live here, not in `docs/decisions/`, because this run may write only the two design files.

| ID | Decision | Alternatives considered | Why this one | Door |
|---|---|---|---|---|
| DD-00 | Proceed on a PRD with `dor_status: failed` (provenance only) | Stop and return to requirements | The orchestrator instructed it. Checks 1–5 passed. | n/a |
| DD-01 | Checker language: CommonJS JavaScript with `// @ts-check` and JSDoc | (a) TypeScript run by Node type stripping; (b) TypeScript compiled by `tsc` before the run; (c) Bash, like the prior art `check-bump.sh`; (d) TypeScript under `src/` | (a) Node 22.12, the engines floor, needs a flag. A probe on Node 26.13.0 showed a CommonJS-style `.ts` file is re-parsed as ESM and fails on `require`. (b) Needs `npm ci` and a build step, which breaks "runs where `npm ci` fails". (c) Not testable in Jest, not portable to Windows, and the prior art depends on `ruby`. (d) Would be compiled into `lib` and shipped (REQ-CHK-C-002). JavaScript runs on every Node in range and lints clean: the probe ran a `scripts/*.js` file with `node` and `ts-standard` reported nothing. | two-way |
| DD-02 | YAML: purpose-built subset extractor, built-ins only (answers Q-04) | (a) Add the `yaml` package as a development dependency; (b) rely on the transitive `js-yaml` already in `node_modules` (3.15.2 and 4.3.2 are present, both through the eslint and jest trees) | Any dependency needs `node_modules`. The checker must report I6 on a tree where `package.json` and the lockfile disagree, which is exactly when `npm ci` fails, so a dependency would hide the defect it exists to report. (b) is undeclared and can vanish on any update. False-green risk is controlled by fail-closed rules plus tests built on the real files (§ 11.2). Also no new Dependabot stream. | two-way |
| DD-03 | Tests: one TypeScript Jest file that spawns the CLI as a child process | (a) a `.ts` test importing the `.js` module; (b) a `.test.js` Jest file; (c) Node's built-in `node:test` | Measured in a probe: (a) fails ts-jest with TS7016 ("Could not find a declaration file"); (b) prints a ts-jest `allowJs` warning and fails `ts-standard` (`test`, `expect` no-undef); (c) breaks the project's Jest convention, and Jest's default `testMatch` would also try to run the files. Black-box spawning tests the contract that CI and `/bump-puppeteer` actually use. | two-way |
| DD-04 | Location `scripts/`, file name `checkBumpInvariants.js` | `.github/scripts/`; `tools/`; kebab-case name | It is a developer tool as well as a CI tool, and `scripts/` is the common Node location. camelCase follows `CLAUDE.md` § Code Conventions for function files. There is no prior example in the repository (§ 5.1). | two-way |
| DD-05 | Bump mode takes only `--base <rev>` and derives `O` from `<rev>:package.json` | `--previous <O> --base <rev>` (PRD wording) | One input instead of two, so the two cannot disagree. The base revision already fixes `O`. | two-way |
| DD-06 | Entry point is the npm script `check:bump` | Document `node scripts/checkBumpInvariants.js` only | `npm run` works without `node_modules`, and it is the project's existing command style (`npm run lint`, `npm run test`) | two-way |
| DD-07 | A peer term not of the form `^M.m.0` is an I7 violation | Ignore unknown terms | Fail closed. The documented style has one literal term per minor (PRD D-17). | two-way |
| DD-08 | Exit codes 1 (violations), 2 (call or environment error) and 3 (internal error) are distinct | One non-zero code; 2 for every kind of error | `/bump-puppeteer` and a person can tell "fix the files", "fix the call" and "the checker is broken, stop and report" apart. The UX lens raised that a crash under exit code 2 would read as a mistake in the call. | two-way |
| DD-09 | The checker prints no `::error` annotations and no colour. No problem matcher is registered for now. | (a) the checker prints annotations; (b) the job registers a problem matcher (`::add-matcher::` with a regex for the violation line), which turns lines into PR annotations without changing the checker's output | (a) breaks REQ-CHK-I-001, which needs local output to equal CI output. (b) is compatible with REQ-CHK-I-001, as the UX lens pointed out. It is left out only to keep item #1 inside its appetite: it adds a matcher file and needs CI-observed testing. It is a cheap later addition and needs no redesign. | two-way |
| DD-10 | CI job runs setup-node `lts/jod` and no `npm ci` | Reuse the `build` job; install dependencies | REQ-CIJ-I-001 (no matrix name), REQ-CIJ-B-002 (independent), REQ-CHK-Q-001 (time). It also lets the check run on a tree where `npm ci` fails. | two-way |
| DD-11 | `ci-ok` join: the sibling owns the `needs` entry. Whichever item lands second carries the one-line addition, but only if Q-03 is answered "include". | This design edits `ci-ok`; never join | The orchestrator said not to edit the sibling's scope. The job ID is the stable interface (§ 8.2). | two-way |
| DD-12 | Tests derive their fixtures from the live repository files plus one targeted edit per case | Frozen copies of the `185a1ad` files; synthetic minimal files | Live files keep the fixtures in the real shape, so a future reformat of `ci.yml` shows up in the tests rather than leaving them on a stale shape. If `main` itself breaks an invariant, the "baseline passes" test turns red together with the CI check, which is the right signal. | two-way |
| DD-13 | The tests run inside every `integration` cell too, with no exclusion | Exclude `scripts/` from the integration job's `npm run test` | It adds seconds per cell (an estimate, not measured) and needs no change to `jest.config.js`. Excluding it would be over-design. | two-way |
| DD-14 | Two mandatory tracker items plus two conditional ones (§ 14.4). Item #1 is the minimum state-mode slice, with a stated cut order. Bump mode moves to item #2 beside its only consumer. | One item; one item per component; bump mode in item #1 | The checker and its CI gate must land together, because the checker's first CI run is the clean-baseline proof. The full design exceeds the one-day appetite (an estimate), so item #1 is cut to what fits. Bump mode adds little over state mode, and its only consumer is `/bump-puppeteer`. This revision answers the product lens's blocking concern (§ 17). | two-way |

## 12b. Alternatives Considered and Drawbacks

**Alternatives rejected at the strategy level**

- **Make CI test the pinned files instead**: for example, have the `build` job assert `PUPPETEER_VERSION` equals the pin. That covers I3 only, and each binding would need its own ad-hoc step. A single checker covers all seven rules and is reused by `/bump-puppeteer`.
- **Generate the bump files from one source of truth** (for example, a script that writes all four files from one version). This changes the bump procedure itself, which the PRD excludes (§ 3). It would still need a checker for hand edits and Dependabot PRs.
- **Rely on the prior art `check-bump.sh`**: it compares against `origin/main` only, needs `ruby`, has no tests, and describes itself as "not independent". Its bump-mode rules are reused in B1–B4.

**Drawbacks of the chosen design**

- The YAML-subset extractor is code this project owns. It is roughly 60–100 lines (an estimate) that a library would provide. A future workflow that uses anchors or flow syntax on a read path turns the check red until the extractor is extended. That is visible, not silent.
- JavaScript diverges from the project's TypeScript-only source. Type safety relies on `// @ts-check` and JSDoc, which nothing type-checks in CI. `tsconfig.json` has no `allowJs`/`checkJs`, so `// @ts-check` only helps in the editor.
- Spawning tests are slower than in-process tests. The full plan in § 11.2 has about 104 cases (about 90 CLI and about 14 bump-mode). The minimum slice in § 14.4 has about 30. At roughly 50–100 ms per spawn, that is an estimate of about 2–10 s per test run. It is not measured.
- Red Dependabot puppeteer PRs stay red until Q-02 is answered (PRD R3).

## 13. Quality Requirements

### 13.1 Intake quality attributes against the design

| Attribute | Target | How the design meets it | Status |
|---|---|---|---|
| Runtime (REQ-CHK-Q-001) | ≤ 10 s, stretch ≤ 2 s; CI adds ≤ 1 min | Parsing the three inputs took 0.11 s locally. The job has no install step. Checkout plus setup-node usually take seconds, but that job time is not measured. | Addressed; job duration to be measured after merge (PRD § 4 METER) |
| Detection coverage (REQ-CHK-Q-002) | 7/7 (6/6 without I7) | One negative test per invariant (§ 11.2) | Addressed |
| Determinism | Same output locally and in CI | No network, no colour, no annotations | Addressed |
| Growth | Stays within target past 100 matrix entries and new majors | Linear scan of under 300 lines and one JSON parse | Addressed |

### 13.2 Quality pillars

| Pillar or concern | Finding | Addressed / Gap |
|---|---|---|
| Security | § 11.1 | Addressed |
| Performance | § 13.1 | Addressed |
| Reliability | Fail closed (§ 5.2, § 11.4). No network. A false red is bounded by the PRD § 4 decision gate. No single point of failure beyond GitHub Actions itself. | Addressed |
| Cost | One extra ubuntu job per CI run. The repository is public, so standard runners are free. The test cases add seconds to each of 120 test runs (2 build plus 118 integration), not measured. | Addressed |
| Observability | § 11.3 | Addressed |
| Testing strategy | § 11.2 | Addressed |
| Accessibility | N/A, no visual interface | Addressed (N/A) |
| Error handling | § 11.4 | Addressed |

No critical gap (security or reliability) is open.

## 14. Risks and Open Questions

### 14.1 Feasibility summary

| Component | Verdict | Basis |
|---|---|---|
| C1 checker (state mode) | FEASIBLE | Prior art `check-bump.sh` evaluates the same facts. A probe ran a `scripts/*.js` file under Node and lint. The workflows are plain block YAML (read at `185a1ad`). |
| C1.1 YAML-subset extractor | FEASIBLE | Only four paths, all in plain block style, are read (§ 5.2). Fail-closed rules cover the rest. |
| C1.3 bump mode | FEASIBLE | `git show` and `git diff --name-only` are local. The prior art uses the same calls. |
| C2 npm script | FEASIBLE | `npm run` needs no `node_modules` |
| C3 tests | FEASIBLE | The probe settled the file type (DD-03). Child-process spawning with `process.execPath` is standard Node. |
| C4 CI job | FEASIBLE | Same actions and runner as the existing jobs |
| C5 procedure wiring | FEASIBLE | Document edits. The command file is a Claude Code config artifact, so the implementer edits it through its authoring process. |
| C6 release check | FEASIBLE | One step. Gated on Q-05. |
| C7 Dependabot ignore | FEASIBLE technically; known side effect | Settled at scope time (2026-11-14, #347): GitHub's Dependabot options reference marks `ignore` as also changing security-update PRs, and this repository has security updates on, so option (a) also stops security-update PRs for these two packages. Not a Must. |

Every Must-Have component is FEASIBLE. No spike is needed.

### 14.2 Risk register

Score = likelihood × impact, each rated 1–3. 7–9 HIGH, 4–6 MEDIUM, 1–3 LOW.

| ID | Risk | L | I | Score | Mitigation |
|---|---|---|---|---|---|
| DR-1 | The YAML extractor misreads a path and gives a false green, for example by reading a commented-out matrix entry or an entry from the wrong job | 1 | 3 | 3 LOW | Paths are resolved by job, not by grep. Comment stripping. One negative test per invariant on the real files. Fail closed on unknown shapes. |
| DR-2 | The extractor gives a false red after a harmless workflow reformat (for example, indentation or quote style) | 2 | 2 | 4 MEDIUM | Indentation is measured, not hard-coded. Both quote styles are accepted. Fixtures follow the live files (DD-12). PRD § 4 gate: any false red, fix before the next bump. |
| DR-3 | A CRLF checkout on `windows-2022` breaks the tests in `build` | 2 | 2 | 4 MEDIUM | Split on `/\r?\n/`. An explicit CRLF test case (§ 11.2). |
| DR-4 | A merge conflict with the sibling's `ci.yml` edit (`ci-ok`) | 2 | 1 | 2 LOW | Add the new job as a separate block. Sequence the two items with a tracker relation (DD-11). |
| DR-5 | The agent running `/bump-puppeteer` edits the checker to get a pass | 1 | 2 | 2 LOW | The procedure says never to do so. CI runs the committed checker independently, and the diff shows any edit (PRD R4). |
| DR-6 | Red Dependabot puppeteer PRs read as noise | 3 | 1 | 3 LOW | Violation lines say exactly what disagrees. Q-02 can stop the PRs at the source. |
| DR-7 | A change of peer-range style makes I2 and I7 fail on a valid tree | 1 | 2 | 2 LOW | The rule cites its document section. Changing the rule and the checker in one commit is required (REQ-BMP-C-001). |
| DR-8 | In bump mode, `origin/main` is stale because it was not fetched, so B1 reports files from other commits | 2 | 1 | 2 LOW | Step 2.1 already runs `git pull origin main`. The violation names each extra file. |
| DR-9 | The check is advisory only if Q-03 resolves to "exclude" or the sibling never lands, so a violating PR can still merge on admin bypass | 2 | 2 | 4 MEDIUM | Documented acceptance. Worst case: a violating bump merges with a red check. Blast radius: one release with a wrong peer range. The fallback exists **only if Q-05 is answered yes**: then C6 blocks the release. Without C6, the PRD § 4 rule that a red `main` blocks releases is enforced by nothing, and the maintainer must follow it by hand. |

No HIGH risk. No rabbit hole was found: the hardest part, the YAML extractor, still fails safe if it takes ten times longer, because the first slice can fail closed on anything beyond the four paths.

### 14.3 Open questions

| ID | Question | Load-bearing? | Context and impact of deferring |
|---|---|---|---|
| Q-01 | Check "latest patch per minor"? (PRD) | No | Excluded from the Must set. Recommended home is bump mode with the registry. Deferring keeps the rule prose-only. |
| Q-02 | Add the Dependabot `ignore` entry? (PRD) | Yes. It decides whether C7 is built (scope boundary). | The default is "no change". Deferring leaves two red PRs per puppeteer release. Settled at scope time (2026-11-14, #347): GitHub's Dependabot options reference marks `ignore` as also changing security-update PRs, and this repository has security updates on, so option (a) also stops security-update PRs for these two packages. |
| Q-03 | Is `bump-invariants` in `ci-ok`? (PRD; sibling-owned) | Yes. It decides whether the check blocks merges. | The checker works either way. Deferring leaves it advisory (DR-9). |
| Q-04 | Development dependency or built-ins? (PRD) | Answered at design: built-ins (DD-02), ratification-pending | — |
| Q-05 | Run the checker in `publish.yml` `validate`? (PRD) | Yes. It decides whether C6 is built (scope boundary). | Recommended yes, because it is cheap and it is the fallback for DR-9 |
| Q-06 (new) | Is REQ-INV-C-007 (I7) ratified? | Yes. It changes the Must or Should set and the detection-coverage goal (7/7 or 6/6). | Designed in. Removing it means deleting one table row and one test. |
| Q-07 (new) | Does the Windows runner check out CRLF (`core.autocrlf`)? | No. The design tolerates both, and the tests force both. | Settled by the first `build` run on `windows-2022` |
| Q-T1 (testing track) | Is a prerelease pin such as `26.0.0-rc.1` an I1 violation? | No. The default is yes: three-integer form only. | Matters only if the procedure ever pins a prerelease |
| Q-T2 (testing and product lenses) | Should the checker enforce the local part of "never skip an intermediate minor" (`.claude/commands/bump-puppeteer.md` § Rules, a MUST there)? That part is: minors consecutive within each major in the matrix and peer range, and a new major starting at `.0`. In bump mode it also means `P > O`. Only "exhaust the current major first" needs the registry. | No for this design. It would be a new rule with no PRD requirement, so it is not designed in. | Without it, a skipped minor (24.39 → 24.41) passes every check. If the owner ratifies it, it becomes a new requirement: one state-mode invariant (I8) plus a bump-mode rule. |
| Q-08 (product lens) | Is REQ-CHK-B-006 (bump mode) ratified? It is a Should, inferred by the requirements run. | Yes. It decides whether B1–B4 are built in item #2. | Item #2 wires state mode only, and B1–B4 stay unbuilt |

### 14.4 Recommended tracker split (for Stage 3)

| # | Title | Scope | Depends on |
|---|---|---|---|
| 1 | Bump-invariant checker and its CI gate (state mode) | **The minimum slice, sized for about one day**: C1 in state mode only (C1.1 readers, C1.2 I1–I6, plus I7 if Q-06 ratifies it, C1.4 reporter); C2; C3 with one negative test per invariant (exact ID-set oracle), the baseline-pass test, the fail-closed tests (CAP-09), the no-false-red cases (CAP-10) and the CRLF cases (CAP-15); C4. Acceptance: `bump-invariants` is green on the PR's own CI; `npm pack --dry-run` lists no `scripts/` file; a one-off historical replay of `7966135` and `8d32d9c` reports the expected violations (§ 11.2, judged on observed values; I5 `absent` at those commits is noise from the single-job era); quality gates G1, G2 and G4. In this item, `--base` is not yet supported: it exits 2 as an unknown argument. | Precondition: owner ratification of the PRD's Must set (PRD readiness check 6). Relation: sibling `gap-phantom-required-checks`, for ordering of `ci.yml` edits and the `ci-ok` join (DD-11). |
| 2 | Wire the checker into `/bump-puppeteer`, with bump mode | C5, as listed in § 5.1: the new step with its exit-code branches and stop-and-report rule; `bump-invariants` in the Step 2.4 test plan and the Step 2.5 HARD GATE; a Rules line; `CLAUDE.md` names the command and adds the Dependabot-supersede sentence; § Build Commands lists the command. If Q-08 ratifies REQ-CHK-B-006: C1.3 bump mode (B1–B4) with its git-repo tests (CAP-17…21), shipped beside its only consumer. If Q-08 rejects it, the step runs state mode. | #1 |
| 3 (conditional, Q-05) | Run the bump-invariant checker at release time | C6: one step in `publish.yml` `validate` before `npm ci` | #1; blocked on Q-05 |
| 4 (conditional, Q-02) | Stop separate Dependabot `puppeteer` / `puppeteer-core` PRs | C7 | Blocked on Q-02. Verify the security-update effect in GitHub's dated Dependabot documentation first. |
| 5 (follow-up, Should) | Extend the checker's tests to the full § 11.2 plan | The roughly 60 state-mode cases that item #1 does not keep: the remaining BUT-NOT rows of CAP-01…07, CAP-11 (report all, including the Dependabot-shaped set), CAP-12 (line format), CAP-13 (exit codes), CAP-14 (reference value), CAP-16 (offline and read-only), CAP-22 (scale). Also anything item #1 cut under the cut order. | #1 |

**The Must set spans items #1 and #2.** REQ-BMP-B-001 (Must) is delivered by item #2. PRD D-02 sized one day for the whole feature, and item #1 alone uses it. So the Must set runs past the stated appetite unless the owner raises it. Until item #2 lands, a bump has no pre-commit check. CI state mode still catches every violation, so that interval is acceptable. Item #5 holds the test cases item #1 does not keep, so that none are dropped silently. The PRD § 4 false-red goal of 0 is served first by the CAP-10 cases, which item #1 keeps.

**Cut order** if item #1 runs past its appetite, first cut first:
1. The scale case (CAP-22).
2. The throwaway-PR probes P1 and P2. The PR's own negative tests and the green check on the merge commit (G4) stand in for them.
3. The seven manual mutants. The exact ID-set oracle partly stands in for them.
4. I7, which is decided by Q-06 in any case.

Never cut: I1–I6 detection, fail closed, the CI job, or the historical replay. Gate G3 shrinks with each cut, and the PR body names what was cut. The alternative to cutting is for the owner to raise the appetite (PRD D-02).

**Why bump mode moved to item #2.** State mode already catches most of what bump mode adds:
- B4 is implied by I3 and I5 whenever `O ≠ P`.
- I4 and I7 catch most B3 cases.
- I2 and I7 catch most B2 cases.

What bump mode adds on its own is B1's check for extra changed files, and catching a minor dropped from both the peer range and the matrix. Its only consumer is `/bump-puppeteer`. So it ships with item #2, where that consumer is wired.

The `ci-ok` join is not an item of this scope. It is a relation on the sibling's item (DD-11). Items #1 and #2 are kept apart because #2 edits a Claude Code command file and owner documents, which have their own authoring process and review.

## 15. Glossary

### 15.1 Entity glossary

The canonical names come from the PRD object model (§ 9). The aliases are what each track calls the same thing.

| Canonical name | Definition | Technical / CI alias | Testing alias | Security alias |
|---|---|---|---|---|
| Pin | `package.json` `devDependencies.puppeteer`, the reference value `P` | `P`, "pin" | baseline pin | — |
| VersionBinding | A file and key that must echo the pin (seven bindings) | read path (§ 5.2), binding | mutation target | — |
| PeerRange | `peerDependencies.puppeteer-core` | peer range, peer terms | — | published claim |
| IntegrationMatrix | `ci.yml` `jobs.integration.strategy.matrix.puppeteer-version` | matrix | — | — |
| Invariant | Rule `I1`–`I7` | invariant table entry (C1.2). Bump-mode rules `B1`–`B4` are design-introduced siblings (C1.3). | capability (CAP) target | — |
| CheckRun | One execution of the checker on one tree | run, invocation | spawn | — |
| Violation | One disagreement found by a CheckRun | violation line (§ 8.1) | asserted output line | — |
| CICheck | The CI job that runs the checker | job `bump-invariants` (C4) | CI-observed check | the job under least privilege |
| BumpProcedure | `/bump-puppeteer` plus `CLAUDE.md` § Puppeteer Version Bump Procedure | C5, procedure step | — | — |
| DependabotConfig | `.github/dependabot.yml` | C7 | — | — |
| checker *(design-introduced)* | The component that performs CheckRuns: `scripts/checkBumpInvariants.js` | C1 | system under test | code from the pull request |

### 15.2 Consistency report

| Track pair | Finding | Resolution |
|---|---|---|
| Technical vs API (CLI) | The PRD bump-mode wording takes `O` and a base revision; § 8.1 takes only `--base` | Earlier layer (Technical, DD-05) decides. `O` is derived. REQ-CHK-B-006 semantics are unchanged. |
| Technical vs Infrastructure | Every component has a place to run (§ 7) | Consistent |
| Technical vs Performance | No install step in the job, as the runtime target needs | Consistent |
| Security vs every track | Read-only token, no secrets, no PR-text interpolation (C4); the checker writes nothing (C1); nothing shipped (C2/C1 location) | Consistent |
| Testing vs Technical | The Testing track quoted five weak points in the Technical draft: fail-closed scope, B1 untracked files, B4 when `O == P`, path separators, cwd resolution | The Technical layer adjusted in each case (§ 5.2, § 5.4, § 8.1). The Testing track's additions Q-T1 and Q-T2 are open, not absorbed. |
| Testing vs PRD | REQ-CHK-Q-002 counts an invariant covered when its test checks for the invariant's ID; the track uses an exact ID-set oracle | The stricter oracle meets the PRD measure and goes beyond it. No conflict. |
| Missing entity | `Invariant` in the PRD has IDs `I1`–`I7` only. The design adds `B1`–`B4` bump-mode rules. | Not a new entity: they are rules of REQ-CHK-B-006 given labels so that violation lines can name them |

## 16. Requirement-to-Track Coverage Matrix

Capability IDs (`CAP-NN`) refer to the master test plan in § 11.2.

| Requirement | Tracks | Where addressed | Capability | Status |
|---|---|---|---|---|
| REQ-INV-C-001 | Technical | § 5.3 I1 | CAP-01 | covered |
| REQ-INV-C-002 | Technical | § 5.3 I2 | CAP-02 | covered |
| REQ-INV-C-003 | Technical | § 5.2 paths, § 5.3 I3 | CAP-03, CAP-10 | covered |
| REQ-INV-C-004 | Technical | § 5.2, § 5.3 I4 | CAP-04 | covered |
| REQ-INV-C-005 | Technical | § 5.2, § 5.3 I5 | CAP-05 | covered |
| REQ-INV-C-006 | Technical | § 5.2 JSON, § 5.3 I6 | CAP-06 | covered |
| REQ-INV-C-007 | Technical | § 5.3 I7, DD-07 | CAP-07 | covered (Should; ratification Q-06) |
| REQ-CHK-B-001 | Technical, API | § 5.1 C1.4, § 8.1 exit codes | CAP-08, CAP-09, CAP-13 | covered |
| REQ-CHK-B-002 | API | § 8.1 violation line | CAP-12 | covered |
| REQ-CHK-B-003 | Technical | § 5.2 rule 5, § 11.4 | CAP-09, CAP-10, CAP-21 | covered |
| REQ-CHK-B-004 | Technical | § 5.1 C1.4 | CAP-11 | covered |
| REQ-CHK-B-005 | Technical | § 5.3 (P) | CAP-14 | covered |
| REQ-CHK-B-006 | Technical | § 5.4 B1–B4, DD-05 | CAP-17…21 | covered, conditional on Q-08 (tracker item #2) |
| REQ-CHK-C-001 | Technical, Security | § 4 point 1, § 8.1 side effects | CAP-16 | covered |
| REQ-CHK-C-002 | Technical, Security | § 2, § 5.1 location | CAP-23 | covered |
| REQ-CHK-I-001 | API, Infrastructure | § 5.1 C2, § 8.1, DD-06, DD-09 | CAP-15, CAP-24, CAP-26 | covered |
| REQ-CHK-Q-001 | Performance | § 13.1 | CAP-22, CAP-27 | covered |
| REQ-CHK-Q-002 | Testing | § 11.2 | CAP-01…08 | covered |
| REQ-CIJ-B-001 | Infrastructure | § 6b, § 7 | CAP-11, CAP-24 | covered |
| REQ-CIJ-B-002 | Infrastructure | § 7 (no `needs`), DD-10 | CAP-24 (probe P2) | covered |
| REQ-CIJ-B-003 | Infrastructure | § 5.1 C6, § 6b | CAP-28 | covered, conditional on Q-05 |
| REQ-CIJ-C-001 | Security | § 11.1, § 7 | CAP-25 | covered |
| REQ-CIJ-I-001 | API, Infrastructure | § 8.2 | CAP-24 | covered |
| REQ-BMP-B-001 | Technical | § 5.1 C5, § 6b | CAP-26 | covered |
| REQ-BMP-C-001 | Technical | § 5.1 C5, § 5.3 source column | CAP-26 | covered |
| REQ-DEP-C-001 | Infrastructure | § 5.1 C7 | none (non-testable until built) | **deferred**: typed exit "defer to a future iteration", tracked by PRD § 3 deferral row, open question Q-02 and conditional tracker item #4 (§ 14.4). Ratification-pending. |

UNCOVERED entries: none. One entry is deferred with tracking.

## 16b. Element-to-Requirement Backward-Coverage Matrix

There was no UX track, so no wireframe handoff package exists. The tracked elements are therefore the PRD entities and CTAs (PRD § 9) and the design's own components and design-introduced elements. Each one is traced to a requirement the PRD carries.

| Element | Type | Traces to | Provenance source | Status |
|---|---|---|---|---|
| Pin, VersionBinding, PeerRange, IntegrationMatrix, Invariant | entity | REQ-INV-C-001…007 | PRD § 9 object model | traced |
| CheckRun, Violation | entity | REQ-CHK-B-001, REQ-CHK-B-002 | PRD § 9 | traced |
| CICheck | entity | REQ-CIJ-B-001, REQ-CIJ-I-001 | PRD § 9 | traced |
| BumpProcedure | entity | REQ-BMP-B-001 | PRD § 9 | traced |
| DependabotConfig | entity | REQ-DEP-C-001 | PRD § 9 | traced (deferred, Q-02) |
| CheckRun.Run, CheckRun.Read report, Violation.Fix | CTA | REQ-CHK-B-001, REQ-CHK-B-002 | PRD § 9 CTA inventory | traced |
| CICheck.Run on PR / push | CTA | REQ-CIJ-B-001 | PRD § 9 | traced |
| CICheck.Aggregate | CTA | REQ-CIJ-I-001 | PRD § 9 (sibling-owned) | traced |
| BumpProcedure.Verify before commit | CTA | REQ-BMP-B-001 | PRD § 9 | traced |
| Invariant.Update definition | CTA | REQ-BMP-C-001 | PRD § 9 | traced |
| DependabotConfig.Ignore puppeteer pair | CTA | REQ-DEP-C-001 | PRD § 9 | traced (deferred) |
| C1 checker, C1.1 readers, C1.2 table, C1.4 reporter | component | REQ-CHK-B-001…005, REQ-CHK-C-001, REQ-INV-* | § 5.1 | traced |
| C1.3 bump-mode B1–B4 | component | REQ-CHK-B-006 | § 5.4 | traced |
| C2 npm script `check:bump` | component | REQ-CHK-I-001 | § 5.1 | traced |
| C3 test suite | component | REQ-CHK-Q-002 | § 5.1 | traced |
| C4 CI job `bump-invariants` | component | REQ-CIJ-B-001, REQ-CIJ-B-002, REQ-CIJ-C-001, REQ-CIJ-I-001 | § 7 | traced |
| C5 procedure wiring | component | REQ-BMP-B-001, REQ-BMP-C-001 | § 5.1 | traced |
| C6 release step | component | REQ-CIJ-B-003 | § 5.1 | traced (conditional, Q-05) |
| C7 Dependabot ignore | component | REQ-DEP-C-001 | § 5.1 | traced (conditional, Q-02) |
| Exit codes 2 (call or environment) and 3 (internal) | design element | REQ-CHK-B-001 (a non-zero exit never reads as a pass) | DD-08 | traced |
| Violation lines in rule-ID order; summary semantics `<e>/<s>` | design element | REQ-CHK-B-002, REQ-CHK-B-004 | § 8.1 | traced |
| Procedure stop-and-report branch; `bump-invariants` in the Step 2.5 merge gate | design element | REQ-BMP-B-001 (commit only after exit 0; never edit the checker) | § 6b, C5 | traced |
| "Close a Dependabot puppeteer PR as superseded" sentence | design element | PRD § 5 scenario 3; REQ-CIJ-B-001 (its GIVEN is the Dependabot PR) | § 6b, C5 | traced. The PRD § 9 CTA inventory has no row for it; adding a "supersede Dependabot PR" CTA is a PRD edit left to the owner. |
| `persist-credentials: false` | design element | REQ-CIJ-C-001 (least privilege) | § 11.1 | traced |
| CRLF-tolerant reads | design element | REQ-CHK-B-003, REQ-CHK-I-001 (same result on every platform) | § 5.2 | traced |
| Unknown peer term reported under I7 | design element | REQ-CHK-B-003, REQ-INV-C-007 | DD-07 | traced |
| `O` derived from `--base` | design element | REQ-CHK-B-006 | DD-05 | traced |

PHANTOM entries: none.

## 17. Ratification and lock

**State: both lenses confirm the design shape, with non-blocking notes that have been applied. The design is still NOT LOCKED:** load-bearing questions remain open, and the brief is uncommitted (§ 17.4).

### 17.1 Lens verdicts

| Lens | Dispatched to | Verdict | Disposition |
|---|---|---|---|
| Product (first pass) | `product-strategist` agent | BLOCKING-CONCERN, plus three non-blocking notes | See § 17.2 |
| UX | `ux-architect` agent | CONFIRM-WITH-NON-BLOCKING-NOTES. Not N/A: the lens judged that the CLI output, the fix loop and the check name are surfaces a reader acts on. | All five notes applied (§ 17.2) |
| Product (re-ratification of the revision) | `product-strategist` agent, fresh context | CONFIRM-WITH-NON-BLOCKING-NOTES. The blocking concern and concerns 2 and 4 are resolved. Concern 3 is resolved only together with the item #1 precondition. Five new non-blocking notes, N1–N5. | All applied (§ 17.2) |

Neither verdict is owner ratification. This author did not supply either verdict.

### 17.2 Concerns and how the design answered them

| Lens | Concern | Blocking | Change made |
|---|---|---|---|
| Product | Fit to the appetite was asserted but not shown. The case counts disagreed (§ 11.2 against § 12b). There was no minimum slice. Bump mode sat in item #1, away from its only consumer. | yes | § 2 appetite row; § 12b counts corrected; § 14.4 minimum slice for item #1 and a cut order; bump mode moved to item #2 and gated on Q-08; DD-14 |
| Product | No ratification question for bump mode. The reason given for excluding "never skip an intermediate minor" was wrong for its local part. | no | Q-08 added; § 1b and Q-T2 rewritten |
| Product | A lock could be read as "requirements ratified" | no | § 17.3 |
| Product | DR-9 overstated the release-time fallback | no | DR-9 now says the fallback exists only if Q-05 is answered yes |
| UX | The procedure has dead ends on exit 2, on a crash, and on a red check that persists | no | § 6b steps 4–5; exit 3 for internal errors (DD-08, § 11.4); C5 scope |
| UX | The red Dependabot PR flow has no last step | no | § 6b: close the PR as superseded. C5 adds the sentence to `CLAUDE.md`. |
| UX | The merge gate does not name the new check | no | § 6b step 7; C5 adds `bump-invariants` to Steps 2.4 and 2.5 |
| UX | The output contract leaves line order, summary count, output on exit 2 and pin placement unsaid | no | § 8.1 rows for line order, summary and exit codes. Trailing npm output was measured: none after a failing script. |
| UX | The annotation rejection's reason does not cover a problem matcher | no | DD-09 and § 1b now name the problem matcher and defer it |

| Product (re-check) | Concern 3 must travel with the work: § 17 alone is not read by Stage 3 | no | § 14.4 item #1 now has the precondition "owner ratification of the PRD's Must set" |
| Product (re-check) N1 | The Must set spans items #1 and #2 and exceeds the one-day appetite | no | § 14.4 now states this, including the interval with no pre-commit check |
| Product (re-check) N2 | About 60 planned test cases had no home | no | § 14.4 follow-up item #5 |
| Product (re-check) N3 | Bump mode was still treated as unconditional in places | no | § 5.1 C1 row; § 6b step 2; § 8.1 Command (`--base` exits 2 until item #2); § 16 REQ-CHK-B-006 |
| Product (re-check) N4 | Summary wording differed between the example and the contract | no | § 8.1 example now reads "rules evaluated" |
| Product (re-check) N5 | § 14.4 had a duplicated table header | no | Removed |

One note was outside the goal: `bump-puppeteer.md` § Resume has no state for "interrupted before the commit". That gap predates this design. It is reported, not designed here.

The UX lens agent ran `npm run build`, which created a gitignored `lib/` in the worktree. Its creation time matched the build, one minute before removal, so it did not exist beforehand. It was removed.

### 17.3 What a lock would and would not mean

A lock would freeze the **design shape** only. It would not ratify the requirements. These all remain ratification-pending by the owner:
- PRD decisions D-01…D-17;
- this design's decisions DD-00…DD-14 and T-1…T-15;
- the load-bearing questions Q-02, Q-03, Q-05, Q-06 and Q-08.

Item #1 should not start before the owner has ratified the PRD's Must set.

### 17.4 Status

The brief stays `draft`, for three reasons:
1. Load-bearing questions are open (§ 14.3).
2. This run did not commit the brief, so it cannot be a durable lock.

Both lenses have confirmed the design shape. The notes from the product re-check (N1–N5) were applied after that verdict and were not checked again. They are consistency edits and one added follow-up item, and they change no decision.

The commit obligation goes to the orchestrator: commit the design document and the brief together.
