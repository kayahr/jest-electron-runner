/*
 * Copyright (C) 2021 Klaus Reimer <k@ailis.de>
 * See LICENSE.md for licensing information.
 */

import { Server } from "node:http";
import { resolve } from "node:path";

import express from "express";

export interface TestServer {
    baseUrl: string;
    close: () => void;
}

const webRoot =  resolve(__dirname, "../../../src/test/data");

async function listen(port: number): Promise<Server> {
    return new Promise<Server>((resolve, reject) => {
        const app = express();
        app.use(express.static(webRoot));
        const server = app.listen(port, () => {
            resolve(server);
        }).on("error", reject);
    });
}

export async function startServer(): Promise<TestServer> {
    let retries = 5;
    while (true) {
        const port = 1024 + Math.floor(Math.random() * 64511);
        try {
            const server = await listen(port);
            return {
                baseUrl: `http://localhost:${port}/`,
                close: (): void => { server.close(); }
            };
        } catch (e) {
            if (retries > 0) {
                retries--;
            } else {
                throw e;
            }
        }
    }
}
