import { z } from 'zod';

/**
 * Reads and validates environment variables.
 *
 * Uses Zod to provide clear runtime errors in Vercel Functions.
 */
export function getEnv() {
  const schema = z.object({
    OPENAI_API_KEY: z.string().min(1),
    OPENAI_MODEL: z.string().min(1).optional().default('gpt-4o-mini'),
    OPENAI_FAST_MODEL: z.string().min(1).optional().default('gpt-4o-mini'),

    DATABASE_URL: z.string().min(1),

    REVENUECAT_MCP_URL: z
      .string()
      .min(1)
      .optional()
      .default('https://mcp.revenuecat.ai/mcp'),
    REVENUECAT_API_V2_SECRET_KEY: z.string().min(1),

    TELEGRAM_BOT_TOKEN: z.string().min(1),
    TELEGRAM_CHAT_ID: z.string().min(1),

    GUARDRAILS_ENABLED: z
      .string()
      .optional()
      .transform((v) => (v ?? 'true').toLowerCase() === 'true'),
    TOKEN_ESCALATION_ENABLED: z
      .string()
      .optional()
      .transform((v) => (v ?? 'true').toLowerCase() === 'true'),

    TOKEN_SIGNING_SECRET: z.string().min(16),
    UPGRADE_TOKEN_TTL_MINUTES: z
      .string()
      .optional()
      .transform((v) => Number(v ?? '30')),

    /**
     * Quotas: when exceeded, an upgrade token is required.
     *
     * These are GLOBAL per deployment day (UTC) by default.
     */
    FREE_RUNS_PER_DAY_TOTAL: z
      .string()
      .optional()
      .transform((v) => Number(v ?? '0')),
    FREE_RUNS_PER_DAY_INTERVIEW: z
      .string()
      .optional()
      .transform((v) => Number(v ?? '0')),
    FREE_RUNS_PER_DAY_EXECUTION: z
      .string()
      .optional()
      .transform((v) => Number(v ?? '0')),

    RATE_LIMIT_PER_IP_PER_MINUTE: z
      .string()
      .optional()
      .transform((v) => Number(v ?? '0')),

    INIT_SECRET: z.string().min(16),
    CRON_SECRET: z.string().min(16),

    // --- Social Media Integrations (all optional) ---

    // Twitter/X API (OAuth 1.0a for posting, Bearer for reading)
    TWITTER_API_KEY: z.string().min(1).optional(),
    TWITTER_API_SECRET: z.string().min(1).optional(),
    TWITTER_ACCESS_TOKEN: z.string().min(1).optional(),
    TWITTER_ACCESS_TOKEN_SECRET: z.string().min(1).optional(),
    TWITTER_BEARER_TOKEN: z.string().min(1).optional(),

    // GitHub API
    GITHUB_TOKEN: z.string().min(1).optional(),
    GITHUB_USERNAME: z.string().min(1).optional().default('revvy-agent'),
    GITHUB_DEFAULT_REPO: z.string().min(1).optional(),

    // Slack
    SLACK_WEBHOOK_URL: z.string().url().optional(),
    SLACK_BOT_TOKEN: z.string().min(1).optional(),
    SLACK_DEFAULT_CHANNEL: z.string().min(1).optional().default('#revvy-updates'),
    SLACK_FEEDBACK_CHANNEL: z.string().min(1).optional().default('#product-feedback'),
  });

  return schema.parse(process.env);
}
