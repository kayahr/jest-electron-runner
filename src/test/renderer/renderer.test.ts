describe("Tests in renderer process", () => {
    it("have access window object", () => {
        expect(typeof window).toBe("object");
    });
});
