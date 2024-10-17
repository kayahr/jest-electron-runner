/*
 * Copyright (C) 2022 Klaus Reimer <k@ailis.de>
 * See LICENSE.md for licensing information.
 */

import { parse } from "shell-quote";

/**
 * Options for the electron environment.
 */
export interface ElectronEnvironmentOptions {
    /** Options which are passed to electron. */
    electron?: {
        /**
         * List of command-line options passed to electron additionally to (and overriding) the
         * {@link defaultElectronSwitches}. Switches can be specified without value (i.E. `disable-gpu`) or with value
         * (i.E. `force-device-scale-factor=7`). You can disable default switches by preceding them with an exclamation
         * mark (i.E. `!no-sandbox`).
         *
         * The options can also be specified with the environment variable ELECTRON_OPTIONS.
         * i.E: `ELECTRON_OPTIONS="--disable-gpu --inspect=localhost:9229"`.
         *
         * Dashes in front of the options are optional, so `disable-gpu` does the same as `--disable-gpu`.
         *
         * Options specified with the environment variable override the same options defined in the jest configuration.
         *
         * @see https://www.electronjs.org/docs/latest/api/command-line-switches
         * @see https://peter.sh/experiments/chromium-command-line-switches/
         */
        options?: string[];

        /**
         * Set to true to disable hardware acceleration. Defaults to false.
         *
         * @see https://www.electronjs.org/docs/latest/api/app#appdisablehardwareacceleration
         */
        disableHardwareAcceleration?: boolean;
    };
}

/** The default electron switches. */
export const defaultElectronSwitches: Record<string, string | undefined> = {
    "no-sandbox": undefined,
    "ignore-certificate-errors": undefined,
    "force-device-scale-factor": "1"
};

/**
 * Maps the value of a specific deprecated environment variable to a new electron command line option and displays
 * a deprecation warning.
 *
 * @param envName    - The name of the environment variable.
 * @param optionName - The name of the electron command-line option.
 * @returns the electron command-line option to use or null if environment variable was not found.
 */
function getDeprecatedElectronOptionFromEnv(envName: string, optionName: string): string | null {
    const value = process.env[envName];
    if (value == null) {
        return null;
    }
    const option = `${optionName}=${value}`;
    console.warn(`Environment variable ${envName} is deprecated. Use '${option}' in the electron test environment `
        + `options or in ELECTRON_OPTIONS environment variable instead. See jest-electron-runner documentation for `
        + `details.`);
    return option;
}

/**
 * @returns electron command line options from various deprecated environment variable older versions of
 *          jest-electron-runner used.
 */
function getDeprecatedElectronOptionsFromEnv(): string[] {
    return [
        getDeprecatedElectronOptionFromEnv("JEST_ELECTRON_RUNNER_MAIN_THREAD_DEBUG_PORT", "inspect"),
        getDeprecatedElectronOptionFromEnv("JEST_ELECTRON_RUNNER_RENDERER_THREAD_DEBUG_PORT", "remote-debugging-port")
    ].filter((v: string | null): v is string => v != null);
}

/**
 * @returns electron command line options from ELECTRON_OPTIONS environment variable.
 */
function getElectronOptionsFromEnv(): string[] {
    return parse(process.env["ELECTRON_OPTIONS"] ?? "")
        .filter((s): s is string => typeof s === "string")
        .map(s => s.replace(/^-+/, ""));
}

/**
 * Creates and returns a map with electron options build from the default options and the user specified options
 * read from the given test environment options. This also imports values from the environment variable
 * ELECTRON_OPTIONS and values from deprecated environment variables which were used by older jest-electron-runner
 * versions.
 *
 * @param testEnvironmentOptions - The test environment options.
 * @returns the created map with electron command-line options.
 */
export function createElectronOptions(options: ElectronEnvironmentOptions = {}): Record<string, string | undefined> {
    const switches = { ...defaultElectronSwitches };
    const allOptions = [
        ...options.electron?.options ?? [],
        ...getElectronOptionsFromEnv(),
        ...getDeprecatedElectronOptionsFromEnv()
    ];
    for (const entry of allOptions) {
        const sep = entry.indexOf("=");
        let switchName, switchValue;
        if (sep === -1) {
            switchName = entry;
            switchValue = undefined;
        } else {
            switchName = entry.substring(0, sep);
            switchValue = entry.substring(sep + 1);
        }
        if (switchName.startsWith("!")) {
            delete switches[switchName.substring(1)];
        } else {
            switches[switchName] = switchValue;
        }
    }
    return switches;
}
