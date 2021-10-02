/*
 * Copyright (C) 2021 Klaus Reimer <k@ailis.de>
 * Copyright (C) 2014 Facebook, Inc. and its affiliates
 *
 * See LICENSE.md for licensing information.
 */

import type { Config } from "@jest/types";
import { SerializableModuleMap } from "jest-haste-map";

export type IPCTestData = {
  serializableModuleMap: SerializableModuleMap,
  config: Config.ProjectConfig,
  globalConfig: Config.GlobalConfig,
  path: string,
};

export enum TestRunnerTarget {
    RENDERER = "renderer",
    MAIN = "main"
}
