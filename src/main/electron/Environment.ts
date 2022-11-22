/*
 * Copyright (C) 2021 Klaus Reimer <k@ailis.de>
 * Copyright (C) 2014 Facebook, Inc. and its affiliates
 *
 * See LICENSE.md for licensing information.
 */

import { Context, Script } from "node:vm";

import type { Config } from "@jest/types";
import { ModuleMocker } from "jest-mock";
import { installCommonGlobals } from "jest-util";

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

export default class ElectronEnvironment {
    public global: Object;
    public moduleMocker: Object;
    public fakeTimers: Object;

    public constructor(config: Config.ProjectConfig) {
        this.global = global;
        this.moduleMocker = new ModuleMocker(global);
        this.fakeTimers = {
            useFakeTimers() {
                throw new Error("fakeTimers are not supported in electron environment");
            },
            clearAllTimers() {}
        };

        // Jest seems to set a new process property and this causes trouble in write-file-atomic module used
        // in Jest's cache transform stuff. So we remember the original property and restore it after Jest
        // installed it's common globals
        const process = global.process;
        installCommonGlobals(global, config.globals);
        global.process = process;
    }

    public async setup(): Promise<void> {}

    public async teardown(): Promise<void> {}

    public getVmContext(): Context | null {
        // Return special context which is handled specially in the hacked `script.runInContext` function
        return RUN_IN_THIS_CONTEXT;
    }
}
