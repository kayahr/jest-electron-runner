/*
 * Copyright (C) 2021 Klaus Reimer <k@ailis.de>
 * Copyright (C) 2014 Facebook, Inc. and its affiliates
 *
 * See LICENSE.md for licensing information.
 */

import { app } from "electron";

import RPCConnection from "../rpc/RPCConnection";
import { ElectronEnvironmentOptions } from "./Options";
import JestWorkerRPC from "./rpc/JestWorkerRPC";

const isMain = process.env.isMain === "true";

// Read electron environment options which are passed in from runner through an environment variable
const options = JSON.parse(process.env.JEST_ELECTRON_RUNNER_ENVIRONMENT_OPTIONS_JSON ?? "{}") as
    ElectronEnvironmentOptions;

// Configure electron according to specified options
if (options.electron?.disableHardwareAcceleration === true) {
    app.disableHardwareAcceleration();
}

// Prevent Electron from closing after last window is destroyed because new ones will be created after that.
app.on("window-all-closed", (e?: Event) => e?.preventDefault());

app.on("ready", async () => {
    // electron automatically quits if all windows are destroyed,
    // this mainWindow will keep electron running even if all other windows
    // are gone. There's probably a better way to do it

    // TODO Looks like it works without it. Maybe get rid of it for good?
    // const mainWindow = new BrowserWindow({ show: false, webPreferences: { nativeWindowOpen: true } });

    if (isMain) {
        // we spin up an electron process for each test on the main process
        // which pops up an icon for each on macOs. Hiding them is less intrusive
        app.dock?.hide();
    } else {
        (await import("@electron/remote/main")).initialize();
    }

    const rpcConnection = new RPCConnection(JestWorkerRPC);
    await rpcConnection.connect();
});
