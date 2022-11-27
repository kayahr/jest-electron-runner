# Jest Electron Runner

A custom test runner for Jest that runs tests inside an [electron](https://electronjs.org/) main or renderer process providing the following benefits:

- Main
  - all electron instance modules (ipc, app, etc)

- Renderer
  - full access to a browser environment without the need for jsdom or similar modules

This project is a fork of Facebook's [@jest-runner/electron](https://github.com/facebook-atom/jest-electron-runner) which seems to be no longer maintained, was archived on Github and is not working with newer Jest versions. I simplified the project, converted it from Flow to TypeScript and made it compatible to Jest 27 and newer.


## Getting Started

1. Install jest electron runner with `npm i --save-dev @kayahr/jest-electron-runner`
2. Add one of these lines to your jest config (in `package.json` or inside your `jest.config.js` file), depending on the process you wish to test. If you wish to test them in parallel, see the tips section below.

    - Main process
        ```json
        {
            "runner": "@kayahr/jest-electron-runner/main",
            "testEnvironment": "node"
        }
        ```
    - Renderer Process
        ```json
        {
            "runner": "@kayahr/jest-electron-runner",
            "testEnvironment": "@kayahr/jest-electron-runner/environment"
        }
        ```
3. Run jest.

## Configuration

jest-electron-runner can be configured through test environment options like this:

```json
{
    "runner": "@kayahr/jest-electron-runner",
    "testEnvironment": "@kayahr/jest-electron-runner/environment",
    "testEnvironmentOptions": {
        "electron": {
            "options": [
                "no-sandbox",
                "ignore-certificate-errors",
                "force-device-scale-factor=1"
            ],
            "disableHardwareAcceleration": false
        }
    }
}
```

The test environment options shown in the above example are the default options. You can override these defaults as you like. If you want to remove a value-less electron option then prepend it with an exclamation mark (i.E. `!ignore-certificate-errors`).

The electron options can be any command-line option supported by Electron. The options can also be specified with the environment variable `ELECTRON_OPTIONS`.

Example:

```sh
ELECTRON_OPTIONS="--disable-webgl --enable-unsafe-webgpu"
```

## Debugging
Normally jest-electron-runner runs a headless instance of electron when testing the renderer process. You may show the UI by adding this to your test:
```js
require('electron').remote.getCurrentWindow().show();
```

## Tips
- The main process runner can be used to test any non-browser related code, which can speed up tests roughly 2x.
- To run the main and renderer process tests in parallel, you can provide a config object to the `projects` array in the jest configuration:
    ```json
    {
        "projects": [
            {
                "runner": "@kayahr/jest-electron-runner/main",
                "testEnvironment": "node"
            },
            {
                "runner": "@kayahr/jest-electron-runner",
                "testEnvironment": "@kayahr/jest-electron-runner/environment"
            }
        ]
    }
    ```

## License

[MIT licensed](./LICENSE.md).
