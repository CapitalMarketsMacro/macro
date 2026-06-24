/**
 * US Treasury (and other fixed-income) price formatting in fractional ticks.
 *
 * Ported from the macro-react app's `treasury-utils.formatTreasury32nd` (kept as the
 * regression baseline) and generalised to 32nds **or** 64ths with an optional half-tick
 * `+`. A decimal price like `99.515625` renders as `99-16+` (99 and 16.5/32).
 */

export interface TreasuryFormatOptions {
  /** Tick denominator: `32` (default) for 32nds, `64` for 64ths. */
  fraction?: 32 | 64;
  /** Render the half-tick `+` when the residual is ≥ 0.4 of a tick. Default `true`. */
  plusTick?: boolean;
}

/**
 * Format a decimal price as a fractional-tick string.
 *
 * 32nds: `99.50 -> "99-16"`, `99.515625 -> "99-16+"`.
 * 64ths (`fraction: 64`): ticks are 64ths, `99.765625 (== 49/64) -> "99-49"`.
 *
 * Matches the original `formatTreasury32nd` for the 32nds + `+` path (0.4 threshold).
 */
export function formatTreasury(decimalPrice: number, options: TreasuryFormatOptions = {}): string {
  const { fraction = 32, plusTick = true } = options;
  if (decimalPrice == null || typeof decimalPrice !== 'number' || isNaN(decimalPrice)) {
    return '';
  }

  const handle = Math.floor(decimalPrice);
  const fractionalPart = decimalPrice - handle;

  // Whole ticks + residual fraction of a tick.
  const totalTicks = fractionalPart * fraction;
  const ticks = Math.floor(totalTicks);
  const residual = totalTicks - ticks;

  // 32nds pad to 2 digits; 64ths pad to 2 digits as well (e.g. "49" sixty-fourths).
  const padWidth = 2;
  const ticksStr = ticks.toString().padStart(padWidth, '0');

  // Half-tick '+' suffix when residual rounds to a half (>= 0.4, matching the
  // original app behaviour).
  const suffix = plusTick && residual >= 0.4 ? '+' : '';

  return `${handle}-${ticksStr}${suffix}`;
}
