/*
 * Copyright (C) 2021 Klaus Reimer <k@ailis.de>
 * Copyright (C) 2014 Facebook, Inc. and its affiliates
 *
 * See LICENSE.md for licensing information.
 */

import * as path from "path";

export const getElectronBin = (from: string): string => {
    try {
        // first try to resolve from the `rootDir` of the project
        return path.resolve(
            // $FlowFixMe wrong core flow types for require.resolve
            require.resolve("electron", { paths: [ from ] }),
            "..",
            "cli.js"
        );
    } catch (error) {
        // default to electron included in this package's dependencies
        return path.resolve(require.resolve("electron"), "..", "cli.js");
    }
};
