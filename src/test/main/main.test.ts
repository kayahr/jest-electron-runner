describe("Tests in main process", () => {
    it("have no access to window object", () => {
        expect(typeof window).toBe("undefined");
    });
    it("can access garbage collector (because enabled in this test environment)", () => {
        expect(typeof gc).toBe("function");
    });
});
