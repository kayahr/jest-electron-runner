/*
 * Copyright (C) 2021 Klaus Reimer <k@ailis.de>
 * Copyright (C) 2014 Facebook, Inc. and its affiliates
 *
 * See LICENSE.md for licensing information.
 */

import type { Config } from "@jest/types";
import { spawn } from "child_process";
import { OnTestFailure, OnTestStart, OnTestSuccess, Test, TestRunnerOptions, TestWatcher } from "jest-runner";
import throat from "throat";

import { TestRunnerTarget } from "../types";
import { JestWorkerRPCProcess } from "./rpc/JestWorkerRPCProcess";
import { getElectronBin } from "./utils/get_electron_bin";
import { once } from "./utils/once";

// Share ipc server and farm between multiple runs, so we don't restart
// the whole thing in watch mode every time.
let jestWorkerRPCProcess: JestWorkerRPCProcess | null = null;

export function isMain(target: TestRunnerTarget): target is TestRunnerTarget.MAIN {
    return target === TestRunnerTarget.MAIN;
}

export function isRenderer(target: TestRunnerTarget): target is TestRunnerTarget.RENDERER {
    return target === TestRunnerTarget.RENDERER;
}

const startWorker = async ({ rootDir, target }: { rootDir: string, target: TestRunnerTarget }):
        Promise<JestWorkerRPCProcess> => {
    if (isRenderer(target) && jestWorkerRPCProcess != null) {
        return jestWorkerRPCProcess;
    }

    const proc = new JestWorkerRPCProcess(
        ({ serverID }) => {
            const injectedCodePath = require.resolve(
                "./electron_process_injected_code.js",
            );

            const currentNodeBinPath = process.execPath;
            const electronBin = getElectronBin(rootDir);
            const spawnArgs = [ electronBin ];
            if (process.env.JEST_ELECTRON_RUNNER_MAIN_THREAD_DEBUG_PORT != null) {
                spawnArgs.push(`--inspect=${process.env.JEST_ELECTRON_RUNNER_MAIN_THREAD_DEBUG_PORT}`);
            }
            if (process.env.JEST_ELECTRON_RUNNER_RENDERER_THREAD_DEBUG_PORT != null) {
                spawnArgs.push(
                    `--remote-debugging-port=${process.env.JEST_ELECTRON_RUNNER_RENDERER_THREAD_DEBUG_PORT}`);
            }
            spawnArgs.push(injectedCodePath);
            spawnArgs.push("--no-sandbox");
            spawnArgs.push("--headless");

            if ("gc" in global) {
                spawnArgs.push("--js-flags=--expose-gc");
            }
            const child = spawn(currentNodeBinPath, spawnArgs, {
                stdio: [
                    "inherit",
                    // redirect child process' stdout to parent process stderr, so it
                    // doesn't break any tools that depend on stdout (like the ones
                    // that consume a generated JSON report from jest's stdout)
                    process.stderr,
                    "inherit"
                ],
                env: {
                    ...process.env,
                    ...(isMain(target) ? { isMain: "true" } : {}),
                    JEST_SERVER_ID: serverID
                },
                detached: process.env.JEST_ELECTRON_RUNNER_DISABLE_PROCESS_DETACHMENT == null
            });
            DISPOSABLES.add(() => {
                if (child.pid != null) {
                    try {
                        // Kill whole process group with negative PID (See `man kill`)
                        process.kill(-child.pid, "SIGKILL");
                    } catch {
                        // Ignored
                    }
                }
                child.kill("SIGKILL");
            });
            return child;
        }
    );

    if (isRenderer(target)) {
        jestWorkerRPCProcess = proc;
    }

    await proc.start();
    DISPOSABLES.add(() => {
        proc.stop();
    });

    return proc;
};

const registerProcessListeners = (cleanup: Function): void => {
    registerProcessListener("SIGINT2", () => {
        cleanup();
        process.exit(130);
    });

    registerProcessListener("exit", () => {
        cleanup();
    });

    registerProcessListener("uncaughtException", () => {
        cleanup();
        // This will prevent other handlers to handle errors
        // (e.g. global Jest handler). TODO: find a way to provide
        // a cleanup function to Jest so it runs it instead
        process.exit(1);
    });
};

const DISPOSABLES = new Set<Function>();

export default abstract class TestRunner {
    private readonly globalConfig: Config.GlobalConfig;

    public constructor(globalConfig: Config.GlobalConfig) {
        this.globalConfig = globalConfig;
    }

    public abstract getTarget(): TestRunnerTarget;

    public async runTests(
        tests: Test[],
        watcher: TestWatcher,
        onStart: OnTestStart,
        onResult: OnTestSuccess,
        onFailure: OnTestFailure,
        options: TestRunnerOptions,
    ): Promise<void> {
        const isWatch = this.globalConfig.watch || this.globalConfig.watchAll;
        const { maxWorkers, rootDir } = this.globalConfig;
        const concurrency = isWatch
            ? // because watch is usually used in the background, we'll only use
            // half of the regular workers so we don't block other developer
            // environment UIs
            Math.ceil(Math.min(tests.length, maxWorkers) / 2)
            : Math.min(tests.length, maxWorkers);
        const target = this.getTarget();

        const cleanup = once(() => {
            for (const dispose of DISPOSABLES) {
                dispose();
                DISPOSABLES.delete(dispose);
            }
        });

        registerProcessListeners(cleanup);

        // Cleanup when runner is terminated with Ctrl-C
        process.on("SIGINT", () => {
            cleanup();
            process.exit();
        });

        // Startup the process for renderer tests, since it'll be one
        // process that every test will share.
        if (isRenderer(target)) {
            await startWorker({ rootDir, target });
        }

        await Promise.all(
            tests.map(
                throat(concurrency, async test => {
                    await onStart(test);
                    try {
                        const config = test.context.config;
                        const globalConfig = this.globalConfig;
                        const rpc = await startWorker({ rootDir, target });
                        const testResult = await rpc.remote.runTest({
                            serializableModuleMap: test.context.moduleMap.toJSON(),
                            config,
                            globalConfig,
                            path: test.path
                        });
                        if (testResult.testExecError != null) {
                            await onFailure(test, testResult.testExecError);
                        } else {
                            await onResult(test, testResult);
                        }
                        // If we're running tests in electron 'main' process
                        // we need to respawn them for every single test.
                        if (isMain(target)) {
                            rpc.stop();
                        }
                    } catch (error) {
                        await onFailure(test, {
                            message: error instanceof Error ? error.message : "" + error,
                            stack: error instanceof Error ? error.stack : null
                        });
                    }
                }),
            ),
        );

        if (!isWatch) {
            cleanup();
        }
    }
}


// Because in watch mode the TestRunner is recreated each time, we have
// to make sure we're not registering new process events on every test
// run trigger (at some point EventEmitter will start complaining about a
// memory leak if we do).We'll keep a global map of callbacks (because
// `process` is global) and deregister the old callbacks before we register
// new ones.
const REGISTERED_PROCESS_EVENTS_MAP = new Map<string, NodeJS.BeforeExitListener>();
const registerProcessListener = (eventName: string, cb: NodeJS.BeforeExitListener): void => {
    const event = REGISTERED_PROCESS_EVENTS_MAP.get(eventName);
    if (event != null) {
        process.off(eventName, event);
    }
    process.on(eventName, cb);
    REGISTERED_PROCESS_EVENTS_MAP.set(eventName, cb);
};
