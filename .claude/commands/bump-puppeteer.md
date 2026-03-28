# Bump Puppeteer

Discover new puppeteer releases and bump puppeteer-capture to track them. Each new minor gets its own
commit, PR, merge, and npm release before proceeding to the next.

## Arguments

$ARGUMENTS

Optional: a specific target version (e.g., `24.40.0`). If omitted, discovers all pending versions
automatically.

## Phase 1: Discovery

1. Read the current pinned version from `package.json` field `devDependencies.puppeteer`
2. Query npm for all published puppeteer versions:
   ```
   npm view puppeteer versions --json
   ```
3. Filter to versions newer than current, same major
4. Group by minor version; for each minor, pick the **latest patch**
5. Order the resulting list by minor ascending

**If argument was provided**: validate it exists on npm and use only that version.

Present the bump plan and ask for confirmation:

```
Current: 24.39.1

Pending bumps (one commit + release each):
  1. 24.40.x -> 24.40.2  (minor bump)
  2. 24.41.x -> 24.41.0  (minor bump)

Proceed?
```

If already up to date, say so and stop.

## Phase 2: Bump Loop

Process **one version at a time**. Complete the full cycle (branch, commit, PR, merge, release,
publish verification) before starting the next version.

### Step 2.1: Prepare branch

```bash
git checkout main
git pull origin main
git checkout -b imp/puppeteer-v{VERSION}
```

### Step 2.2: Update the 4 files

All changes go into a single atomic commit.

#### `package.json`

**devDependencies** -- pin both to exact new version (no caret):
```json
"puppeteer": "{VERSION}",
"puppeteer-core": "{VERSION}"
```

**peerDependencies** (`puppeteer-core` field) -- depends on bump type:
- **Minor bump** (minor number differs from current): append ` || ^{MAJOR}.{NEW_MINOR}.0`
- **Patch bump** (same minor, higher patch): no change (existing `^{MAJOR}.{MINOR}.0` covers it)

#### `.github/workflows/ci.yml`

1. Update `PUPPETEER_VERSION` env var (in the `build` job) to `{VERSION}`
2. Append `- '{VERSION}'` to the `puppeteer-version` matrix list (at the end)

#### `.github/workflows/publish.yml`

Update `PUPPETEER_VERSION` env var to `{VERSION}` in **all** occurrences (both `validate` and
`publish` jobs).

#### `package-lock.json`

Run `npm install` to regenerate. Do NOT edit manually. (`npm ci` will fail because the lockfile
doesn't match the updated package.json -- that's expected.)

### Step 2.3: Commit

Stage exactly these 4 files and commit:

```bash
git add package.json package-lock.json .github/workflows/ci.yml .github/workflows/publish.yml
```

Commit message: `(imp) puppeteer v{VERSION}`

No issue numbers in the commit message.

### Step 2.4: Push and create PR

```bash
git push -u origin imp/puppeteer-v{VERSION}
```

Create PR with `gh pr create`:
- **Title**: `(imp) puppeteer v{VERSION}`
- **Body**:
  ```
  ## Summary
  * Bump puppeteer and puppeteer-core from {OLD_VERSION} to {VERSION}
  * [If minor bump] Add `^{MAJOR}.{NEW_MINOR}.0` to peerDependencies range
  * Add {VERSION} to CI integration test matrix

  ## Test plan
  - [ ] CI build passes on Ubuntu and Windows
  - [ ] Integration tests pass for new version
  ```

### Step 2.5: CI and merge

Wait for CI:
```bash
gh pr checks {PR_NUMBER} --watch
```

If CI fails: diagnose, fix on the branch, push, and re-watch.

Once green, merge:
```bash
gh pr merge {PR_NUMBER} --merge
```

### Step 2.6: Create GitHub Release

1. Get the latest release tag:
   ```bash
   gh release list --limit 1
   ```
2. Compute next tag by incrementing the **minor** component (e.g., `1.45.0` -> `1.46.0`)
3. Switch to main and pull the merge commit:
   ```bash
   git checkout main
   git pull origin main
   ```
4. Create the release:
   ```bash
   gh release create {NEW_TAG} --target main --title "{NEW_TAG}" --generate-notes
   ```

### Step 2.7: Verify publish

The publish workflow triggers automatically on release creation. Monitor it:

```bash
gh run list --workflow=publish.yml --limit 1
gh run watch {RUN_ID}
```

Wait for it to complete successfully. If it fails, diagnose and fix before proceeding.

### Step 2.8: Next version

If more versions remain in the plan, return to **Step 2.1** for the next minor.

Clean up the local branch:
```bash
git branch -d imp/puppeteer-v{VERSION}
```

## Rules

- **One minor at a time**: never skip intermediate minors (24.39 -> 24.41 MUST go through 24.40)
- **Latest patch per minor**: when bumping to a new minor, use the latest available patch
- **4 files, 1 commit**: package.json, package-lock.json, ci.yml, publish.yml -- always all four
- **Commit message**: `(imp) puppeteer v{VERSION}` -- no issue numbers, no other decoration
- **Package version**: `package.json` `version` stays `0.0.0` -- npm version comes from the Git tag
- **Release tag format**: semver with minor increment (e.g., `1.46.0`), never patch or major
- **peerDeps only on minor bumps**: patch bumps within an already-covered minor don't touch peerDeps

## Resume

If interrupted mid-process:
- If PR exists but not merged: pick up at Step 2.5
- If merged but no release: pick up at Step 2.6
- If release exists but publish not verified: pick up at Step 2.7
- Check `gh pr list`, `gh release list`, and `gh run list --workflow=publish.yml` to detect state
