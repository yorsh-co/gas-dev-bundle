# Changelog

---

## [1.1.1] - 2026-10-30

### Fixed

- `'use strict';` lines are now stripped like `"use strict";`; previously the single-quoted directive of Prettier-formatted releases survived, so whether the bundle ran in strict mode depended on its first file
- The bundle starts with one `'use strict';` directive after the header, so every file, including `extraFiles`, keeps the strict mode of its source

---

## [1.1.0] - 2026-10-28

### Changed

- `bundle()` accepts an empty `libraries` map, bundling only `extraFiles`; the `gasDevBundle` config still requires at least one library

---

## [1.0.0] - 2026-10-28

### Added

- `gas-dev-bundle` CLI (`--help`, `--version`; exit codes 0, 1 on failure, 2 on invalid usage) that bundles `gas-*` libraries from their `dist/vX.Y.Z` tags into one Apps Script global script file, configured by `gasDevBundle` in `package.json`
  - `libraries`: library name to a semver range or `{ version, repository }` (default repository `https://github.com/yorsh-co/<name>.git`); `outFile` (default `src/gas-libraries.js`); optional `typesFile` (`.d.ts`)
  - Strict configuration validation: unknown keys fail with the key path
  - Version resolution with `git ls-remote` and `semver.maxSatisfying`; unparseable tags are ignored and a missing match lists the available versions
  - Shallow fetch into `node_modules/.cache/gas-dev-bundle/<name>@<version>/`, recording the commit SHA; entries are renamed into place so an interrupted fetch is never reused
  - Reads `gasLibrary.loadOrder` and `gasLibrary.peers` written by `gas-dev-release` >= 1.1.0; a library without them, or whose `name` differs from the configured one, is rejected
  - Peers load before the library using them (ties keep config order, cycles fail naming the libraries); a bundled peer outside the requested range only warns
  - Deterministic output with a header listing every library version and commit SHA, per-file markers and `"use strict";` lines removed; validated with `node --check` before anything is written
  - `typesFile`: every library `.d.ts` concatenated in bundle order
- Library API: `bundle({ libraries, cwd?, cacheDir?, extraFiles?, warn? })` and `loadConfig(cwd)`, with hand-written types
- Tooling: Prettier, ESLint (flat config), TypeScript `checkJs` type-checking, Vitest and Dependabot for npm, all from `gas-dev-config`
