/*
 * Copyright (C) 2021 Klaus Reimer <k@ailis.de>
 * Copyright (C) 2014 Facebook, Inc. and its affiliates
 *
 * See LICENSE.md for licensing information.
 */

const win = window as typeof window & Record<string, unknown>;

// For some reason without 'unsafe-eval' electron runner can't read snapshot files
// and tries to write them every time it runs
win.ELECTRON_DISABLE_SECURITY_WARNINGS = true;

// react devtools only checks for the presence of a production environment
// in order to suggest downloading it, which means it logs a msg in a test environment
if (win["__REACT_DEVTOOLS_GLOBAL_HOOK__"] == null) {
    win["__REACT_DEVTOOLS_GLOBAL_HOOK__"] = {
        isDisabled: true
    };
}

import { ipcRenderer } from "electron";

import { buildFailureTestResult } from "../core/utils.js";
import type { IPCTestData } from "../types";
import runTest from "./runTest";
import { getResolver } from "./utils/resolver";

ipcRenderer.on(
    "run-test",
    async (event, testData: IPCTestData, workerID: string) => {
        try {
            const result = await runTest(
                testData.path,
                testData.globalConfig,
                testData.config,
                getResolver(testData.config, testData.serializableModuleMap),
            );

            ipcRenderer.send(workerID, result);
        } catch (error) {
            ipcRenderer.send(
                workerID,
                buildFailureTestResult(
                    testData.path,
                    error instanceof Error ? error : new Error("" + error),
                    testData.config,
                    testData.globalConfig,
                ),
            );
            console.error(error);
        }
    },
);
