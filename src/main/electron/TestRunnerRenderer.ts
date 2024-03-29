/*
 * Copyright (C) 2021 Klaus Reimer <k@ailis.de>
 * Copyright (C) 2014 Facebook, Inc. and its affiliates
 *
 * See LICENSE.md for licensing information.
 */

import { TestRunnerTarget } from "../types.js";
import TestRunner from "./TestRunner";

export default class TestRunnerRenderer extends TestRunner {
    public getTarget(): TestRunnerTarget {
        return TestRunnerTarget.RENDERER;
    }
}
