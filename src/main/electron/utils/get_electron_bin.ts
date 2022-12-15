/*
 * Copyright (C) 2021 Klaus Reimer <k@ailis.de>
 * Copyright (C) 2014 Facebook, Inc. and its affiliates
 *
 * See LICENSE.md for licensing information.
 */

import { resolve } from "path";

export function getElectronBin(from: string): string {
    try {
        // first try to resolve from the `rootDir` of the project
        return resolve(require.resolve("electron", { paths: [ from ] }), "../cli.js");
    } catch (error) {
        // default to electron included in this package's dependencies
        return resolve(require.resolve("electron"), "../cli.js");
    }
}
