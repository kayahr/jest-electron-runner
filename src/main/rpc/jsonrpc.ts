/*
 * Copyright (C) 2021 Klaus Reimer <k@ailis.de>
 * Copyright (C) 2014 Facebook, Inc. and its affiliates
 *
 * See LICENSE.md for licensing information.
 */

import { v4 } from "uuid";

export interface Request {
    jsonrpc: string;
    method: string;
    params: unknown[];
    id: string;
}

export interface SerializedRequest {
    id: string;
    json: string;
}

function makeRequest(method: string, params: unknown[]): Request {
    return {
        jsonrpc: "2.0",
        method,
        params,
        id: v4()
    };
}

export function serializeRequest(method: string, params: unknown[]): SerializedRequest {
    const request = makeRequest(method, params);
    return {
        id: request.id,
        json: JSON.stringify(request)
    };
}

export function parseRequest(json: string): Request {
    return JSON.parse(json) as Request;
}

export interface ResponseError {
    code: number;
    message: string;
    data?: string;
}

export interface Response {
    jsonrpc: string,
    id: string;
    result?: unknown;
    error?: ResponseError;
}

export function serializeResultResponse(result: unknown, id: string): string {
    const response: Response = {
        jsonrpc: "2.0",
        result,
        id
    };
    return JSON.stringify(response);
}

export function serializeErrorResponse(error: unknown, id: string): string {
    const response: Response = {
        jsonrpc: "2.0",
        error: makeError(error),
        id
    };
    return JSON.stringify(response);
}

export function parseResponse(json: string): Response {
    return JSON.parse(json) as Response;
}

function makeError(error: unknown, code: number = 1): ResponseError {
    if (error instanceof Error) {
        return {
            code,
            message: error.message,
            data: error.stack
        };
    }
    return {
        code,
        message: JSON.stringify(error)
    };
}
