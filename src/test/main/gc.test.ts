describe("Tests in main process", () => {
    it("can access garbage collector (because enabled in this test environment)", () => {
        expect(typeof gc).toBe("function");
    });
});
