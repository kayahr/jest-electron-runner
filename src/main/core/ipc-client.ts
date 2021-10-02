/*
 * Copyright (C) 2021 Klaus Reimer <k@ailis.de>
 * Copyright (C) 2014-present, Facebook, Inc.
 *
 * See LICENSE.md for licensing information.
 */

import { MessageType, ServerID, WorkerID, makeMessage } from './utils';

export type IPCWorker = {
    onMessage(cb: (message: string) => void): void,
    send(message: string): void,
    disconnect(): void,
};

import * as ipc from 'node-ipc';

let connected = false;
export const connectToIPCServer = ({
    serverID,
    workerID,
}: {
    serverID: ServerID,
    workerID: WorkerID,
}): Promise<IPCWorker> => {
    if (connected) {
        throw new Error(
            "can't connect to IPC server more than once from one worker",
        );
    }
    connected = true;

    ipc.config.id = serverID;
    ipc.config.silent = true;
    ipc.config.retry = 1500;

    return new Promise(resolve => {
        const onMessageCallbacks: Array<(msg: string) => void> = [];
        ipc.connectTo(serverID, () => {
            ipc.of[serverID].on('connect', () => {
                const initMessage = makeMessage({
                    messageType: MessageType.INITIALIZE,
                });
                ipc.of[serverID].emit(workerID, initMessage);
            });

            ipc.of[serverID].on(workerID, data => {
                onMessageCallbacks.forEach(cb => cb(data));
            });

            resolve({
                send: message => ipc.of[serverID].emit(workerID, message),
                onMessage: fn => {
                    onMessageCallbacks.push(fn);
                },
                disconnect: () => ipc.disconnect(workerID),
            });
        });
    });
};
