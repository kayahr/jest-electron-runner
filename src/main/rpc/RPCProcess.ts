/*
 * Copyright (C) 2021 Klaus Reimer <k@ailis.de>
 * Copyright (C) 2014-present, Facebook, Inc.
 *
 * See LICENSE.md for licensing information.
 */

import { spawn, ChildProcess } from 'child_process';
import { makeUniqServerId } from '../core/utils';
import * as path from 'path';
import ipc from "node-ipc";
import { serializeRequest, parseResponse } from './jsonrpc';
import { INITIALIZE_MESSAGE, JSONRPC_EVENT_NAME } from "./constants";

type SpawnFn = ({ serverID }: { serverID: string}) => ChildProcess;
type SpawnNode = {
    useBabel?: boolean,
    initFile: string,
};

interface RequestError {
    code: number,
    message: string,
    data?: string
}

export class RPCProcess<Methods> {
    private _ipc: InstanceType<typeof ipc.IPC>;
    private server?: InstanceType<typeof ipc.IPC>["server"];
    private serverID: string;
    private isAlive: boolean;
    private _spawn: SpawnFn;
    public remote: Methods;
    private _socket: any;
    private _pendingRequests: Record<string, { resolve: (data: unknown) => void, reject: (error: RequestError) => void }>;
    private _subprocess?: ChildProcess;

    constructor(spawn: SpawnFn | SpawnNode) {
        this.serverID = makeUniqServerId();
        this.isAlive = false;
        this._ipc = new ipc.IPC();

        this._spawn = spawn instanceof Function ? spawn : makeSpawnNodeFn(this.serverID, spawn);
        this.remote = this.initializeRemote();
        this._pendingRequests = {};
    }

    initializeRemote(): Methods {
        throw new Error('not implemented');
    }

    async start(): Promise<void> {
        this._ipc.config.id = this.serverID;
        this._ipc.config.retry = 1500;
        this._ipc.config.silent = true;

        this._subprocess = this._spawn({ serverID: this.serverID });
        const socket = await new Promise(async resolve => {
            this._ipc.serve(() => {
                this._ipc.server.on(INITIALIZE_MESSAGE, (message, socket) => {
                    this.server = this._ipc.server;
                    this.isAlive = true;
                    resolve(socket);
                });

                this._ipc.server.on(JSONRPC_EVENT_NAME, json => {
                    this.handleJsonRPCResponse(json);
                });
            });
            this._ipc.server.start();
        });

        this._socket = socket;
    }

    stop() {
        this.server?.stop()
        if (this._subprocess != null && this.isAlive && this._subprocess.pid != null) {
            try {
                // TODO Why negative
                process.kill(-this._subprocess.pid, 'SIGKILL');
                // eslint-disable-next-line no-empty
            } catch (e) {}
        }
        this._subprocess?.kill('SIGKILL');
        delete this.server;
        this.isAlive = false;
    }

    async jsonRPCCall(method: string, ...args: Array<unknown>): Promise<unknown> {
        this._ensureServerStarted();
        return new Promise((resolve, reject) => {
            const { id, json } = serializeRequest(method, [...args]);
            this.server?.emit(this._socket, JSONRPC_EVENT_NAME, json);
            this._pendingRequests[id] = {
                resolve: data => {
                    delete this._pendingRequests[id];
                    resolve(data);
                },
                reject: error => {
                    delete this._pendingRequests[id];
                    reject(new Error(`${error.code}:${error.message}\n${error.data}`));
                },
            };
        });
    }

    handleJsonRPCResponse(json: string) {
        const response = parseResponse(json);
        const { id, result, error } = response;

        if (error) {
            this._pendingRequests[id].reject(error);
        } else {
            this._pendingRequests[id].resolve(result);
        }
    }

    _ensureServerStarted() {
        if (!this.server) {
            throw new Error(`
        RPCProcess need to be started before making any RPC calls.
        e.g.:
        --------
        const rpcProcess = new MyRPCProcess(options);
        await rpcProcess.start();
        const result = rpcProcess.remote.doSomething();
      `);
        }
    }
}

const getBabelNodeBin = () =>
    path.resolve(__dirname, '../../../node_modules/.bin/babel-node');

function makeSpawnNodeFn(serverID: string, { initFile, useBabel }: SpawnNode): SpawnFn {
    return () => {
        const bin = useBabel ? getBabelNodeBin() : 'node';

        return spawn(bin, [initFile], {
            stdio: ['inherit', process.stderr, 'inherit'],
            env: {
                ...process.env,
                JEST_SERVER_ID: serverID,
            },
            detached: true,
        });
    };
};
