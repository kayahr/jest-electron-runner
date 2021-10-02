/*
 * Copyright (C) 2021 Klaus Reimer <k@ailis.de>
 * Copyright (C) 2014 Facebook, Inc. and its affiliates
 *
 * See LICENSE.md for licensing information.
 */

import { validateIPCID } from './utils';
import ipc from 'node-ipc';
import { INITIALIZE_MESSAGE, JSONRPC_EVENT_NAME } from './constants';
import {
    parseRequest,
    serializeResultResponse,
    serializeErrorResponse,
} from './jsonrpc';

export default class RPCConnection<
    Methods extends { [key: string]: (...Args: any) => Promise<any> },
    > {
    methods: Methods;
    _ipc: InstanceType<typeof ipc.IPC>;

    constructor(methods: Methods) {
        this.methods = methods;
        this._ipc = new ipc.IPC();
    }

    async connect(_serverID?: string) {
        return new Promise<void>(resolve => {
            const serverID = _serverID || validateIPCID(process.env.JEST_SERVER_ID);
            this._ipc.config.id = serverID;
            this._ipc.config.silent = true;
            this._ipc.config.retry = 1500;

            this._ipc.connectTo(serverID, () => {
                this._ipc.of[serverID].on('connect', () => {
                    this._ipc.of[serverID].emit(INITIALIZE_MESSAGE);
                });

                this._ipc.of[serverID].on(JSONRPC_EVENT_NAME, data => {
                    const { method, params, id } = parseRequest(data);
                    this.methods[method]
                        .apply(null, params)
                        .then(result => {
                            this._ipc.of[serverID].emit(
                                JSONRPC_EVENT_NAME,
                                serializeResultResponse(result, id),
                            );
                        })
                        .catch(error => {
                            this._ipc.of[serverID].emit(
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
