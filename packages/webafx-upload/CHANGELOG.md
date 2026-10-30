# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.2] - 2026-10-30

### Added

- Expired session records are purged after `expiredRecordRetentionDays` (default 30 days).

### Fixed

- S3 deferred staging supports local-to-local moves.
- S3-backed images are downloaded before sharp processing.

## [0.2.1] - 2026-10-29

### Changed

- Version bump to 0.2.1
