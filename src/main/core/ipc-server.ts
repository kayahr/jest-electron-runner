/*
 * Copyright (C) 2021 Klaus Reimer <k@ailis.de>
 * Copyright (C) 2014 Facebook, Inc. and its affiliates
 *
 * See LICENSE.md for licensing information.
 */

import * as ipc from "node-ipc";

import type { ServerID } from "./utils";

export type IPCServer = InstanceType<typeof ipc.IPC>["server"];

let started = false;

export const startServer = ({
    serverID
}: {
    serverID: ServerID,
}): Promise<IPCServer> => {
    if (started) {
        throw new Error("IPC server can only be started once");
    }
    return new Promise(resolve => {
        started = true;
        ipc.config.id = serverID;
        ipc.config.retry = 1500;
        ipc.config.silent = true;

        ipc.serve(() => {
            resolve(ipc.server);
        });

        ipc.server.start();
    });
};
