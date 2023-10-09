/*
 * Copyright (C) 2023 Klaus Reimer <k@ailis.de>
 * See LICENSE.md for licensing information.
 */

describe("Tests in renderer process", () => {
    it("can compile webgl programs", () => {
        const canvas = document.createElement("canvas");
        const gl = canvas.getContext("webgl2");
        expect(gl).not.toBe(null);
        if (gl == null) {
            return;
        }

        const vertexShaderSource = `
            attribute vec4 position;
            void main() {
                gl_Position = position;
            }
        `;
        const vertexShader = gl.createShader(gl.VERTEX_SHADER);
        expect(vertexShader).not.toBe(null);
        if (vertexShader == null) {
            return;
        }
        gl.shaderSource(vertexShader, vertexShaderSource);
        gl.compileShader(vertexShader);

        const fragmentShaderSource = `
            void main() {
                gl_FragColor = vec4(1.0, 1.0, 1.0, 1.0);
            }
        `;
        const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
        expect(fragmentShader).not.toBe(null);
        if (fragmentShader == null) {
            return;
        }
        gl.shaderSource(fragmentShader, fragmentShaderSource);
        gl.compileShader(fragmentShader);

        const program = gl.createProgram();
        expect(program).not.toBe(null);
        if (program == null) {
            return;
        }
        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        gl.linkProgram(program);

        expect(gl.getProgramParameter(program, gl.LINK_STATUS)).toBe(true);
    });
});
