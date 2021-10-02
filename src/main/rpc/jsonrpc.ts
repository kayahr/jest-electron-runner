/*
 * Copyright (C) 2021 Klaus Reimer <k@ailis.de>
 * Copyright (C) 2014 Facebook, Inc. and its affiliates
 *
 * See LICENSE.md for licensing information.
 */

import * as uuid from 'uuid';

export const makeRequest = (method: string, params: any) => {
  return {
    jsonrpc: '2.0',
    method,
    params,
    id: uuid.v4(),
  };
};

export const serializeRequest = (method: string, params: any) => {
  const request = makeRequest(method, params);
  return {id: request.id, json: JSON.stringify(request)};
};

export const parseRequest = (json: string) => {
  const obj = JSON.parse(json);
  return obj;
};

export const serializeResultResponse = (result: any, id: string) => {
  const response = {
    jsonrpc: '2.0',
    result,
    id,
  };

  return JSON.stringify(response);
};

export const serializeErrorResponse = (error: any, id: string) => {
  const response = {
    jsonrpc: '2.0',
    error: makeError(error),
    id,
  };

  return JSON.stringify(response);
};

export const parseResponse = (json: string) => {
  const obj = JSON.parse(json);
  return obj;
};

const makeError = (error: any, code: number = 1) => {
  if (error instanceof Error) {
    return {
      code,
      message: error.message,
      data: error.stack,
    };
  }

  return {
    code,
    mesasge: JSON.stringify(error),
  };
};
