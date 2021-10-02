/*
 * Copyright (C) 2021 Klaus Reimer <k@ailis.de>
 * Copyright (C) 2014-present, Facebook, Inc.
 *
 * See LICENSE.md for licensing information.
 */

export type ServerID = string;
export const rand = () => Math.floor(Math.random() * 10000000);

export const validateIPCID = (id?: string): string => {
    if (typeof id === 'string' && id.match(/ipc/)) {
        return id;
    }
    throw new Error(`Invalid IPC id: "${JSON.stringify(id)}"`);
};

export const makeUniqServerId = (): ServerID =>
    `ipc-server-${Date.now() + rand()}`;
