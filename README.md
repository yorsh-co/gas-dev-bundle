# gas-dev-bundle

## Bundles gas-\* Google Apps Script libraries from their dist tags into one global script file.

> [!NOTE]
> `gas-dev-bundle` is development tooling. It is installed as a dev dependency and is never pushed to Apps Script; only the generated bundle is.

> [!NOTE]
> `1.0.0` is the first release. It consumes the `gasLibrary` metadata that `gas-dev-release` >= 1.1.0 writes to each `dist` tag.

> **Disclaimer:**
> This project and [Yorsh](https://github.com/yorsh-co) are independent and are not affiliated with, endorsed by, or associated with Google LLC.

### Features

- Resolves each library to the highest `dist/vX.Y.Z` tag that satisfies a semver range, so upgrades are a version bump instead of a `git subtree pull`
- Bundles the libraries into one script in their declared load order, with peers ordered before the libraries that use them
- Reproducible output: no timestamps, and a header recording each library's version and full commit SHA
- Validates the bundle with `node --check` before writing anything
- Optional concatenated `.d.ts` file for the libraries' global declarations
- Shallow fetches cached in `node_modules/.cache/`; a half-finished fetch is never reused
- Strict configuration validation: unknown keys fail with the offending key path
- Programmatic API for tooling such as an Apps Script test runner
- Plain ESM JavaScript, no build step and a single runtime dependency (`semver`)

## Requirements

- Node.js >= 20.10
- git, with access to the libraries' repositories
- Libraries released with `gas-dev-release` >= 1.1.0 and `gasDevConfig.loadOrder`, so each `dist/vX.Y.Z` tag carries `gasLibrary` metadata

## Install

```bash
npm install -D github:yorsh-co/gas-dev-bundle#semver:^1.0.0
```

Add a script so the bundle is easy to refresh:

```json
{
  "scripts": {
    "bundle:libs": "gas-dev-bundle"
  }
}
```

## Usage

Configure the libraries in the Apps Script project's `package.json`, then run `gas-dev-bundle` in the project root:

```json
{
  "gasDevBundle": {
    "libraries": {
      "gas-sheetdb": "^2.1.0",
      "gas-lock": {
        "version": "^1.2.0",
        "repository": "https://github.com/me/gas-lock.git"
      }
    },
    "outFile": "src/lib/gas-libraries.js",
    "typesFile": "types/gas-libraries.d.ts"
  }
}
```

```
gas-dev-bundle
```

| Option         | Description      |
| -------------- | ---------------- |
| `-h`, `--help` | Show usage       |
| `--version`    | Show the version |

The command takes no positional arguments. It prints one line per bundled library (name, version, short SHA), the written paths and a reminder about load order.

| Exit code | Meaning                                                        |
| --------- | -------------------------------------------------------------- |
| `0`       | The bundle was written                                         |
| `1`       | Failure; the message is printed as `gas-dev-bundle: <message>` |
| `2`       | Invalid usage (unknown option or positional argument)          |

> [!IMPORTANT]
> Apps Script loads files in `filePushOrder` or, by default, alphabetically. `outFile` must load before any project code that uses the library globals at top level.

## Configuration

`gasDevBundle` in the project's `package.json`:

| Key         | Type   | Default                | Description                                                                    |
| ----------- | ------ | ---------------------- | ------------------------------------------------------------------------------ |
| `libraries` | object | required               | Non-empty map of library name to a semver range, or `{ version, repository? }` |
| `outFile`   | string | `src/gas-libraries.js` | Bundle path, relative to the project root; no `..`; must end in `.js`          |
| `typesFile` | string | none                   | Declarations path, relative to the project root; no `..`; must end in `.d.ts`  |

Library names match `/^[a-z0-9][a-z0-9._-]*$/`. `version` must be a valid semver range. `repository` is a non-empty Git URL or path and defaults to `https://github.com/yorsh-co/<name>.git`. Unknown keys are rejected with their path, e.g. `gasDevBundle.libraries.gas-lock.repositry is not a known option.`

## How versions are resolved

For each library the tool runs `git ls-remote --tags --refs <repository> 'refs/tags/dist/v*'`, parses the `dist/vX.Y.Z` tags (tags that are not valid semver are ignored) and picks `semver.maxSatisfying` for the range. If nothing matches, the error names the library, the range and the available versions. Git failures are reported with git's own message.

The chosen tag is fetched with a shallow clone and the commit SHA is recorded in the bundle header. Prereleases are only considered when the range itself names one.

## Load order and peers

Each library's `package.json` on its dist tag declares how it loads:

```json
{
  "name": "gas-sheetdb",
  "version": "2.1.0",
  "gasLibrary": {
    "loadOrder": ["gas-sheetdb.errors.js", "sub/x.js"],
    "peers": { "gas-lock": "^1.1.0" }
  }
}
```

- `loadOrder` is required: a non-empty list of relative `.js` paths that exist in the tag. A library without it needs a release made with `gas-dev-release` >= 1.1.0 and `gasDevConfig.loadOrder`. The package `name` must equal the configured name.
- `peers` are optional libraries used when present. A peer that is not configured is fine. A configured peer whose resolved version does not satisfy the range prints a warning to stderr and the bundle is still written.
- Libraries are ordered topologically by peers: a peer loads before the library using it, and ties keep the config order. A cycle is an error naming the libraries involved.

Every file is emitted under a `// ---- <library>/<path> ----` marker with its `"use strict";` lines (either quote style) removed, because directives mid-file have no effect in a concatenated script. A single `'use strict';` follows the header instead, so the whole bundle, including `extraFiles`, runs in strict mode, as the gas-\* sources do in their own files.

```js
// Generated by gas-dev-bundle — do not edit. Run `npx gas-dev-bundle` to update.
// gas-lock 1.2.0 (<full sha>)
// gas-sheetdb 2.1.0 (<full sha>)

'use strict';

// ---- gas-lock/gas-lock.constants.js ----
```

## Types

With `typesFile` set, every `.d.ts` file in each library (recursive, sorted by path, libraries in bundle order) is concatenated under the same header and per-file markers. Include the file in your `tsconfig.json` so the globals are declared in your project.

## Cache

Fetched libraries are cached in `<project>/node_modules/.cache/gas-dev-bundle/<name>@<version>/`. A fetch clones into a temporary sibling directory, records the commit SHA in `.gas-dev-bundle.json`, removes `.git` and renames the directory into place, so an interrupted fetch never looks cached. A complete entry fetched from the same repository is reused without cloning again; delete the directory to force a fresh fetch. Version resolution always queries the remote.

## Programmatic API

```js
import { bundle, loadConfig } from 'gas-dev-bundle';

const { code, types, resolved } = bundle({
  libraries: { 'gas-lock': '^1.2.0' },
  cwd: process.cwd(),
  extraFiles: ['/abs/path/dist/my-lib.js', '/abs/path/dist/my-lib.test.js'],
});
```

| Option       | Description                                                                                         |
| ------------ | --------------------------------------------------------------------------------------------------- |
| `libraries`  | Same shape as `gasDevBundle.libraries`                                                              |
| `cwd`        | Project root; default `process.cwd()`                                                               |
| `cacheDir`   | Default `<cwd>/node_modules/.cache/gas-dev-bundle`                                                  |
| `extraFiles` | Absolute `.js` paths appended after the libraries, in order, with `// ---- <basename> ----` markers |
| `warn`       | Receives peer warnings; default writes to stderr                                                    |

`bundle()` returns `{ code, types, resolved }`, where `resolved` lists `{ name, version, sha, repository }` in bundle order. It validates the code with `node --check` and writes nothing outside the cache. `loadConfig(cwd)` returns the validated `gasDevBundle` configuration. Failures throw `BundleError`.

## Using alongside git subtree

`git subtree` remains a fine way to vendor a single library. Do not use both methods for the same library: its globals would be declared twice, which fails the syntax check or breaks at runtime in Apps Script.

## License

MIT

See the `LICENSE` file for details.

## Support

Issues and feature requests are welcome via GitHub Issues.

Maintained by [yorsh-co](https://github.com/yorsh-co).

---

> [!TIP]
> Found `gas-dev-bundle` useful?
> Find more Google Apps Script libraries at [github.com/yorsh-co](https://github.com/yorsh-co).
