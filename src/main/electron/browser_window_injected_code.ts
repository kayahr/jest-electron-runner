/*
 * Copyright (C) 2021 Klaus Reimer <k@ailis.de>
 * Copyright (C) 2014 Facebook, Inc. and its affiliates
 *
 * See LICENSE.md for licensing information.
 */

// For some reason without 'unsafe-eval' electron runner can't read snapshot files
// and tries to write them every time it runs
(window as any).ELECTRON_DISABLE_SECURITY_WARNINGS = true;

// react devtools only checks for the presence of a production environment
// in order to suggest downloading it, which means it logs a msg in a test environment
if (!(window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__) {
    (window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__ = { isDisabled: true };
}

import type { IPCTestData } from '../types';

import { buildFailureTestResult } from '../core/utils.js';
import { ipcRenderer } from 'electron';
import { runTest } from "../runTest";
import { getResolver } from './utils/resolver';
import { Console } from "console";

ipcRenderer.on(
    'run-test',
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
            // eslint-disable-next-line no-console
            console.error(error);
        }
    },
);

const patchConsole = () => {
    const mainConsole = new Console(process.stdout, process.stderr) as unknown as Record<string, (...args: unknown[]) => unknown>;
    const rendererConsole = global.console as unknown as Record<string, (...args: unknown[]) => unknown>;
    const mergedConsole: Record<string, Function> = {};
    Object.getOwnPropertyNames(rendererConsole)
        .filter(prop => typeof rendererConsole[prop] === 'function')
        .forEach(prop => {
            mergedConsole[prop] =
                typeof mainConsole[prop] === 'function'
                    ? (...args: unknown[]) => {
                        mainConsole[prop](...args);
                        return rendererConsole[prop](...args);
                    }
                    : (...args: unknown[]) => rendererConsole[prop](...args);
        });
    global.console = mergedConsole as unknown as Console;
};
patchConsole();
