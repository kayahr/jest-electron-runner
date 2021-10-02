/*
 * Copyright (C) 2021 Klaus Reimer <k@ailis.de>
 * Copyright (C) 2014-present, Facebook, Inc.
 *
 * See LICENSE.md for licensing information.
 */

// $FlowFixMe flow doesn't know about console
import 'source-map-support/register';
import { Console } from 'console';
delete (global as any).console;
global.console = new Console(process.stdout, process.stderr);
import { app, BrowserWindow } from 'electron';

import RPCConnection from '../rpc/RPCConnection';
import JestWorkerRPC from './rpc/JestWorkerRPC';

const isMain = process.env.isMain === 'true';

// for testing purposes, it is probably a good idea to keep everything at
// the same scale so that renders do not vary from device to device.
app.commandLine.appendSwitch('high-dpi-support', "1");
app.commandLine.appendSwitch('force-device-scale-factor', "1");

// disable hardware acceleration so tests are deterministic but let user
// enable it again on demand with environment variable
if (!process.env.JEST_ELECTRON_RUNNER_ENABLE_HARDWARE_ACCELERATION) {
    app.disableHardwareAcceleration();
}

app.on('ready', async () => {
    // electron automatically quits if all windows are destroyed,
    // this mainWindow will keep electron running even if all other windows
    // are gone. There's probably a better way to do it
    // eslint-disable-next-line no-unused-vars
    const mainWindow = new BrowserWindow({ show: false, webPreferences: { nativeWindowOpen: true } })
    mainWindow.hide();

    if (isMain) {
        // we spin up an electron process for each test on the main process
        // which pops up an icon for each on macOs. Hiding them is less intrusive
        app.dock && app.dock.hide();
    }

    const rpcConnection = new RPCConnection(JestWorkerRPC);
    await rpcConnection.connect();
});
