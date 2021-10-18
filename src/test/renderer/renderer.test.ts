/*
 * Copyright (C) 2021 Klaus Reimer <k@ailis.de>
 * See LICENSE.md for licensing information.
 */

import { loadImage } from "../util/loadImage";
import { resolveURI } from "../util/resolveURI";
import { startServer } from "../util/startServer";

describe("Tests in renderer process", () => {
    it("have access window object", () => {
        expect(typeof window).toBe("object");
    });
    it("can load images from a data URL", async () => {
        const image = await loadImage("data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==");
        expect(image.width).toBe(1);
        expect(image.height).toBe(1);
    });
    it("can load images from a file", async () => {
        const image = await loadImage(resolveURI("test.png"));
        expect(image.width).toBe(640);
        expect(image.height).toBe(487);
    });
    it("can load images from localhost", async () => {
        const server = await startServer();
        try {
            const image = await loadImage(server.baseUrl + "test.png");
            expect(image.width).toBe(640);
            expect(image.height).toBe(487);
        } finally {
            server.close();
        }
    });
    it("can load images from an object URL", async () => {
        const blob = await (await fetch(resolveURI("test.png"))).blob();
        const image = await loadImage(URL.createObjectURL(blob));
        expect(image.width).toBe(640);
        expect(image.height).toBe(487);
    });
});
