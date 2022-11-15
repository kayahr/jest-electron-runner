# Jest Electron Runner
A custom test runner for Jest that runs tests inside an [electron](https://electronjs.org/) main or renderer process providing the following benefits:

- Main
  - all electron instance modules (ipc, app, etc)

- Renderer
  - full access to a browser environment without the need for jsdom or similar modules

This project is a fork of Facebook's [@jest-runner/electron](https://github.com/facebook-atom/jest-electron-runner) which seems to be no longer maintained, was archived on Github and is not working with newer Jest versions. I simplified the project, converted it from Flow to TypeScript and made it compatible to Jest 27.


## Getting Started

1. Install jest electron runner `npm i --save-dev @kayahr/jest-electron-runner`
2. Add one of these lines to your jest config (in `package.json` or inside your `jest.config.js` file), depending on the process you wish to test. If you wish to test them in parallel, see the tips section below.

    - Main process
    ```js
        {
          // ...
          runner: '@kayahr/jest-electron-runner/main',
          testEnvironment: 'node',
        }
    ```
    - Renderer Process
    ```js
        {
          // ...
          runner: '@kayahr/jest-electron-runner',
          testEnvironment: '@kayahr/jest-electron-runner/environment',
        }
    ```
3. Run jest.


## Debugging
Normally jest-electron-runner runs a headless instance of electron when testing the renderer process. You may show the UI by adding this to your test:
```js
require('@electron/remote').getCurrentWindow().show();
```

## Tips
- The main process runner can be used to test any non-browser related code, which can speed up tests roughly 2x.
- To run the main and renderer process tests in parallel, you can provide a config object to the `projects` array in a jest javascript config file like so:
```js
// jest.config.js
const common = require('./jest.common.config')

module.exports = {
  projects: [
    {
      ...common,
      runner: '@kayahr/jest-electron-runner/main',
      testEnvironment: 'node',
      testMatch: ['**/__tests__/**/*.(spec|test).js']
    },
    {
      ...common,
      runner: '@kayahr/jest-electron-runner',
      testEnvironment: '@kayahr/jest-electron-runner/environment',
      testMatch: ['**/__tests__/**/*.(spec|test).tsx']
    }
  ]
}
```

## License

[MIT licensed](./LICENSE.md).
