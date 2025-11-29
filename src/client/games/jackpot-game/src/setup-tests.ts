// Setup file for vitest: load reflect-metadata before any tsyringe usage
import "reflect-metadata";

// jsdom's CanvasRenderingContext2D in some environments may be missing
// newer API methods like setTransform/resetTransform used by our code.
// Add lightweight no-op polyfills here to avoid test-time errors.
if (typeof window !== "undefined") {
  // If CanvasRenderingContext2D exists, ensure prototype methods exist.
  if ((window as any).CanvasRenderingContext2D) {
    const proto = (window as any).CanvasRenderingContext2D.prototype as any;
    if (typeof proto.setTransform !== "function")
      proto.setTransform = function () {};
    if (typeof proto.resetTransform !== "function")
      proto.resetTransform = function () {};
    if (typeof proto.getTransform !== "function")
      proto.getTransform = function () {
        return { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
      };
  }

  // Wrap HTMLCanvasElement.getContext to ensure returned context objects
  // have the needed methods. Some jsdom environments return minimal stubs
  // without newer methods; this wrapper polyfills them per-call.
  try {
    const proto = (window as any).HTMLCanvasElement?.prototype;
    if (proto && typeof proto.getContext === "function") {
      const origGet = proto.getContext;
      proto.getContext = function (type: string, ...args: any[]) {
        const ctx = origGet.call(this, type, ...args) as any;
        if (!ctx) {
          // Return a minimal 2D-like stub for tests when no context is available
          if (String(type) === "2d") {
            return {
              canvas: this,
              // common methods used by drawing code (no-op implementations)
              fillRect: () => {},
              clearRect: () => {},
              beginPath: () => {},
              closePath: () => {},
              moveTo: () => {},
              lineTo: () => {},
              stroke: () => {},
              fill: () => {},
              measureText: () => ({ width: 0 }),
              setTransform: () => {},
              resetTransform: () => {},
              getTransform: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }),
            };
          }
          return ctx;
        }

        if (typeof ctx.setTransform !== "function") ctx.setTransform = () => {};
        if (typeof ctx.resetTransform !== "function")
          ctx.resetTransform = () => {};
        if (typeof ctx.getTransform !== "function")
          ctx.getTransform = () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 });
        return ctx;
      };
    }
  } catch (e) {
    // ignore errors in test setup
  }
}

// Polyfill ResizeObserver for jsdom environments where it's not available.
// Tests only need it to exist and not throw; no-op implementation is sufficient.
if (typeof window !== "undefined" && (window as any).ResizeObserver == null) {
  (class {
    _callback: any;
    constructor(cb: any) {
      this._callback = cb;
    }
    observe() {
      // no-op
    }
    unobserve() {
      // no-op
    }
    disconnect() {
      // no-op
    }
  }) as any;
  // Assign a simple constructor function to avoid ReferenceError in tests
  (window as any).ResizeObserver = function (cb: any) {
    this._callback = cb;
    this.observe = function () {};
    this.unobserve = function () {};
    this.disconnect = function () {};
  };
}
