import '@testing-library/jest-dom/vitest';

if (!globalThis.URL.createObjectURL) {
  globalThis.URL.createObjectURL = () => 'blob:test';
}
if (!globalThis.URL.revokeObjectURL) {
  globalThis.URL.revokeObjectURL = () => undefined;
}

if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = class ResizeObserver {
    public observe(): void {}
    public unobserve(): void {}
    public disconnect(): void {}
  } as unknown as typeof ResizeObserver;
}
