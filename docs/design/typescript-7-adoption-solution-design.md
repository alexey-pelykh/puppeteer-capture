# Solution Design: TypeScript 7 Toolchain Adoption

**Status**: draft — provisional; see § 14 for the load-bearing question that keeps it unlocked
**Created**: 2026-11-14
**Requirements**: [`docs/requirements/typescript-7-toolchain-prd.md`](../requirements/typescript-7-toolchain-prd.md) (`dor_status: failed` on requirement provenance only)
**Baseline**: `main` at `185a1ad`
**Tracks run**: Technical Architecture, Testing Architecture. No signal for Data, UX/IA, API, Security, Performance, Infrastructure, Integration or UI tracks: the subject is a library's development toolchain.

## 1. Goals and Drivers

- Correct the triage records that say PR #266 becomes mergeable once `ts-jest` widens its peer range (REQ-REC-001..003).
- Build the published `lib/` with TypeScript 7 while `ts-jest` and `ts-standard` keep running (REQ-TC-001..005).
- Keep TypeScript updates flowing without re-creating an un-mergeable #266 (REQ-DEP-001, REQ-DEP-002), and make the two-package arrangement legible to maintainers (REQ-DOC-001).
- Success: the PRD's § 4 indicators L1–L3, G1–G2 and its two decision gates.

## 1b. Non-Goals

- Replacing `ts-standard` / `eslint@8` with a maintained lint stack (PRD § 3 deferral; reopen trigger recorded there).
- Switching the Jest transform to `@swc/jest` or `babel-jest` (PRD § 3 deferral).
- Using TypeScript 7's `./unstable/*` API, or changing `tsconfig` targets or published output.

## 2. Constraints

- No `--legacy-peer-deps` / `--force` (REQ-TC-003): `npm ci` must resolve cleanly.
- CI runs on `ubuntu-24.04` and `windows-2022`, Node `lts/jod`; the build runs inside `npm ci` through the `prepare` script, in CI, in every integration cell, and in `publish.yml`.
- Project conventions: commit types `(imp)` / `(docs)`; no issue numbers in commit messages; rebase-only merges.
- Appetite: small batch, at most one working day (PRD § 3, ratification-pending).

## 3. Context and Scope

The system boundary is `package.json`, its lockfile, the npm scripts, `.github/workflows/ci.yml`, `.github/dependabot.yml`, and the documentation surfaces `CLAUDE.md`, `CONTRIBUTING.md` and `.claude/memory/`. External systems: the npm registry (`typescript`, `@typescript/typescript6`), Dependabot, GitHub Actions. Nothing in `src/` changes.

Verified facts the design rests on (2026-11-14):

| Fact | Command | Output |
|---|---|---|
| TS 7's `typescript` exposes no compiler API | `npm view typescript@7.0.2 exports --json` | `".": "./lib/version.cjs"` and `"./package.json"`, the rest under `./unstable/*` |
| `lib/version.cjs` contents | read from `npm pack typescript@7.0.2` | exports `version`, `versionMajorMinor` only |
| No `typescript-eslint` supports TS 7 | `npm view typescript-eslint version peerDependencies` | `8.72.2`, peer `typescript: ">=4.8.4 <6.1.0"` |
| TS 6 API is published separately | `npm view @typescript/typescript6` | `6.0.2`, bin `tsc6`, main `./lib/typescript.js` re-exporting `@typescript/old` = `npm:typescript@^6` |
| TS 7 binary | `npm view typescript@7.0.2 bin` | `{"tsc": "bin/tsc"}`; `tsc -v` prints `Version 7.0.2` |

## 4. Solution Strategy

**Decision D1 — alias the API, alias the compiler.** In `devDependencies`, `typescript` becomes `npm:@typescript/typescript6@6.0.2`, so every tool that does `require('typescript')` (`ts-jest`, `typescript-eslint` via `ts-standard`, `tsutils`, `eslint-config-standard-with-typescript`) gets the TypeScript 6 compiler API. TypeScript 7 is added as a second devDependency, `typescript7: npm:typescript@7.0.2`, and is the only compiler that builds `lib/`. Spike result: `npm install` with no ERESOLVE, `ts-jest` suites pass (4/4, 18/18), `ts-standard` exits 0, TS 7 build exits 0, and TS 6 vs TS 7 emit differs in 0 of 24 files.

**Decision D2 — never call a bare `tsc`.** In the spike, `node_modules/.bin/tsc` linked to `@typescript/old/bin/tsc` (TS 6.0.3, a transitive dependency of `@typescript/typescript6`), not to TS 7. A single guard entry point resolves the TS 7 binary from the `typescript7` package's own `package.json` `bin` field, runs it with `--version`, refuses anything whose major is not 7 (printing the version found), then runs it with the build arguments. `build` and a new `typecheck` script both go through it.

**Decision D3 — prove the guard can fail.** The guard accepts an override for the compiler path (an environment variable) so CI can point it at the transitive TS 6 compiler and require a non-zero exit. A guard that has never been seen to fail is not evidence.

**Decision D4 — Dependabot.** Add an `ignore` rule so Dependabot does not propose `typescript` major 7+ for the aliased `typescript` entry (which would re-create #266). Whether Dependabot updates npm-aliased dependencies at all (assumption A3, red) is settled by a follow-up item; its fallback is a documented manual bump procedure in `CLAUDE.md`, modelled on the existing Puppeteer Version Bump Procedure.

## 5. Building Blocks

| Component | Kind | Role | Requirements |
|---|---|---|---|
| `typescript` devDependency → `npm:@typescript/typescript6@6.0.2` | dependency alias | TypeScript 6 compiler API for tools (`CompilerApiProvider`) | REQ-TC-003 |
| `typescript7` devDependency → `npm:typescript@7.0.2` | dependency alias | the build compiler (`BuildCompiler`) | REQ-TC-001 |
| TS 7 guard script (new file; path e.g. `scripts/tsc7.mjs`) | Node script | resolve TS 7 bin, assert major 7, run it | REQ-TC-001, REQ-TC-002 |
| `build` npm script | script | `rimraf ./lib` then the guard with `--project ./tsconfig.build.json` | REQ-TC-001 |
| `typecheck` npm script (new) | script | the guard with `--noEmit --project ./tsconfig.json` (covers tests) | REQ-TC-005 |
| `ci.yml` build job: "Type-check (TypeScript 7)" step | CI step | runs `npm run typecheck` on both OS cells | REQ-TC-005 |
| `ci.yml` build job: guard negative-path step | CI step | runs `npm run build` with the guard pointed at the TS 6 compiler; passes only if it exits non-zero naming the version | REQ-TC-002 |
| `.github/dependabot.yml` ignore rule | config | no `typescript` major ≥7 proposals for the alias | REQ-DEP-001 |
| Documentation: `CLAUDE.md`, `CONTRIBUTING.md` | prose | two-package rationale, "never bare `tsc`", `typecheck` command, retirement trigger | REQ-DOC-001 |
| Triage records: `.claude/memory/dependabot-triage-stale-base.md`, `.claude/memory/MEMORY.md`, PR #266 comment | prose | corrected diagnosis | REQ-REC-001..003 |

Entity model (from the PRD § 9 object model): `TriageRecord`, `BuildCompiler`, `CompilerApiProvider`, `DependencyUpdate`. No persistent data.

## 6. Runtime View

### 6b. System interactions

1. `npm ci` installs both aliases → `prepare` → `npm run build` → `rimraf ./lib` → guard resolves `node_modules/typescript7/package.json` `bin.tsc` → spawns `node <bin> --version` → asserts major 7 → spawns `node <bin> --project ./tsconfig.build.json` → `lib/`.
2. `npm test` → Jest → `ts-jest` → `require('typescript')` → `@typescript/typescript6` → `@typescript/old` (TS 6 API).
3. `npm run lint` → `ts-standard` → `typescript-eslint@5` → `require('typescript')` → TS 6 API.
4. CI build job: `npm ci` (1), lint (3), "Type-check (TypeScript 7)", test (2), then the guard negative-path step and the compiler-identity stub step last, because `npm run build` deletes `lib/` before it calls the guard.
5. `publish.yml`: its `npm ci` and `npm publish` both trigger `prepare`, so the published `lib/` is TS 7-built with no workflow edit.

## 11. Crosscutting Concepts

- **Security**: one new devDependency publisher identity (`@typescript/typescript6`, same npm maintainers as `typescript`). Nothing ships to consumers; runtime dependencies are unchanged.
- **Observability**: the guard prints the compiler version on every build (success criterion L2).
- **Error handling**: a wrong compiler fails the build with the version found; because `prepare` runs the build, this surfaces as an `npm ci` failure — the guard's message must name the guard so it is not mistaken for an install problem.
- **Accessibility**: N/A — no user interface.

### 11.1 Master test plan (Testing Architecture track)

Gherkin `.feature` scenarios are not authored as a test layer: every requirement is decided by an exit code, a log line or a grep, so a scenario layer adds no falsifiability for a toolchain change. (Stage 3.5 of the scoping run later wrote `docs/requirements/typescript-7-toolchain.feature.md` as a Tier B planning stub for #335. It restates the acceptance criteria in scenario form; it is not bound to step definitions and does not change this decision.)

| Cap | Capability | Requirements | Test type | Work class |
|---|---|---|---|---|
| CAP-1 | Build compiles with TS 7 and logs its version | REQ-TC-001 | CI-step assertion (guard exit 0 + log line) | deterministic-output |
| CAP-2 | Build refuses a non-7 compiler and names the version | REQ-TC-002 | CI-step assertion (negative-path step) | deterministic-output |
| CAP-3 | `npm ci`, lint and tests pass on the TS 6 API, with no `--legacy-peer-deps` / `--force` | REQ-TC-003 | CI job green + grep over workflows and `package.json` | deterministic-output |
| CAP-4 | `lib/` output matches TS 6 output | REQ-TC-004 | one-time `diff -rq` recorded in the PR | deterministic-output (one-time) |
| CAP-5 | Sources and tests type-check under TS 7 | REQ-TC-005 | CI-step assertion | deterministic-output |
| CAP-6 | Both TypeScript packages keep receiving mergeable updates | REQ-DEP-001 | manual-read of the next Dependabot run / documented fallback | prose/config |
| CAP-7 | #266 closed as superseded | REQ-DEP-002 | manual-read of PR state | prose/config |
| CAP-8 | Docs state the two-package rationale and retirement trigger; documented commands unchanged | REQ-DOC-001 | grep + manual-read | prose/config |
| CAP-9 | Records no longer say #266 merges once the peer range widens; the compiler-API fact is present; other guidance kept | REQ-REC-001 | grep (absence and presence) + `git diff` scope + manual-read | prose/config |
| CAP-10 | The note names a check that reports "unsupported" for 7.0.2 today | REQ-REC-002 | manual-read, and the named check is executed against 7.0.2 | prose/config |
| CAP-11 | #266 carries a superseding comment; earlier comments intact | REQ-REC-003 | manual-read | prose/config |

**Quality gates** — CI fails on: the guard (CAP-1); the negative-path step not failing as expected (CAP-2); the TS 7 type-check (CAP-5); `npm ci` ERESOLVE; lint; test. Cross-platform risk (assumption A2) is gated by the Windows build cell and the integration matrix. Gate bypass authority: the maintainer. Note: which checks are *required* on `main` is the subject of sibling gap gap-phantom-required-checks.

## 12. Architecture Decisions

| ID | Decision | Status |
|---|---|---|
| D1 | `typescript` → `@typescript/typescript6` alias; TS 7 as `typescript7` alias | ratification-pending (owner) — depends on A5, "adopt TypeScript 7 now" |
| D2 | Single guard entry point resolving the TS 7 bin from its `package.json`; no bare `tsc` | decided (author default: Node script, not shell, for Windows parity) |
| D3 | Guard overridable compiler path + CI negative-path step | decided (author default) |
| D4 | Dependabot ignore for `typescript` ≥7 on the alias; alias update handling settled by follow-up | decided for the ignore; follow-up open on A3 |
| D5 | Type-check step in the build job on both OS cells | decided (author default; testing track proposed Ubuntu-only, Windows kept because A2 is the platform risk) |
| D6 | Emit parity is a one-time recorded comparison, not a standing CI job | decided (a standing job would keep TS 6 in the build path and work against retirement) |
| D7 | Exact pins for both TypeScript aliases | decided (author default; matches the repo's exact Puppeteer pins) |

**Author-chosen defaults to ratify**: the alias name `typescript7`; the guard's file location (the repository has no `scripts/` directory yet — a new convention); the override environment variable name; exact pins; type-check on both OS cells; Dependabot ignore wording.

## 12b. Alternatives Considered and Drawbacks

| Alternative | Why rejected |
|---|---|
| Wait for `ts-jest` to widen its peer range | The peer range is not the blocker; the TS 7 package has no compiler API for any tool to use. |
| Root `typescript@7.0.2` + npm `overrides` giving tools the TS 6 package | Spike: `npm install` → ERESOLVE (overrides do not satisfy peer dependencies this way). |
| `--legacy-peer-deps` on #266 as-is | `ts-jest` and `ts-standard` then crash at runtime (verified); violates REQ-TC-003. |
| Switch Jest to `@swc/jest` / `babel-jest` | Lint still needs the TS 6 API (`typescript-eslint` has no TS 7 support), so the alias is needed anyway; tests would lose type-checking. Deferred, not rejected forever. |
| Replace `ts-standard` with `eslint@9` + `typescript-eslint@8` | `typescript-eslint@8.72.2` also peers `typescript <6.1.0`; changes the declared lint convention. Deferred. |
| Stay on TypeScript 6 and close #266 with an ignore rule | Viable and cheapest; rejected only if the owner wants TS 7 now (A5). This is the owner's call (§ 14). |

**Drawbacks of D1**: two TypeScript packages in `devDependencies` is deliberate debt; `node_modules/.bin/tsc` is TS 6, a trap for anyone running `npx tsc` by hand; Dependabot behaviour on aliases is unknown (A3).

## 13. Quality Requirements

| Attribute | Target | Met by |
|---|---|---|
| Build uses TS 7 | compiler version major 7 on every build | guard (CAP-1) |
| Wrong compiler is impossible to miss | build fails, names the version | guard + negative-path step (CAP-2) |
| No consumer-visible change | `lib/` byte-identical to TS 6 emit, or reviewed | one-time diff (CAP-4) |
| Clean install | no ERESOLVE, no force flags | CAP-3 |

## 14. Risks and Open Questions

**Feasibility** (per component): every component FEASIBLE — the alias layout, the build and the type-check were exercised in the spike; the guard and CI steps are ordinary Node and workflow edits. No Must-Have is UNCERTAIN or INFEASIBLE.

**Risk register** (likelihood × impact, 1–3 each):

| Risk | L | I | Score | Mitigation |
|---|---|---|---|---|
| Bare `tsc` silently runs TS 6 | 2 | 3 | 6 MEDIUM | D2 guard + D3 negative-path step (design constraint) |
| Dependabot mishandles the alias, re-proposing TS 7 for `typescript` | 2 | 2 | 4 MEDIUM | D4 ignore rule; follow-up item validates A3 and adds the manual-bump fallback |
| `prepare` makes a guard failure look like an install failure | 2 | 2 | 4 MEDIUM | guard message names itself and the version |
| `@typescript/typescript6` stops being published | 2 | 2 | 4 MEDIUM | PRD § 3 deferral trigger (switch transform / replace linter) |
| A later TS 7 release changes emit unnoticed | 1 | 3 | 3 LOW | exact pin; each TS 7 bump re-runs the one-time diff (documented in the bump procedure) |
| TS 7 and TS 6 diagnostics disagree on test files | 2 | 1 | 2 LOW | CAP-5 type-check under TS 7 is authoritative |
| `ci.yml` merge conflict with sibling items | 2 | 1 | 2 LOW | flagged only: gap-bump-invariants-unchecked and gap-phantom-required-checks also edit `ci.yml`; whichever lands second rebases |

No HIGH risk. No rabbit hole: the hardest part (the `.bin` hazard) is already found and designed around.

**Open questions**

| ID | Question | Load-bearing? | Context and impact |
|---|---|---|---|
| OQ-1 | Does the owner want TypeScript 7 adopted now (D1), or to stay on TypeScript 6 and close #266 until the tools support TS 7? | **yes** | The whole adoption feature rests on it (PRD assumption A5, yellow). Both options are viable: adoption costs about a day and adds a temporary second TypeScript package; staying costs nothing now and leaves the build one major behind. If deferred, only the diagnosis-correction item proceeds. |
| OQ-2 | Does Dependabot open update PRs for npm-aliased devDependencies? | no (for the adoption); yes for the follow-up | Settled by the follow-up item; D4's ignore rule prevents the harmful case either way. |
| OQ-3 | Is a corrective comment on #266 still wanted when the adoption PR will close #266? | no | If skipped, #266's thread keeps the wrong diagnosis until it is closed. |

## 15. Glossary

| Canonical name | Definition | Technical Architecture alias | Testing Architecture alias |
|---|---|---|---|
| BuildCompiler | the TypeScript compiler that produces `lib/` | `typescript7` devDependency | "TS7 compiler" |
| CompilerApiProvider | the package answering `require('typescript')` for tools | `typescript` alias → `@typescript/typescript6` | "TS6 API provider" |
| TriageRecord | a durable statement of why a dependency PR is blocked | memory note, index line, #266 comment | "records" |
| DependencyUpdate | a Dependabot PR such as #266 | Dependabot PR | "#266" |
| Guard | the TS 7 entry-point script asserting major 7 | `scripts/tsc7.mjs` (default) | "version-assert script" |

Cross-track consistency: one mismatch found and resolved — the Technical Architecture track proposed `npm view ts-jest@latest peerDependencies.typescript` as the alias-retirement check, which is the very check REQ-REC-002 retires. Resolution (the PRD, the earlier layer, decides — REQ-REC-002 as amended at Stage 3.7): the retirement check is whether the `ts-jest` unit suites and `npm run lint` pass in a scratch copy with `typescript` set to the TS 7 release itself, no alias, i.e. the tools run against the TS 7 package, never the peer range alone. Placement disagreement (type-check on Ubuntu only vs both OS) resolved to both OS (D5).

## 16. Requirement-to-Track Coverage Matrix

| Requirement | Tracks | Covering section | Test capability | Status |
|---|---|---|---|---|
| REQ-REC-001 | TA | § 5 triage records | CAP-9 | covered |
| REQ-REC-002 | TA | § 5 triage records; § 15 retirement check | CAP-10 | covered |
| REQ-REC-003 | TA | § 5 triage records | CAP-11 | covered |
| REQ-TC-001 | TA, Testing | § 4 D1/D2, § 5 guard + `build` | CAP-1 | covered |
| REQ-TC-002 | TA, Testing | § 4 D2/D3, § 5 negative-path step | CAP-2 | covered |
| REQ-TC-003 | TA, Testing | § 4 D1, § 6b (2)(3) | CAP-3 | covered |
| REQ-TC-004 | Testing | § 11.1, § 12 D6 | CAP-4 | covered |
| REQ-TC-005 | TA, Testing | § 5 `typecheck` + CI step | CAP-5 | covered |
| REQ-DEP-001 | TA | § 4 D4, § 5 dependabot ignore | CAP-6 | covered (A3 validation in follow-up item) |
| REQ-DEP-002 | TA | § 3, § 6 | CAP-7 | covered |
| REQ-DOC-001 | TA | § 5 documentation | CAP-8 | covered |

No UNCOVERED requirement.

## 16b. Element-to-Requirement Backward-Coverage Matrix

No wireframe handoff package exists (no UX track), so the provenance source is this document's § 5 table, audited against the PRD's requirement IDs.

| Element | Type | Traces to | Provenance source | Status |
|---|---|---|---|---|
| TriageRecord, BuildCompiler, CompilerApiProvider, DependencyUpdate | entity | PRD § 9 / REQ-REC-*, REQ-TC-*, REQ-DEP-* | PRD object model | traced |
| `typescript` → `@typescript/typescript6` alias | component | REQ-TC-003 | § 5 | traced |
| `typescript7` alias | component | REQ-TC-001 | § 5 | traced |
| Guard script | component | REQ-TC-001, REQ-TC-002 | § 5 | traced |
| `typecheck` script + CI step | component | REQ-TC-005 | § 5 | traced |
| Negative-path CI step | component | REQ-TC-002 | § 5 | traced |
| Dependabot ignore rule | component | REQ-DEP-001 | § 5 | traced |
| Documentation edits | component | REQ-DOC-001 | § 5 | traced |

No PHANTOM element. Note: the requirements these elements trace to are themselves pipeline-authored and ratification-pending (PRD § 16), so "traced" here means traced to a PRD identifier, not to an owner-ratified ask.

## Lock status

Not locked. The design brief is `draft` because OQ-1 is load-bearing and unanswered (autonomous run). Dual-lens ratification (product lens, UX lens) was not dispatched: no lock was possible this run, and both lenses should run on the version the owner ratifies. The UX lens has no subject (no interface, flow or IA) and should be recorded N/A by the dispatched lens, not by this author.
