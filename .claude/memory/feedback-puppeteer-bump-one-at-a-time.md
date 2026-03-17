---
name: puppeteer-bump-one-minor-at-a-time
description: Puppeteer version bumps must be done one minor version at a time, each with its own release
type: feedback
---

Puppeteer minor version bumps must be done ONE minor at a time, not jumping across multiple minors in a single commit.

**Why:** Each minor version bump gets its own release on npm. Skipping intermediate minors means missing releases.

**How to apply:** When current is 24.37.x and latest is 24.39.x, do: bump to 24.38.0 → commit → release → then bump to 24.39.x → commit → release. Never collapse multiple minors into one commit.
