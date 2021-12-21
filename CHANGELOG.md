# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.1] - 2021-12-21

### Changed
- removed null check of chunk in _transform, should never happen
- switch allegedly faster than if
- abide to eslint-config-exp
- add tests so that we reach 100% coverage

## [2.0.0] - 2021-12-08

### Changed
- Refactor a bit to reduce CPU footprint

### Breaking
- eslint requires nodejs v12 or later, but should still work on node 10

## [1.2.1] - 2021-08-25
### Changed
- Scope package as bonniernews
- Use bonniernews fork for atlas-seq-matcher
- Allow slashes in unquoted attributes
