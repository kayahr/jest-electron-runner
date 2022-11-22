/*
 * Copyright (C) 2021 Klaus Reimer <k@ailis.de>
 * Copyright (C) 2014 Facebook, Inc. and its affiliates
 *
 * See LICENSE.md for licensing information.
 */

export function once<Args extends unknown[], Result>(fn: (...args: Args) => Result): (...args: Args) => Result {
    const none = Symbol("none");
    let result: Result | typeof none = none;
    return (...args: Args): Result => {
        if (result === none) {
            result = fn(...args);
        }
        return result;
    };
}
