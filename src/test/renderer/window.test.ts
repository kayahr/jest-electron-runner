/*
 * Copyright (C) 2021 Klaus Reimer <k@ailis.de>
 * See LICENSE.md for licensing information.
 */

describe("Tests in renderer process", () => {
    it("have access to window object", () => {
        expect(typeof window).toBe("object");
    });
    it("can not be closed", () => {
        // This will freeze Jest when test fails, even the test timeout doesn't trigger.
        window.close();
    });
    it("can not access garbage collector (because not enabled in this test environment)", () => {
        expect(typeof gc).toBe("undefined");
    });
    it("Sees device pixel ratio as configured in tet environment options", () => {
        expect(window.devicePixelRatio).toBe(7);
    });
    it("can use remote module", async () => {
        const currentWindow = (await import("@electron/remote")).getCurrentWindow();
        expect(currentWindow).toHaveProperty("show");
    });
});
