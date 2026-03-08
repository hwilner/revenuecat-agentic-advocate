import { sql } from './db';
import { getEnv } from './env';

function utcDayKey(d = new Date()): string {
  // YYYY-MM-DD in UTC.
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Increments a named counter for today (UTC) and returns the new value.
 */
export async function bumpDailyCounter(counterKey: string, delta = 1): Promise<number> {
  const day = utcDayKey();

  const rows = await sql()<
    {
      counter_value: number;
    }[]
  >`
    insert into usage_counters (day, counter_key, counter_value)
    values (${day}, ${counterKey}, ${delta})
    on conflict (day, counter_key)
    do update set counter_value = usage_counters.counter_value + ${delta}
    returning counter_value
  `;

  return rows[0]?.counter_value ?? delta;
}

/**
 * Checks quota limits based on env vars.
 *
 * Limits of 0 mean "disabled".
 */
export function quotaLimitForMode(mode: 'interview' | 'execution'): {
  total: number;
  perMode: number;
} {
  const env = getEnv();
  return {
    total: env.FREE_RUNS_PER_DAY_TOTAL,
    perMode: mode === 'interview' ? env.FREE_RUNS_PER_DAY_INTERVIEW : env.FREE_RUNS_PER_DAY_EXECUTION,
  };
}

/**
 * Returns true if this request should require an upgrade token due to quota.
 *
 * Note: this function also increments counters (so it should be called once per request).
 */
export async function requiresUpgradeDueToQuota(mode: 'interview' | 'execution'): Promise<{
  requiresUpgrade: boolean;
  reason: string;
  counters: { totalToday: number; modeToday: number };
}> {
  const { total, perMode } = quotaLimitForMode(mode);

  // Disabled if both limits are 0.
  if (total <= 0 && perMode <= 0) {
    return {
      requiresUpgrade: false,
      reason: 'Quota disabled.',
      counters: { totalToday: 0, modeToday: 0 },
    };
  }

  // Always bump counters when quota is enabled.
  const totalToday = await bumpDailyCounter('runs_total', 1);
  const modeToday = await bumpDailyCounter(`runs_${mode}`, 1);

  const totalExceeded = total > 0 && totalToday > total;
  const modeExceeded = perMode > 0 && modeToday > perMode;

  if (totalExceeded || modeExceeded) {
    const parts: string[] = [];
    if (totalExceeded) parts.push(`FREE_RUNS_PER_DAY_TOTAL exceeded (${totalToday}/${total}).`);
    if (modeExceeded) parts.push(`FREE_RUNS_PER_DAY_${mode.toUpperCase()} exceeded (${modeToday}/${perMode}).`);

    return {
      requiresUpgrade: true,
      reason: `Quota exceeded: ${parts.join(' ')}`,
      counters: { totalToday, modeToday },
    };
  }

  return {
    requiresUpgrade: false,
    reason: 'Quota ok.',
    counters: { totalToday, modeToday },
  };
}
