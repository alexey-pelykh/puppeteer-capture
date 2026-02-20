# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- Unit tests for inverted test pyramid
- API reference documentation to README
- `PuppeteerCaptureStartOptions` export from index
- HeadlessExperimental platform risk documentation in README
- `CODE_OF_CONDUCT.md`, `CONTRIBUTING.md`, issue templates, and pull request template
- GitHub Sponsors funding configuration

### Changed

- Pin GitHub Actions to SHA digests
- Harden private API `_client()` usage
- Add top-level `permissions` block to CI workflow
- Migrate publish workflow to OIDC trusted publishing
- Overhaul README for launch readiness

### Fixed

- Support repeated start/stop capture cycles
- Validate `dropCapturedFrames` instead of duplicate `waitForFirstFrame` check
- Reduce CI failure rate with timeouts, concurrency, and caching
- Widen `requestAnimationFrame` timing threshold for Windows CI flake
- Add concurrency control to GitHub Pages deployment

### Security

- Bump tar-fs from 3.0.8 to 3.1.1
- Bump js-yaml from 3.14.1 to 3.14.2

## [1.12.0] - 2025-04-15

### Changed

- Support Puppeteer v24.6.0 and v24.6.1

## [1.11.0] - 2025-04-01

### Changed

- Support Puppeteer v24.5.0

## [1.10.0] - 2025-03-09

### Changed

- Support Puppeteer v24.3.1 and v24.4.0

## [1.9.0] - 2025-02-24

### Changed

- Support Puppeteer v24.3.0

## [1.8.1] - 2025-02-15

### Fixed

- Detect closed CDP connection per [puppeteer#13591](https://github.com/puppeteer/puppeteer/pull/13591)

## [1.8.0] - 2025-02-13

### Changed

- Support Puppeteer v24.1.1 and v24.2.0

## [1.7.0] - 2025-01-15

### Changed

- Support Puppeteer v24.1.0

## [1.6.0] - 2025-01-10

### Changed

- Support Puppeteer v23.11.1 and v24.0.0

### Fixed

- Fix `puppeteer-core` peer dependency to include v24.0.x

## [1.5.0] - 2024-12-19

### Changed

- Support Puppeteer v23.10.0 through v23.11.0

## [1.4.0] - 2024-12-18

### Changed

- Support Puppeteer v23.0.0 through v23.9.0

## [1.3.0] - 2024-12-18

### Changed

- Support Puppeteer v22.0.0 through v22.15.0

## [1.2.0] - 2024-12-18

### Changed

- Switch peer dependency from `puppeteer` to `puppeteer-core` (v18.2 through v21.11)
- Add GitHub Pages documentation site

### Fixed

- Exclude incompatible `puppeteer[-core]` v21.3.0 through v21.8.0

### Security

- Bump word-wrap from 1.2.3 to 1.2.4

## [1.1.1] - 2023-01-06

### Changed

- Support Puppeteer v14.x through v19.x

### Security

- Bump json5 from 2.2.1 to 2.2.3

## [1.1.0] - 2022-06-30

### Changed

- Upgrade to ES6 modules
- Support Puppeteer v14.4+ and v15.x

## [1.0.0] - 2022-06-02

### Added

- Timestamp injection for deterministic frame timing
- Test coverage reporting

## [0.0.0] - 2022-05-28

### Added

- Initial release
- CDP-based video capture using `HeadlessExperimental.beginFrame`
- Deterministic frame-by-frame rendering
- FFmpeg-based video encoding
- Support for Puppeteer v14.x

[Unreleased]: https://github.com/alexey-pelykh/puppeteer-capture/compare/1.12.0...HEAD
[1.12.0]: https://github.com/alexey-pelykh/puppeteer-capture/compare/1.11.0...1.12.0
[1.11.0]: https://github.com/alexey-pelykh/puppeteer-capture/compare/1.10.0...1.11.0
[1.10.0]: https://github.com/alexey-pelykh/puppeteer-capture/compare/1.9.0...1.10.0
[1.9.0]: https://github.com/alexey-pelykh/puppeteer-capture/compare/1.8.1...1.9.0
[1.8.1]: https://github.com/alexey-pelykh/puppeteer-capture/compare/1.8.0...1.8.1
[1.8.0]: https://github.com/alexey-pelykh/puppeteer-capture/compare/1.7.0...1.8.0
[1.7.0]: https://github.com/alexey-pelykh/puppeteer-capture/compare/1.6.0...1.7.0
[1.6.0]: https://github.com/alexey-pelykh/puppeteer-capture/compare/1.5.0...1.6.0
[1.5.0]: https://github.com/alexey-pelykh/puppeteer-capture/compare/1.4.0...1.5.0
[1.4.0]: https://github.com/alexey-pelykh/puppeteer-capture/compare/1.3.0...1.4.0
[1.3.0]: https://github.com/alexey-pelykh/puppeteer-capture/compare/1.2.0...1.3.0
[1.2.0]: https://github.com/alexey-pelykh/puppeteer-capture/compare/1.1.1...1.2.0
[1.1.1]: https://github.com/alexey-pelykh/puppeteer-capture/compare/1.1.0...1.1.1
[1.1.0]: https://github.com/alexey-pelykh/puppeteer-capture/compare/1.0.0...1.1.0
[1.0.0]: https://github.com/alexey-pelykh/puppeteer-capture/compare/0.0.0...1.0.0
[0.0.0]: https://github.com/alexey-pelykh/puppeteer-capture/releases/tag/0.0.0
