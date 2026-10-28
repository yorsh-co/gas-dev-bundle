// @ts-check
import { readFileSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import semver from 'semver';
import { BundleError } from './errors.js';

/**
 * @typedef {object} LibraryConfig
 * @property {string} version Semver range matched against the library's `dist/vX.Y.Z` tags.
 * @property {string} repository Git URL or path of the library repository.
 */

/**
 * @typedef {object} BundleConfig
 * @property {Record<string, LibraryConfig>} libraries Libraries by name, in config order.
 * @property {string} outFile Bundle path relative to the project root.
 * @property {string} [typesFile] Declarations path relative to the project root.
 */

export const DEFAULT_OUT_FILE = 'src/gas-libraries.js';
const DEFAULT_ORG = 'https://github.com/yorsh-co';
const NAME_PATTERN = /^[a-z0-9][a-z0-9._-]*$/;
const CONFIG_KEYS = ['libraries', 'outFile', 'typesFile'];
const LIBRARY_KEYS = ['version', 'repository'];

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
export function isObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * @param {Record<string, unknown>} object
 * @param {string[]} known
 * @param {string} path
 */
function rejectUnknownKeys(object, known, path) {
  for (const key of Object.keys(object)) {
    if (!known.includes(key)) {
      throw new BundleError(`${path}.${key} is not a known option.`);
    }
  }
}

/**
 * Validates and normalizes the `libraries` map.
 *
 * @param {unknown} libraries A map of name to a range string or `{ version, repository? }`.
 * @param {string} path Key path used in error messages.
 * @param {boolean} [allowEmpty] Whether an empty map is valid.
 * @returns {Record<string, LibraryConfig>}
 * @throws {BundleError} On any invalid entry.
 */
export function normalizeLibraries(libraries, path, allowEmpty = false) {
  if (!isObject(libraries)) {
    throw new BundleError(
      `${path} must be ${allowEmpty ? 'an' : 'a non-empty'} object.`,
    );
  }
  if (!allowEmpty && Object.keys(libraries).length === 0) {
    throw new BundleError(`${path} must be a non-empty object.`);
  }
  /** @type {Record<string, LibraryConfig>} */
  const result = {};
  for (const [name, entry] of Object.entries(libraries)) {
    const entryPath = `${path}.${name}`;
    if (!NAME_PATTERN.test(name)) {
      throw new BundleError(
        `${path}: "${name}" is not a valid library name (expected ${NAME_PATTERN}).`,
      );
    }
    let version = entry;
    let repository = `${DEFAULT_ORG}/${name}.git`;
    if (isObject(entry)) {
      rejectUnknownKeys(entry, LIBRARY_KEYS, entryPath);
      version = entry.version;
      if (entry.repository !== undefined) {
        if (typeof entry.repository !== 'string' || entry.repository === '') {
          throw new BundleError(
            `${entryPath}.repository must be a non-empty string.`,
          );
        }
        repository = entry.repository;
      }
    }
    const versionPath = isObject(entry) ? `${entryPath}.version` : entryPath;
    if (typeof version !== 'string' || semver.validRange(version) === null) {
      throw new BundleError(
        `${versionPath} must be a valid semver range, got ${JSON.stringify(version)}.`,
      );
    }
    result[name] = { version, repository };
  }
  return result;
}

/**
 * @param {unknown} value
 * @param {string} path Key path used in error messages.
 * @param {string} extension Required file extension, e.g. `.js`.
 * @returns {string}
 */
function validateFilePath(value, path, extension) {
  if (
    typeof value !== 'string' ||
    value === '' ||
    isAbsolute(value) ||
    value.split(/[\\/]/).includes('..')
  ) {
    throw new BundleError(
      `${path} must be a relative path without "..", got ${JSON.stringify(value)}.`,
    );
  }
  if (!value.endsWith(extension)) {
    throw new BundleError(`${path} must end with ${extension}.`);
  }
  return value;
}

/**
 * Reads and validates `gasDevBundle` from the project's package.json.
 *
 * @param {string} cwd Project root.
 * @returns {BundleConfig}
 * @throws {BundleError} When package.json is unreadable or the configuration is invalid.
 */
export function loadConfig(cwd) {
  const file = join(cwd, 'package.json');
  /** @type {Record<string, unknown>} */
  let pkg;
  try {
    pkg = JSON.parse(readFileSync(file, 'utf8'));
  } catch (error) {
    throw new BundleError(
      `Cannot read package.json in ${cwd}: ${/** @type {Error} */ (error).message}`,
    );
  }
  const config = pkg.gasDevBundle;
  if (!isObject(config)) {
    throw new BundleError('package.json has no "gasDevBundle" object.');
  }
  rejectUnknownKeys(config, CONFIG_KEYS, 'gasDevBundle');
  /** @type {BundleConfig} */
  const result = {
    libraries: normalizeLibraries(config.libraries, 'gasDevBundle.libraries'),
    outFile:
      config.outFile === undefined
        ? DEFAULT_OUT_FILE
        : validateFilePath(config.outFile, 'gasDevBundle.outFile', '.js'),
  };
  if (config.typesFile !== undefined) {
    result.typesFile = validateFilePath(
      config.typesFile,
      'gasDevBundle.typesFile',
      '.d.ts',
    );
  }
  return result;
}
