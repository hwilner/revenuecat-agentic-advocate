/**
 * Slack integration for Revvy.
 *
 * Uses Slack Incoming Webhooks for:
 * - Sending weekly check-in reports
 * - Delivering product feedback
 * - Sharing content publishing notifications
 * - Alerting on KPI milestones
 *
 * Also supports Slack Web API (if bot token provided) for:
 * - Posting to specific channels
 * - Reading channel messages
 * - Reacting to messages
 *
 * All operations are gated behind environment variable availability.
 */

import { sql } from './db';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type SlackResult = {
  ok: boolean;
  ts?: string; // Slack message timestamp (acts as message ID)
  channel?: string;
  error?: string;
};

export type SlackBlock = {
  type: string;
  text?: { type: string; text: string; emoji?: boolean };
  elements?: any[];
  fields?: any[];
  accessory?: any;
};

/* ------------------------------------------------------------------ */
/*  Config                                                             */
/* ------------------------------------------------------------------ */

function getSlackConfig() {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  const botToken = process.env.SLACK_BOT_TOKEN;
  const defaultChannel = process.env.SLACK_DEFAULT_CHANNEL ?? '#revvy-updates';
  const feedbackChannel = process.env.SLACK_FEEDBACK_CHANNEL ?? '#product-feedback';

  return {
    webhookUrl: webhookUrl ?? '',
    botToken: botToken ?? '',
    defaultChannel,
    feedbackChannel,
    webhookConfigured: !!webhookUrl,
    botConfigured: !!botToken,
    configured: !!(webhookUrl || botToken),
  };
}

export function isSlackConfigured(): boolean {
  return getSlackConfig().configured;
}

/* ------------------------------------------------------------------ */
/*  Webhook Operations (simplest integration)                          */
/* ------------------------------------------------------------------ */

/**
 * Send a message via Slack Incoming Webhook.
 * This is the simplest integration — just needs a webhook URL.
 */
export async function sendWebhookMessage(args: {
  text: string;
  blocks?: SlackBlock[];
  channel?: string;
  username?: string;
  iconEmoji?: string;
}): Promise<SlackResult> {
  const config = getSlackConfig();
  if (!config.webhookConfigured) {
    return { ok: false, error: 'Slack webhook URL not configured. Set SLACK_WEBHOOK_URL environment variable.' };
  }

  try {
    const payload: Record<string, unknown> = {
      text: args.text,
      username: args.username ?? 'Revvy',
      icon_emoji: args.iconEmoji ?? ':robot_face:',
    };
    if (args.blocks) payload.blocks = args.blocks;
    if (args.channel) payload.channel = args.channel;

    const res = await fetch(config.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text();
      return { ok: false, error: `Slack webhook error (${res.status}): ${text}` };
    }

    await logSlackAction('webhook_message', args.channel ?? config.defaultChannel, args.text);
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: `Slack webhook failed: ${e.message}` };
  }
}

/* ------------------------------------------------------------------ */
/*  Bot API Operations (richer integration)                            */
/* ------------------------------------------------------------------ */

/**
 * Post a message to a Slack channel using the Bot API.
 */
export async function postMessage(args: {
  channel: string;
  text: string;
  blocks?: SlackBlock[];
  threadTs?: string;
}): Promise<SlackResult> {
  const config = getSlackConfig();
  if (!config.botConfigured) {
    // Fall back to webhook if available
    if (config.webhookConfigured) {
      return sendWebhookMessage({ text: args.text, blocks: args.blocks, channel: args.channel });
    }
    return { ok: false, error: 'Slack bot token not configured. Set SLACK_BOT_TOKEN environment variable.' };
  }

  try {
    const payload: Record<string, unknown> = {
      channel: args.channel,
      text: args.text,
    };
    if (args.blocks) payload.blocks = args.blocks;
    if (args.threadTs) payload.thread_ts = args.threadTs;

    const res = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.botToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!data.ok) {
      return { ok: false, error: `Slack API error: ${data.error}` };
    }

    await logSlackAction('post_message', args.channel, args.text);
    return { ok: true, ts: data.ts, channel: data.channel };
  } catch (e: any) {
    return { ok: false, error: `Slack API failed: ${e.message}` };
  }
}

/* ------------------------------------------------------------------ */
/*  Structured Reports                                                 */
/* ------------------------------------------------------------------ */

/**
 * Send a weekly check-in report to Slack.
 */
export async function sendWeeklyReport(args: {
  weekOf: string;
  contentPublished: number;
  contentTarget: number;
  socialInteractions: number;
  socialTarget: number;
  feedbackSubmitted: number;
  feedbackTarget: number;
  growthExperiments: number;
  highlights: string[];
  learnings: string[];
  nextWeekPlan: string[];
}): Promise<SlackResult> {
  const statusEmoji = (actual: number, target: number) =>
    actual >= target ? ':white_check_mark:' : actual >= target * 0.5 ? ':warning:' : ':x:';

  const blocks: SlackBlock[] = [
    {
      type: 'header',
      text: { type: 'plain_text', text: `Revvy Weekly Report — ${args.weekOf}`, emoji: true },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '*KPI Dashboard*',
      },
    },
    {
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: `${statusEmoji(args.contentPublished, args.contentTarget)} *Content Published:* ${args.contentPublished}/${args.contentTarget}`,
        },
        {
          type: 'mrkdwn',
          text: `${statusEmoji(args.socialInteractions, args.socialTarget)} *Social Interactions:* ${args.socialInteractions}/${args.socialTarget}`,
        },
        {
          type: 'mrkdwn',
          text: `${statusEmoji(args.feedbackSubmitted, args.feedbackTarget)} *Product Feedback:* ${args.feedbackSubmitted}/${args.feedbackTarget}`,
        },
        {
          type: 'mrkdwn',
          text: `${statusEmoji(args.growthExperiments, 1)} *Growth Experiments:* ${args.growthExperiments}/1`,
        },
      ],
    },
    { type: 'divider' } as any,
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Highlights*\n${args.highlights.map((h) => `• ${h}`).join('\n') || '_(none)_'}`,
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Learnings*\n${args.learnings.map((l) => `• ${l}`).join('\n') || '_(none)_'}`,
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Next Week Plan*\n${args.nextWeekPlan.map((p) => `• ${p}`).join('\n') || '_(none)_'}`,
      },
    },
  ];

  const text = `Revvy Weekly Report — ${args.weekOf}: ${args.contentPublished} content pieces, ${args.socialInteractions} interactions, ${args.feedbackSubmitted} feedback items`;

  return sendWebhookMessage({ text, blocks });
}

/**
 * Send product feedback to the designated feedback channel.
 */
export async function sendProductFeedback(args: {
  title: string;
  problem: string;
  impact: string;
  proposedSolution: string;
  source: string; // e.g., "community observation", "agent usage", "user report"
  priority: 'low' | 'medium' | 'high' | 'critical';
}): Promise<SlackResult> {
  const priorityEmoji: Record<string, string> = {
    low: ':large_blue_circle:',
    medium: ':large_yellow_circle:',
    high: ':large_orange_circle:',
    critical: ':red_circle:',
  };

  const config = getSlackConfig();

  const blocks: SlackBlock[] = [
    {
      type: 'header',
      text: { type: 'plain_text', text: `Product Feedback: ${args.title}`, emoji: true },
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*Priority:* ${priorityEmoji[args.priority]} ${args.priority.toUpperCase()}` },
        { type: 'mrkdwn', text: `*Source:* ${args.source}` },
      ],
    },
    {
      type: 'section',
      text: { type: 'mrkdwn', text: `*Problem:*\n${args.problem}` },
    },
    {
      type: 'section',
      text: { type: 'mrkdwn', text: `*Impact:*\n${args.impact}` },
    },
    {
      type: 'section',
      text: { type: 'mrkdwn', text: `*Proposed Solution:*\n${args.proposedSolution}` },
    },
  ];

  const text = `[${args.priority.toUpperCase()}] Product Feedback: ${args.title}`;

  // Try to post to the feedback channel specifically
  if (config.botConfigured) {
    return postMessage({ channel: config.feedbackChannel, text, blocks });
  }

  return sendWebhookMessage({ text, blocks });
}

/**
 * Send a content publishing notification.
 */
export async function notifyContentPublished(args: {
  title: string;
  kind: string;
  url: string;
  summary: string;
}): Promise<SlackResult> {
  const blocks: SlackBlock[] = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `:newspaper: *New Content Published*\n*${args.title}* (${args.kind})\n${args.summary}\n<${args.url}|View →>`,
      },
    },
  ];

  return sendWebhookMessage({
    text: `New content published: ${args.title} — ${args.url}`,
    blocks,
  });
}

/* ------------------------------------------------------------------ */
/*  Logging                                                            */
/* ------------------------------------------------------------------ */

async function logSlackAction(action: string, channel: string, content: string): Promise<void> {
  try {
    await sql()`
      insert into social_actions (platform, action, content_id, content, url, metadata)
      values ('slack', ${action}, ${channel}, ${content.slice(0, 500)}, ${null}, ${JSON.stringify({})}::jsonb)
    `;
  } catch (e) {
    console.error('Failed to log Slack action (non-fatal):', e);
  }
}
