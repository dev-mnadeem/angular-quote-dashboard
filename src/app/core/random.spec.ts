import { mulberry32 } from './random';

describe('mulberry32', () => {
  /**
   * Pinned so the browser generator and `server/src/providers/synthetic.js`
   * cannot drift apart: the sidecar's suite asserts the same constant.
   */
  it('produces a known first value for seed 42', () => {
    expect(mulberry32(42)()).toBeCloseTo(0.6011037519201636, 12);
  });

  it('is reproducible for a given seed', () => {
    const a = mulberry32(7);
    const b = mulberry32(7);
    for (let i = 0; i < 100; i += 1) expect(a()).toBe(b());
  });

  it('stays inside [0, 1)', () => {
    const rand = mulberry32(3);
    for (let i = 0; i < 1000; i += 1) {
      const v = rand();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('gives different streams for different seeds', () => {
    expect(mulberry32(1)()).not.toBe(mulberry32(2)());
  });
});
