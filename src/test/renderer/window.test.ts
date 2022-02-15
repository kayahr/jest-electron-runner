/*
 * Copyright (C) 2021 Klaus Reimer <k@ailis.de>
 * See LICENSE.md for licensing information.
 */

describe("Tests in renderer process", () => {
    it("have access to window object", () => {
        expect(typeof window).toBe("object");
    });
});
