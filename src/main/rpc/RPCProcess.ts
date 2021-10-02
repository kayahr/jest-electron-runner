/*
 * Copyright (C) 2021 Klaus Reimer <k@ailis.de>
 * Copyright (C) 2014 Facebook, Inc. and its affiliates
 *
 * See LICENSE.md for licensing information.
 */

import { ChildProcess, spawn } from "child_process";
import { Socket } from "net";
import ipc from "node-ipc";
import * as path from "path";

import { makeUniqServerId } from "../core/utils";
import { INITIALIZE_MESSAGE, JSONRPC_EVENT_NAME } from "./constants";
import { parseResponse, serializeRequest } from "./jsonrpc";

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
    private readonly ipc: InstanceType<typeof ipc.IPC>;
    private server?: InstanceType<typeof ipc.IPC>["server"];
    private readonly serverID: string;
    private isAlive: boolean;
    private readonly spawnFn: SpawnFn;
    public remote: Methods;
    private socket: Socket | null = null;
    private pendingRequests: Record<string, {
        resolve: (data: unknown) => void, reject: (error: RequestError) => void }>;
    private subProcess?: ChildProcess;

    public constructor(spawn: SpawnFn | SpawnNode) {
        this.serverID = makeUniqServerId();
        this.isAlive = false;
        this.ipc = new ipc.IPC();

        this.spawnFn = spawn instanceof Function ? spawn : makeSpawnNodeFn(this.serverID, spawn);
        this.remote = this.initializeRemote();
        this.pendingRequests = {};
    }

    public initializeRemote(): Methods {
        throw new Error("not implemented");
    }

    public async start(): Promise<void> {
        this.ipc.config.id = this.serverID;
        this.ipc.config.retry = 1500;
        this.ipc.config.silent = true;

        this.subProcess = this.spawnFn({ serverID: this.serverID });
        const socket = await new Promise<Socket>(resolve => {
            this.ipc.serve(() => {
                this.ipc.server.on(INITIALIZE_MESSAGE, (message: string, socket: Socket) => {
                    this.server = this.ipc.server;
                    this.isAlive = true;
                    resolve(socket);
                });

                this.ipc.server.on(JSONRPC_EVENT_NAME, json => {
                    this.handleJsonRPCResponse(json);
                });
            });
            this.ipc.server.start();
        });

        this.socket = socket;
    }

    public stop(): void {
        this.server?.stop();
        if (this.subProcess != null && this.isAlive && this.subProcess.pid != null) {
            try {
                // TODO Why negative
                process.kill(-this.subProcess.pid, "SIGKILL");
                // eslint-disable-next-line no-empty
            } catch (e) {}
        }
        this.subProcess?.kill("SIGKILL");
        delete this.server;
        this.isAlive = false;
    }

    public async jsonRPCCall(method: string, ...args: unknown[]): Promise<unknown> {
        this.ensureServerStarted();
        return new Promise((resolve, reject) => {
            const { id, json } = serializeRequest(method, [ ...args ]);
            if (this.socket != null) {
                this.server?.emit(this.socket, JSONRPC_EVENT_NAME, json);
            }
            this.pendingRequests[id] = {
                resolve: data => {
                    delete this.pendingRequests[id];
                    resolve(data);
                },
                reject: error => {
                    delete this.pendingRequests[id];
                    reject(new Error(`${error.code}:${error.message}\n${error.data}`));
                }
            };
        });
    }

    public handleJsonRPCResponse(json: string): void {
        const response = parseResponse(json);
        const { id, result, error } = response;

        if (error != null) {
            this.pendingRequests[id].reject(error);
        } else {
            this.pendingRequests[id].resolve(result);
        }
    }

    private ensureServerStarted(): void {
        if (this.server == null) {
            throw new Error("RPCProcess need to be started before making any RPC calls");
        }
    }
}

const getBabelNodeBin = (): string =>
    path.resolve(__dirname, "../../../node_modules/.bin/babel-node");

function makeSpawnNodeFn(serverID: string, { initFile, useBabel }: SpawnNode): SpawnFn {
    return () => {
        const bin = useBabel === true ? getBabelNodeBin() : "node";

        return spawn(bin, [ initFile ], {
            stdio: [ "inherit", process.stderr, "inherit" ],
            env: {
                ...process.env,
                JEST_SERVER_ID: serverID
            },
            detached: true
        });
    };
}
