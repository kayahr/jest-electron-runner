/*
 * Copyright (C) 2021 Klaus Reimer <k@ailis.de>
 * Copyright (C) 2014-present, Facebook, Inc.
 *
 * See LICENSE.md for licensing information.
 */

import type { TestResult } from '@jest/test-result';
import type { Config } from "@jest/types";

export type WorkerID = string;
export type ServerID = string;

import { formatExecError } from 'jest-message-util';

export const rand = () => Math.floor(Math.random() * 10000000);

export const invariant = (condition: any, message?: string) => {
    if (!condition) {
        throw new Error(message || 'Invariant violation.');
    }
};

export const makeUniqServerId = (): ServerID =>
    `jest-atom-runner-ipc-server-${Date.now() + rand()}`;

export const makeUniqWorkerId = (): WorkerID =>
    `jest-atom-runner-ipc-worker-${Date.now() + rand()}`;

export const validateIPCID = (id?: string): string => {
    if (typeof id === 'string' && id.match(/ipc/)) {
        return id;
    }
    throw new Error(`Invalid IPC id: "${JSON.stringify(id)}"`);
};

export const getIPCIDs = (): { serverID: ServerID, workerID: WorkerID } => {
    const serverID = validateIPCID(process.env.JEST_SERVER_ID);
    const workerID = validateIPCID(process.env.JEST_WORKER_ID);
    return { serverID, workerID };
};

export enum MessageType {
    INITIALIZE = 'INITIALIZE',
    DATA = 'DATA',
    RUN_TEST = 'RUN_TEST',
    TEST_RESULT = 'TEST_RESULT',
    TEST_FAILURE = 'TEST_FAILURE',
    SHUT_DOWN = 'SHUT_DOWN',
}

export const MESSAGE_TYPES = Object.keys(MessageType) as unknown as keyof typeof MessageType;

export const parseJSON = (str?: string): Object => {
    if (str == null) {
        throw new Error('String needs to be passed when parsing JSON');
    }
    let data;
    try {
        data = JSON.parse(str);
    } catch (error) {
        throw new Error(`Can't parse JSON: ${str}`);
    }

    return data;
};

export const makeMessage = ({
    messageType,
    data,
}: {
    messageType: MessageType,
    data?: string,
}) => `${messageType}-${data || ''}`;

export const parseMessage = (message: string) => {
    const messageType = Object.values(MESSAGE_TYPES).find(msgType =>
        message.startsWith(msgType),
    ) as MessageType;
    if (!messageType) {
        throw new Error(`IPC message of unknown type. Message must start from one of the following strings representing types followed by "-'.
         known types: ${JSON.stringify(MESSAGE_TYPES)}`);
    }

    return { messageType, data: message.slice(messageType.length + 1) };
};

export const buildFailureTestResult = (
    testPath: string,
    err: Error,
    config: Config.ProjectConfig,
    globalConfig: Config.GlobalConfig,
): TestResult => {
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
            updated: 0,
        },
        testExecError: { message: failureMessage, stack: err.stack },
        testFilePath: testPath,
        testResults: [],
    };
};
