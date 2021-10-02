/*
 * Copyright (C) 2021 Klaus Reimer <k@ailis.de>
 * Copyright (C) 2014 Facebook, Inc. and its affiliates
 *
 * See LICENSE.md for licensing information.
 */

import type { TestResult } from "@jest/test-result";
import { BrowserWindow, ipcMain } from "electron";

import { buildFailureTestResult, makeUniqWorkerId } from "../../core/utils";
import type { IPCTestData } from "../../types";
import runTest from "../runTest";
import { getResolver } from "../utils/resolver";

const isMain = process.env.isMain === "true";

async function runInNode(testData: IPCTestData): Promise<TestResult> {
    try {
        return await runTest(
            testData.path,
            testData.globalConfig,
            testData.config,
            getResolver(testData.config, testData.serializableModuleMap),
        );
    } catch (error) {
        console.error(error);
        return buildFailureTestResult(
            testData.path,
            error instanceof Error ? error : new Error("" + error),
            testData.config,
            testData.globalConfig,
        );
    }
}

async function runInBrowserWindow(testData: IPCTestData): Promise<TestResult> {
    try {
        const workerID = makeUniqWorkerId();
        const win = new BrowserWindow({
            show: false,
            webPreferences: {
                nodeIntegration: true,
                contextIsolation: false,
                nativeWindowOpen: true
            }
        });

        win.webContents.on("console-message", (event, level, message, line, sourceId) => {
            if (/\bdeprecated\b/i.exec(message) != null) {
                // Ignore deprecation warnings
                return;
            }
            const levels = [ console.trace, console.info, console.warn, console.error ];
            levels[level](message);
        });
        await win.loadURL(`file://${require.resolve("../index.html")}`);
        win.webContents.send("run-test", testData, workerID);

        return await new Promise<TestResult>(resolve => {
            ipcMain.once(workerID, (event, testResult: TestResult) => {
                win.destroy();
                resolve(testResult);
            });
        });
    } catch(error) {
        const testResult = buildFailureTestResult(
            testData.path,
            error instanceof Error ? error : new Error("" + error),
            testData.config,
            testData.globalConfig,
        );
        return testResult;
    }
}

function runInNodeOrBrowser(testData: IPCTestData): Promise<TestResult> {
    return isMain ? runInNode(testData) : runInBrowserWindow(testData);
}

const methods = {
    runTest(testData: IPCTestData): Promise<TestResult> {
        return runInNodeOrBrowser(testData);
    },
    shutDown(): Promise<any> {
        return Promise.resolve();
    }
};
export default methods;
