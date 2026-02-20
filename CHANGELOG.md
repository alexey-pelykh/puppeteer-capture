# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- Unit tests for core capture functionality

### Fixed

- Support repeated start/stop capture cycles on the same page
- Export `PuppeteerCaptureStartOptions` from package entry point
- Validate `dropCapturedFrames` option instead of duplicate `waitForFirstFrame` check

## [1.12.0] - 2025-04-15

### Changed

- Support puppeteer v24.6.0 and v24.6.1

## [1.11.0] - 2025-04-01

### Changed

- Support puppeteer v24.5.0

## [1.10.0] - 2025-03-09

### Changed

- Support puppeteer v24.3.1 and v24.4.0

## [1.9.0] - 2025-02-24

### Changed

- Support puppeteer v24.3.0

## [1.8.1] - 2025-02-15

### Fixed

- Detect closed CDP connection per puppeteer/puppeteer#13591

## [1.8.0] - 2025-02-13

### Changed

- Support puppeteer v24.1.1 and v24.2.0

## [1.7.0] - 2025-01-15

### Changed

- Support puppeteer v24.1.0

## [1.6.0] - 2025-01-10

### Changed

- Support puppeteer v23.11.1 and v24.0.0

### Fixed

- Include puppeteer-core v24.0.x in peer dependency range

## [1.5.0] - 2024-12-19

### Changed

- Support puppeteer v23.10.0 through v23.11.0

## [1.4.0] - 2024-12-18

### Changed

- Support puppeteer v23.0.0 through v23.9.0

## [1.3.0] - 2024-12-18

### Changed

- Support puppeteer v22.0.0 through v22.15.0

## [1.2.0] - 2024-12-18

### Changed

- Switch to `puppeteer-core` as peer dependency (v18.2 through v21.11)
- Exclude puppeteer-core v21.3.0 through v21.8.0 due to incompatibility

## [1.1.1] - 2023-01-06

### Changed

- Support puppeteer v14.x through v19.x

## [1.1.0] - 2022-06-30

### Changed

- Upgrade to ES6 module syntax
- Support puppeteer v14.4+

## [1.0.0] - 2022-06-02

### Added

- Test coverage reporting
- Timestamp injection for captured frames

## [0.0.0] - 2022-05-28

### Added

- Initial release
- Page capture using Chrome's `HeadlessExperimental` CDP domain
- Video encoding via ffmpeg
- Disconnected session detection

[unreleased]: https://github.com/alexey-pelykh/puppeteer-capture/compare/1.12.0...HEAD
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
