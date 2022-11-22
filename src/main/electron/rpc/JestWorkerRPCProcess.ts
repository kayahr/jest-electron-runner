/*
 * Copyright (C) 2021 Klaus Reimer <k@ailis.de>
 * Copyright (C) 2014 Facebook, Inc. and its affiliates
 *
 * See LICENSE.md for licensing information.
 */

import type { TestResult } from "@jest/test-result";

import { RPCProcess } from "../../rpc/RPCProcess";
import { IPCTestData } from "../../types";

export interface Methods {
    runTest(data: IPCTestData): Promise<TestResult>;
    shutDown(): void;
}

export class JestWorkerRPCProcess extends RPCProcess<Methods> {
    public override initializeRemote(): Methods {
        return {
            runTest: this.jsonRPCCall.bind(this, "runTest") as (data: IPCTestData) => Promise<TestResult>,
            shutDown: this.jsonRPCCall.bind(this, "shutDown")
        };
    }
}
