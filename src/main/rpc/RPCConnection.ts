/*
 * Copyright (C) 2021 Klaus Reimer <k@ailis.de>
 * Copyright (C) 2014 Facebook, Inc. and its affiliates
 *
 * See LICENSE.md for licensing information.
 */

import ipc from "node-ipc";

import { validateIPCID } from "../core/utils";
import { INITIALIZE_MESSAGE, JSONRPC_EVENT_NAME } from "./constants";
import { parseRequest, serializeErrorResponse, serializeResultResponse } from "./jsonrpc";

export default class RPCConnection<Methods extends { [key: string]: (...args: any[]) => Promise<unknown> }> {
    private readonly methods: Methods;
    private readonly ipc: InstanceType<typeof ipc.IPC>;

    public constructor(methods: Methods) {
        this.methods = methods;
        this.ipc = new ipc.IPC();
    }

    public async connect(serverId?: string): Promise<void> {
        return new Promise(resolve => {
            const serverID = serverId ?? validateIPCID(process.env.JEST_SERVER_ID);
            this.ipc.config.id = serverID;
            this.ipc.config.silent = true;
            this.ipc.config.retry = 1500;

            this.ipc.connectTo(serverID, () => {
                this.ipc.of[serverID].on("connect", () => {
                    this.ipc.of[serverID].emit(INITIALIZE_MESSAGE);
                });

                this.ipc.of[serverID].on(JSONRPC_EVENT_NAME, (data: string) => {
                    const { method, params, id } = parseRequest(data);
                    this.methods[method]
                        .apply(null, params)
                        .then(result => {
                            this.ipc.of[serverID].emit(
                                JSONRPC_EVENT_NAME,
                                serializeResultResponse(result, id),
                            );
                        })
                        .catch(error => {
                            this.ipc.of[serverID].emit(
                                JSONRPC_EVENT_NAME,
                                serializeErrorResponse(error, id),
                            );
                        });
                });

                resolve();
            });
        });
    }
}
