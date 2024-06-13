/*
 * Copyright (C) 2021 Klaus Reimer <k@ailis.de>
 * Copyright (C) 2014 Facebook, Inc. and its affiliates
 *
 * See LICENSE.md for licensing information.
 */

import { JestEnvironment, JestEnvironmentConfig } from "@jest/environment";
import { LegacyFakeTimers, ModernFakeTimers } from "@jest/fake-timers";
import type { Global } from "@jest/types";
import { ModuleMocker } from "jest-mock";
import { installCommonGlobals } from "jest-util";
import { Context, Script } from "vm";

/** Special context which is handled specially in the hacked runInContext method below */
const RUN_IN_THIS_CONTEXT = {};

/** Remembered original runInContext method. */
const origRunInContext = Script.prototype.runInContext;

/**
 * Ugly hack to allow Jest to just use a single Node VM context. The Jest code in question is in a large private
 * method of the standard Jest runtime and it would be a lot of code-copying to create a custom runtime which
 * replaces the script run code. So we hack into the `script.runInContext` method instead to redirect it to
 * `script.runInThisContext` when environment returns the special [[RUN_IN_THIS_CONTEXT]] context.
 */
Script.prototype.runInContext = function(context, options): unknown {
    if (context === RUN_IN_THIS_CONTEXT) {
        return this.runInThisContext(options);
    } else {
        return origRunInContext.call(this, context, options);
    }
};

/**
 * Creates the jest global. This environment uses globalThis as global and we try to keep it as type-safe as possible
 * to detect problems with newer Jest versions early.
 *
 * @returns The jest global object.
 */
function createGlobal(): Global.Global {
    const jestGlobal: typeof globalThis & { [ "__coverage__" ] ?: unknown } = global;
    jestGlobal["__coverage__"] = {};
    return jestGlobal as Global.Global;
}

type Timer = {
    id: number;
    ref: () => Timer;
    unref: () => Timer;
};
const timerIdToRef = (id: number): Timer => ({
    id,
    ref() {
        return this;
    },
    unref() {
        return this;
    }
});
const timerRefToId = (timer: Timer): number | undefined => timer?.id;

/**
 * Jest environment for running tests in electron.
 */
export default class ElectronEnvironment implements JestEnvironment {
    public readonly global: Global.Global;
    public readonly moduleMocker: ModuleMocker;
    public readonly fakeTimers;
    public readonly fakeTimersModern;
    public readonly handleTestEvent = undefined;
    public readonly exportConditions = undefined;

    public constructor(config: JestEnvironmentConfig) {
        this.global = createGlobal();
        this.moduleMocker = new ModuleMocker(global);

        // Install fake timers
        this.fakeTimers = new LegacyFakeTimers({
            config: config.projectConfig,
            global,
            moduleMocker: this.moduleMocker,
            timerConfig: {
                idToRef: timerIdToRef,
                refToId: timerRefToId
            }
        });
        this.fakeTimersModern = new ModernFakeTimers({
            config: config.projectConfig,
            global
        });

        // Jest seems to set a new process property and this causes trouble in write-file-atomic module used
        // in Jest's cache transform stuff. So we remember the original property and restore it after Jest
        // installed its common globals
        const process = global.process;
        installCommonGlobals(global, config.projectConfig.globals);
        global.process = process;
    }

    public async setup(): Promise<void> {}

    public async teardown(): Promise<void> {}

    public getVmContext(): Context | null {
        // Return special context which is handled specially in the hacked `script.runInContext` function
        return RUN_IN_THIS_CONTEXT;
    }
}
