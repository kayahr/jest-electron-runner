/*
 * Copyright (C) 2021 Klaus Reimer <k@ailis.de>
 * See LICENSE.md for licensing information.
 */

export async function loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        function cleanup(): void {
            img.removeEventListener("load", onLoad);
            img.removeEventListener("error", onError);
        }
        function onError(): void {
            cleanup();
            reject(new Error("Unable to load image: " + src));
        }
        function onLoad(): void {
            cleanup();
            resolve(img);
        }
        img.addEventListener("load", onLoad);
        img.addEventListener("error", onError);
        img.src = src;
    });
}
