/*
 * Copyright (C) 2021 Klaus Reimer <k@ailis.de>
 * See LICENSE.md for licensing information.
 */

import express from "express";
import * as http from "http";
import * as path from "path";

export type Server = {
    baseUrl: string;
    close: () => void;
};

async function listen(port: number): Promise<http.Server> {
    return new Promise<http.Server>((resolve, reject) => {
        const app = express();
        app.use(express.static(path.resolve(__dirname, "..", "..", "..", "src", "test", "data")));
        const server = app.listen(port, () => {
            resolve(server);
        }).on("error", reject);
    });
}

export async function startServer(): Promise<Server> {
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
