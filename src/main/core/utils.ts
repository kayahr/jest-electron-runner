/*
 * Copyright (C) 2021 Klaus Reimer <k@ailis.de>
 * Copyright (C) 2014 Facebook, Inc. and its affiliates
 *
 * See LICENSE.md for licensing information.
 */

import type { TestResult } from "@jest/test-result";
import type { Config } from "@jest/types";
import { formatExecError } from "jest-message-util";

export type WorkerID = string;
export type ServerID = string;

function rand(): number {
    return Math.floor(Math.random() * 10000000);
}

export function makeUniqServerId(): ServerID {
    return `jest-atom-runner-ipc-server-${Date.now() + rand()}`;
}

export function makeUniqWorkerId(): WorkerID {
    return `jest-atom-runner-ipc-worker-${Date.now() + rand()}`;
}

export function validateIPCID(id?: string): string {
    if (typeof id === "string" && (/ipc/.exec(id)) != null) {
        return id;
    }
    throw new Error(`Invalid IPC id: "${JSON.stringify(id)}"`);
}

export function buildFailureTestResult(
    testPath: string,
    err: Error,
    config: Config.ProjectConfig,
    globalConfig: Config.GlobalConfig
): TestResult {
    const failureMessage = formatExecError(err, config, globalConfig);
    return {
        console: undefined,
        displayName: undefined,
        failureMessage,
        leaks: false,
        numFailingTests: 0,
        numPassingTests: 0,
        numPendingTests: 0,
        numTodoTests: 0,
        openHandles: [],
        perfStats: {
            end: 0,
            start: 0,
            slow: false,
            runtime: 0
        },
        skipped: false,
        snapshot: {
            added: 0,
            fileDeleted: false,
            matched: 0,
            unchecked: 0,
            uncheckedKeys: [],
            unmatched: 0,
            updated: 0
        },
        testExecError: { message: failureMessage, stack: err.stack },
        testFilePath: testPath,
        testResults: []
    };
}
