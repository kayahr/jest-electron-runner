/*
 * Copyright (C) 2021 Klaus Reimer <k@ailis.de>
 * Copyright (C) 2014-present, Facebook, Inc.
 *
 * See LICENSE.md for licensing information.
 */

// Ugly hack to import runTest from jest-runner which is no longer exported in Jest 27
import path from "path";
const runTestPath = path.relative(__dirname, path.resolve(path.dirname(require.resolve("jest-runner/package.json")),
    "build/runTest.js"));
export const { default: runTest } = require(runTestPath);
