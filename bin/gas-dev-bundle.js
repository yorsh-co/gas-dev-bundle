#!/usr/bin/env node
// @ts-check
import { main } from '../src/cli.js';

process.exitCode = main(process.argv.slice(2));
