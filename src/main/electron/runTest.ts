/*
 * Copyright (C) 2021 Klaus Reimer <k@ailis.de>
 * Copyright (C) 2014 Facebook, Inc. and its affiliates
 *
 * See LICENSE.md for licensing information.
 */

import {
    BufferedConsole,
    CustomConsole,
    getConsoleOutput,
    LogMessage,
    LogType,
    NullConsole
} from "@jest/console";
import type { JestEnvironment } from "@jest/environment";
import type { TestFileEvent, TestResult } from "@jest/test-result";
import { createScriptTransformer } from "@jest/transform";
import type { Config } from "@jest/types";
import chalk from "chalk";
import * as fs from "graceful-fs";
import * as docblock from "jest-docblock";
import LeakDetector from "jest-leak-detector";
import { formatExecError } from "jest-message-util";
import Resolver, { resolveTestEnvironment } from "jest-resolve";
import type { TestRunnerContext } from "jest-runner";
import { TestFramework } from "jest-runner/build/types";
import type RuntimeClass from "jest-runtime";
import { ErrorWithStack, interopRequireDefault, setGlobal } from "jest-util";
import { RawSourceMap } from "source-map";
import sourcemapSupport, { UrlAndMap } from "source-map-support";

type RunTestInternalResult = {
    leakDetector: LeakDetector | null;
    result: TestResult;
};

function freezeConsole(
    testConsole: BufferedConsole | CustomConsole | NullConsole,
    config: Config.ProjectConfig,
): void {
    // @ts-expect-error: `_log` is `private` - we should figure out some proper API here
    // eslint-disable-next-line func-name-matching, no-underscore-dangle
    testConsole._log = function fakeConsolePush(
        // eslint-disable-next-line @typescript-eslint/naming-convention
        _type: LogType,
        message: LogMessage,
    ): void {
        const error = new ErrorWithStack(
            `${chalk.red(
                `${chalk.bold(
                    "Cannot log after tests are done.",
                )} Did you forget to wait for something async in your test?`,
            )}\nAttempted to log "${message}".`,
            fakeConsolePush,
        );

        const formattedError = formatExecError(
            error,
            config,
            { noStackTrace: false },
            undefined,
            true,
        );

        process.stderr.write("\n" + formattedError + "\n");
        process.exitCode = 1;
    };
}

// Keeping the core of "runTest" as a separate function (as "runTestInternal")
// is key to be able to detect memory leaks. Since all variables are local to
// the function, when "runTestInternal" finishes its execution, they can all be
// freed, UNLESS something else is leaking them (and that's why we can detect
// the leak!).
//
// If we had all the code in a single function, we should manually nullify all
// references to verify if there is a leak, which is not maintainable and error
// prone. That's why "runTestInternal" CANNOT be inlined inside "runTest".
async function runTestInternal(
    path: Config.Path,
    globalConfig: Config.GlobalConfig,
    config: Config.ProjectConfig,
    resolver: Resolver,
    context?: TestRunnerContext,
    sendMessageToJest?: TestFileEvent,
): Promise<RunTestInternalResult> {
    const testSource = fs.readFileSync(path, "utf8");
    const docblockPragmas = docblock.parse(docblock.extract(testSource));
    const customEnvironment = docblockPragmas["jest-environment"];

    let testEnvironment = config.testEnvironment;

    if (customEnvironment != null) {
        if (Array.isArray(customEnvironment)) {
            throw new Error(
                `You can only define a single test environment through docblocks, got "${customEnvironment.join(
                    ", ",
                )}"`,
            );
        }
        testEnvironment = resolveTestEnvironment({
            ...config,
            requireResolveFunction: require.resolve,
            testEnvironment: customEnvironment
        });
    }

    const cacheFS = new Map([ [ path, testSource ] ]);
    const transformer = await createScriptTransformer(config, cacheFS);

    const TestEnvironment: typeof JestEnvironment = await transformer.requireAndTranspileModule(testEnvironment);
    const testFramework: TestFramework = await transformer.requireAndTranspileModule(
        process.env.JEST_JASMINE === "1"
            ? require.resolve("jest-jasmine2")
            : config.testRunner,
    );
    const Runtime = (interopRequireDefault(
        config.moduleLoader != null
            // eslint-disable-next-line @typescript-eslint/no-require-imports, global-require
            ? require(config.moduleLoader)
            // eslint-disable-next-line @typescript-eslint/no-require-imports, global-require
            : require("jest-runtime"),
    ) as { default: typeof RuntimeClass }).default;

    const consoleOut = globalConfig.useStderr ? process.stderr : process.stdout;
    const consoleFormatter = (type: LogType, message: LogMessage): string =>
        getConsoleOutput(
            // 4 = the console call is buried 4 stack frames deep
            BufferedConsole.write([], type, message, 4),
            config,
            globalConfig,
        );

    let testConsole;

    if (globalConfig.silent === true) {
        testConsole = new NullConsole(consoleOut, consoleOut, consoleFormatter);
    } else if (globalConfig.verbose === true) {
        testConsole = new CustomConsole(consoleOut, consoleOut, consoleFormatter);
    } else {
        testConsole = new BufferedConsole();
    }

    const environment = new TestEnvironment(config, {
        console: testConsole,
        docblockPragmas,
        testPath: path
    });

    if (typeof environment.getVmContext !== "function") {
        console.error(
            `Test environment found at "${testEnvironment}" does not export a "getVmContext" method, which is `
                + `mandatory from Jest 27. This method is a replacement for "runScript".`,
        );
        process.exit(1);
    }

    const leakDetector = config.detectLeaks
        ? new LeakDetector(environment)
        : null;

    setGlobal(
        environment.global as unknown as typeof globalThis,
        "console",
        testConsole,
    );

    const runtime = new Runtime(
        config,
        environment,
        resolver,
        transformer,
        cacheFS,
        {
            changedFiles: context?.changedFiles,
            collectCoverage: globalConfig.collectCoverage,
            collectCoverageFrom: globalConfig.collectCoverageFrom,
            collectCoverageOnlyFrom: globalConfig.collectCoverageOnlyFrom,
            coverageProvider: globalConfig.coverageProvider,
            sourcesRelatedToTestsInChangedFiles:
                context?.sourcesRelatedToTestsInChangedFiles
        },
        path
    );

    const start = Date.now();

    for (const path of config.setupFiles) {
        const esm = runtime.unstable_shouldLoadAsEsm(path);

        if (esm) {
            await runtime.unstable_importModule(path);
        } else {
            runtime.requireModule(path);
        }
    }

    const sourcemapOptions: sourcemapSupport.Options = {
        environment: "node",
        handleUncaughtExceptions: false,
        retrieveSourceMap: source => {
            const sourceMapSource = runtime.getSourceMaps()?.get(source);

            if (sourceMapSource != null) {
                try {
                    return {
                        map: JSON.parse(fs.readFileSync(sourceMapSource, "utf8")) as RawSourceMap | string,
                        url: source
                    } as UrlAndMap;
                } catch {
                    // Ignored
                }
            }
            return null;
        }
    };

    // For tests
    runtime
        .requireInternalModule<typeof import("source-map-support")>(
            require.resolve("source-map-support"),
            "source-map-support",
        )
        .install(sourcemapOptions);

    // For runtime errors
    sourcemapSupport.install(sourcemapOptions);

    if (environment.global != null && environment.global.process != null && environment.global.process.exit != null) {
        const realExit = environment.global.process.exit;

        environment.global.process.exit = function exit(code?: number) {
            const error = new ErrorWithStack(
                `process.exit called with "${code}"`,
                exit,
            );

            const formattedError = formatExecError(
                error,
                config,
                { noStackTrace: false },
                undefined,
                true,
            );

            process.stderr.write(formattedError);

            return realExit(code);
        };
    }

    // if we don't have `getVmContext` on the env skip coverage
    const collectV8Coverage = globalConfig.coverageProvider === "v8" && typeof environment.getVmContext === "function";

    try {
        await environment.setup();

        let result: TestResult;

        try {
            if (collectV8Coverage) {
                await runtime.collectV8Coverage();
            }
            result = await testFramework(
                globalConfig,
                config,
                environment,
                runtime,
                path,
                sendMessageToJest,
            );
        } catch (err) {
            if (err instanceof Error) {
                // Access stack before uninstalling sourcemaps
                void err.stack;
            }
            throw err;
        } finally {
            if (collectV8Coverage) {
                await runtime.stopCollectingV8Coverage();
            }
        }

        freezeConsole(testConsole, config);

        const testCount = result.numPassingTests + result.numFailingTests + result.numPendingTests
            + result.numTodoTests;

        const end = Date.now();
        const testRuntime = end - start;
        result.perfStats = {
            end,
            runtime: testRuntime,
            slow: testRuntime / 1000 > config.slowTestThreshold,
            start
        };
        result.testFilePath = path;
        result.console = testConsole.getBuffer();
        result.skipped = testCount === result.numPendingTests;
        result.displayName = config.displayName;

        const coverage = runtime.getAllCoverageInfoCopy();
        if (coverage != null) {
            const coverageKeys = Object.keys(coverage);
            if (coverageKeys.length > 0) {
                result.coverage = coverage;
            }
        }

        if (collectV8Coverage) {
            const v8Coverage = runtime.getAllV8CoverageInfoCopy();
            if (v8Coverage != null && v8Coverage.length > 0) {
                result.v8Coverage = v8Coverage;
            }
        }

        if (globalConfig.logHeapUsage) {
            if (global.gc != null) {
                global.gc();
            }
            result.memoryUsage = process.memoryUsage().heapUsed;
        }

        // Delay the resolution to allow log messages to be output.
        return await new Promise(resolve => {
            setImmediate(() => resolve({ leakDetector, result }));
        });
    } finally {
        runtime.teardown();
        await environment.teardown();

        sourcemapSupport.resetRetrieveHandlers();
    }
}

export default async function runTest(
    path: Config.Path,
    globalConfig: Config.GlobalConfig,
    config: Config.ProjectConfig,
    resolver: Resolver,
    context?: TestRunnerContext,
    sendMessageToJest?: TestFileEvent,
): Promise<TestResult> {
    const { leakDetector, result } = await runTestInternal(
        path,
        globalConfig,
        config,
        resolver,
        context,
        sendMessageToJest,
    );

    if (leakDetector != null) {
        // We wanna allow a tiny but time to pass to allow last-minute cleanup
        await new Promise(resolve => setTimeout(resolve, 100));

        // Resolve leak detector, outside the "runTestInternal" closure.
        result.leaks = await leakDetector.isLeaking();
    } else {
        result.leaks = false;
    }

    return result;
}
