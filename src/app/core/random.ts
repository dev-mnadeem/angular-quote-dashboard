/**
 * mulberry32, the same generator the feed sidecar uses (`server/src/providers/synthetic.js`).
 * Both copies are pinned by a test asserting the first value for seed 42, so the
 * two halves of the repo cannot silently drift to different demo data.
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function next(): number {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
