describe("Tests in renderer process", () => {
    it("can use modern fake timers", () => {
        jest.useFakeTimers();
        try {
            const fn = jest.fn();
            setTimeout(fn, 1000);
            jest.advanceTimersByTime(999);
            expect(fn).not.toHaveBeenCalled();
            jest.advanceTimersByTime(1);
            expect(fn).toHaveBeenCalled();
        } finally {
            jest.useRealTimers();
        }
    });
    it("can use legacy fake timers", () => {
        jest.useFakeTimers({ legacyFakeTimers: true });
        try {
            const fn = jest.fn();
            setTimeout(fn, 1000);
            jest.advanceTimersByTime(999);
            expect(fn).not.toHaveBeenCalled();
            jest.advanceTimersByTime(1);
            expect(fn).toHaveBeenCalled();
        } finally {
            jest.useRealTimers();
        }
    });
});
