---
name: puppeteer-bump-one-step-at-a-time
description: "Puppeteer version bumps must be done one (major, minor) at a time, exhausting current-major minors before crossing into the next major; each combo gets its own release"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: d03815fc-0e97-4696-8850-546696e14740
---

Puppeteer version bumps must be done ONE (major, minor) combo at a time, not jumping across multiple minors or majors in a single commit. Exhaust all pending minors of the current major before crossing into the next major.

**Why:** Each (major, minor) bump gets its own release on npm. Skipping intermediates means missing releases and obscures which puppeteer change broke compatibility if CI fails downstream.

**How to apply:** When current is 24.43.1 and the only newer version is 25.0.2 (no 24.44+ exists), bump directly to 25.0.2 — that's not skipping, because there's nothing between. When current is 24.37.x and latest is 24.39.x, do: bump to 24.38.0 → commit → release → then bump to 24.39.x → commit → release. When both 24.44.0 and 25.0.2 are pending, do 24.44.0 first (exhaust current major), then 25.0.2. Never collapse multiple (major, minor) combos into one commit.
