import kayahrConfigs from "@kayahr/eslint-config";
import globals from "globals";

export default [
    {
        ignores: [
            "lib"
        ]
    },
    {
        languageOptions: {
            globals: {
                ...globals.browser,
                ...globals.node
            }
        }
    },
    ...kayahrConfigs
];
