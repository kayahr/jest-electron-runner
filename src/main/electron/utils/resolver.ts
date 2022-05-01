/*
 * Copyright (C) 2021 Klaus Reimer <k@ailis.de>
 * Copyright (C) 2014 Facebook, Inc. and its affiliates
 *
 * See LICENSE.md for licensing information.
 */

import type { Config } from "@jest/types";
import HasteMap, { SerializableModuleMap } from "jest-haste-map";
import Resolver from "jest-resolve";
import Runtime from "jest-runtime";

const ATOM_BUILTIN_MODULES = new Set([ "atom", "electron" ]);

// Atom has builtin modules that can't go through jest transform/cache
// pipeline. There's no easy way to add custom modules to jest, so we'll wrap
// jest Resolver object and make it bypass atom's modules.
const wrapResolver = (resolver: Resolver): Resolver => {
    const isCoreModule = resolver.isCoreModule;
    const resolveModule = resolver.resolveModule;

    resolver.isCoreModule = moduleName => {
        if (ATOM_BUILTIN_MODULES.has(moduleName)) {
            return true;
        } else {
            return isCoreModule.call(resolver, moduleName);
        }
    };

    resolver.resolveModule = (from, to, options) => {
        if (ATOM_BUILTIN_MODULES.has(to)) {
            return to;
        } else {
            return resolveModule.call(resolver, from, to, options);
        }
    };

    return resolver;
};

const resolvers = new WeakMap<Config.ProjectConfig, Resolver>();
export async function getResolver(config: Config.ProjectConfig, serializableModuleMap: SerializableModuleMap):
        Promise<Resolver> {
    // In watch mode, the raw module map with all haste modules is passed from
    // the test runner to the watch command. This is because jest-haste-map's
    // watch mode does not persist the haste map on disk after every file change.
    // To make this fast and consistent, we pass it from the TestRunner.
    if (serializableModuleMap != null) {
        const moduleMap = HasteMap.getModuleMapFromJSON(serializableModuleMap);
        return wrapResolver(
            Runtime.createResolver(config, moduleMap)
        );
    } else {
        let resolver = resolvers.get(config);
        if (resolver == null) {
            resolver = wrapResolver(
                Runtime.createResolver(
                    config,
                    (await Runtime.createHasteMap(config)).readModuleMap(),
                ),
            );
            resolvers.set(config, resolver);
        }
        return resolver;
    }
}
