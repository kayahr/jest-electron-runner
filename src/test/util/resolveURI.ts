/*
 * Copyright (C) 2021 Klaus Reimer <k@ailis.de>
 * See LICENSE.md for licensing information.
 */

import { resolve } from "node:path";

/**
 * Resolves a filename relative to the src/test/data directory to an absolute file URI which Electron can load from.
 *
 * @param filename - The filename relative to the src/test/data directory.
 * @return The absolute file URI.
 */
export function resolveURI(filename: string): string {
    return "file://" + resolve(__dirname, "..", "..", "..", "src", "test", "data", filename).replace(/\\/g, "/");
}
