/**
 * RED CONTROL for PS-L5. NOT SHIPPED, NOT IMPORTED BY ANYTHING.
 *
 * The WRONG robots value, exported under the real name. PS-L5 asserts the exported VALUE by
 * importing the real module; this proves that check discriminates, which a source regex over
 * `lib/lane-gate.ts` could not — a regex passes on a comment describing the directive.
 */
export const LANE_ROBOTS = { index: false, follow: false } as const;
