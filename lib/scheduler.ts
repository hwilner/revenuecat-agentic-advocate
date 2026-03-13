/**
 * Content Scheduling System for Revvy.
 *
 * Manages:
 * - Scheduling content for future publication
 * - Processing due scheduled items (called by cron)
 * - Generating weekly content plans
 * - Tracking KPIs against targets
 *
 * The scheduler works with the cron endpoint to publish content
 * at the right time across all platforms.
 */

import { z } from 'zod';
import { generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { sql } from './db';
import { upsertPublicArtifact } from './publicArtifacts';
import { postTweet, postThread, isTwitterConfigured } from './twitter';
import { createGist, isGitHubConfigured } from './github';
import { notifyContentPublished, isSlackConfigured } from './slack';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type ScheduledItem = {
  id: number;
  created_at: string;
  scheduled_for: string;
  platform: string;
  content_type: string;
  title: string | null;
  content: string;
  status: string;
  published_at: string | null;
  published_id: string | null;
  published_url: string | null;
  metadata: unknown;
};

export type WeeklyPlan = {
  weekOf: string;
  items: {
    day: string;
    platform: string;
    contentType: string;
    title: string;
    description: string;
  }[];
};

/* ------------------------------------------------------------------ */
/*  Schedule Content                                                   */
/* ------------------------------------------------------------------ */

/**
 * Schedule a piece of content for future publication.
 */
export async function scheduleContent(args: {
  scheduledFor: Date;
  platform: 'site' | 'twitter' | 'twitter_thread' | 'github_gist' | 'all';
  contentType: string; // 'blog-post', 'tutorial', 'tweet', 'code-sample', etc.
  title?: string;
  content: string;
  metadata?: unknown;
}): Promise<{ ok: boolean; id?: number; error?: string }> {
  try {
    const rows = await sql()<{ id: number }[]>`
      insert into content_schedule (scheduled_for, platform, content_type, title, content, status, metadata)
      values (
        ${args.scheduledFor.toISOString()},
        ${args.platform},
        ${args.contentType},
        ${args.title ?? null},
        ${args.content},
        'pending',
        ${JSON.stringify(args.metadata ?? {})}::jsonb
      )
      returning id
    `;

    return { ok: true, id: rows[0]?.id };
  } catch (e: any) {
    return { ok: false, error: `Failed to schedule content: ${e.message}` };
  }
}

/**
 * List upcoming scheduled content.
 */
export async function listScheduledContent(args?: {
  status?: string;
  limit?: number;
}): Promise<ScheduledItem[]> {
  const status = args?.status ?? 'pending';
  const limit = args?.limit ?? 20;

  const rows = await sql()<ScheduledItem[]>`
    select id, created_at, scheduled_for, platform, content_type, title, content, status, published_at, published_id, published_url, metadata
    from content_schedule
    where status = ${status}
    order by scheduled_for asc
    limit ${limit}
  `;

  return rows;
}

/* ------------------------------------------------------------------ */
/*  Process Due Items (called by cron)                                 */
/* ------------------------------------------------------------------ */

/**
 * Process all scheduled items that are due for publication.
 * Called by the cron endpoint.
 */
export async function processDueScheduledItems(): Promise<{
  processed: number;
  succeeded: number;
  failed: number;
  results: { id: number; platform: string; status: string; url?: string; error?: string }[];
}> {
  // Get items that are due
  const dueItems = await sql()<ScheduledItem[]>`
    select id, created_at, scheduled_for, platform, content_type, title, content, status, published_at, published_id, published_url, metadata
    from content_schedule
    where status = 'pending' and scheduled_for <= now()
    order by scheduled_for asc
    limit 10
  `;

  const results: { id: number; platform: string; status: string; url?: string; error?: string }[] = [];
  let succeeded = 0;
  let failed = 0;

  for (const item of dueItems) {
    try {
      const result = await publishScheduledItem(item);
      results.push({ id: item.id, platform: item.platform, ...result });

      if (result.status === 'published') {
        succeeded++;
        await sql()`
          update content_schedule set
            status = 'published',
            published_at = now(),
            published_id = ${result.publishedId ?? null},
            published_url = ${result.url ?? null}
          where id = ${item.id}
        `;
      } else {
        failed++;
        await sql()`
          update content_schedule set status = 'failed', metadata = metadata || ${JSON.stringify({ error: result.error })}::jsonb
          where id = ${item.id}
        `;
      }
    } catch (e: any) {
      failed++;
      results.push({ id: item.id, platform: item.platform, status: 'error', error: e.message });
      await sql()`
        update content_schedule set status = 'failed', metadata = metadata || ${JSON.stringify({ error: e.message })}::jsonb
        where id = ${item.id}
      `;
    }
  }

  return { processed: dueItems.length, succeeded, failed, results };
}

/**
 * Publish a single scheduled item to its target platform.
 */
async function publishScheduledItem(item: ScheduledItem): Promise<{
  status: string;
  url?: string;
  publishedId?: string;
  error?: string;
}> {
  switch (item.platform) {
    case 'site': {
      // Publish to the agent's own site
      const slug = (item.title ?? `content-${item.id}`)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');

      await upsertPublicArtifact({
        slug,
        kind: item.content_type,
        title: item.title ?? `Content #${item.id}`,
        contentMd: item.content,
      });

      const url = slug === 'application-letter'
        ? '/application-letter'
        : `/p/${slug}`;

      // Notify Slack if configured
      if (isSlackConfigured()) {
        await notifyContentPublished({
          title: item.title ?? `Content #${item.id}`,
          kind: item.content_type,
          url,
          summary: item.content.slice(0, 200) + '...',
        }).catch(() => {});
      }

      return { status: 'published', url, publishedId: slug };
    }

    case 'twitter': {
      if (!isTwitterConfigured()) {
        return { status: 'failed', error: 'Twitter API not configured' };
      }
      const result = await postTweet({ text: item.content });
      if (!result.ok) return { status: 'failed', error: result.error };
      return { status: 'published', url: result.url, publishedId: result.tweet_id };
    }

    case 'twitter_thread': {
      if (!isTwitterConfigured()) {
        return { status: 'failed', error: 'Twitter API not configured' };
      }
      // Content should be JSON array of tweet texts
      let tweets: string[];
      try {
        tweets = JSON.parse(item.content);
      } catch {
        // Fall back to splitting by double newline
        tweets = item.content.split('\n\n').filter(Boolean);
      }
      const result = await postThread({ tweets });
      if (!result.ok) return { status: 'failed', error: result.error };
      return { status: 'published', url: result.urls?.[0], publishedId: result.tweet_ids?.[0] };
    }

    case 'github_gist': {
      if (!isGitHubConfigured()) {
        return { status: 'failed', error: 'GitHub API not configured' };
      }
      const filename = (item.title ?? 'code-sample').replace(/[^a-zA-Z0-9_.-]/g, '_');
      const result = await createGist({
        description: item.title ?? `Code sample by Revvy`,
        files: { [filename]: item.content },
        isPublic: true,
      });
      if (!result.ok) return { status: 'failed', error: result.error };
      return { status: 'published', url: result.url, publishedId: String(result.id) };
    }

    case 'all': {
      // Publish to site first, then cross-post
      const siteResult = await publishScheduledItem({ ...item, platform: 'site' });

      // Cross-post to Twitter if configured
      if (isTwitterConfigured() && item.title) {
        const tweetText = `${item.title}\n\nRead more: ${siteResult.url ?? ''}`.slice(0, 280);
        await postTweet({ text: tweetText }).catch(() => {});
      }

      return siteResult;
    }

    default:
      return { status: 'failed', error: `Unknown platform: ${item.platform}` };
  }
}

/* ------------------------------------------------------------------ */
/*  Weekly Content Plan Generation                                     */
/* ------------------------------------------------------------------ */

/**
 * Generate a weekly content plan using LLM.
 * Creates scheduled items for the coming week.
 */
export async function generateWeeklyPlan(args: {
  modelName: string;
  weekStartDate: Date;
}): Promise<{ ok: boolean; plan?: WeeklyPlan; scheduledCount?: number; error?: string }> {
  try {
    // Get recent content to avoid repetition
    const recentContent = await sql()<{ title: string; content_type: string; created_at: string }[]>`
      select title, content_type, created_at
      from content_schedule
      where created_at > now() - interval '30 days'
      order by created_at desc
      limit 20
    `;

    const recentArtifacts = await sql()<{ title: string; kind: string }[]>`
      select title, kind from public_artifacts
      order by created_at desc
      limit 10
    `;

    const schema = z.object({
      items: z.array(z.object({
        dayOffset: z.number().int().min(0).max(6).describe('Day of the week (0=Monday, 6=Sunday)'),
        platform: z.enum(['site', 'twitter', 'twitter_thread', 'github_gist', 'all']),
        contentType: z.string().describe('Type: blog-post, tutorial, code-sample, tweet, case-study, documentation-update'),
        title: z.string().describe('Title or topic for the content'),
        description: z.string().describe('Brief description of what to write'),
      })).min(4).max(10).describe('Content items for the week. Must include at least 2 site publications and multiple social posts.'),
    });

    const { object } = await generateObject({
      model: openai(args.modelName),
      system: `You are Revvy's content planning engine. Generate a weekly content plan that meets these targets:
- At least 2 substantial content pieces (blog posts, tutorials, code samples) published to the site
- At least 5 tweets or tweet threads about RevenueCat, in-app subscriptions, or the agent ecosystem
- At least 1 code sample (GitHub gist) showing RevenueCat SDK or MCP usage
- Content should be varied: mix of technical tutorials, growth insights, product updates, community engagement

Focus areas for RevenueCat content:
- MCP Server tools and agent integration
- SDK best practices (Purchases.configure(), getOfferings(), purchasePackage())
- Paywall optimization and A/B testing
- Agent ecosystem (KellyClaudeAI, Larry, OpenClaw, Termo.ai)
- Subscription monetization strategies
- Cross-platform development tips

Avoid repeating topics from recent content.`,
      prompt: `Generate a content plan for the week starting ${args.weekStartDate.toISOString().split('T')[0]}.

Recent content (avoid repeating):
${recentContent.map(c => `- ${c.content_type}: ${c.title}`).join('\n') || '(none yet)'}

Recent published artifacts:
${recentArtifacts.map(a => `- ${a.kind}: ${a.title}`).join('\n') || '(none yet)'}`,
      schema,
    });

    // Schedule each item
    let scheduledCount = 0;
    const planItems: WeeklyPlan['items'] = [];

    for (const item of object.items) {
      const scheduledDate = new Date(args.weekStartDate);
      scheduledDate.setDate(scheduledDate.getDate() + item.dayOffset);
      scheduledDate.setHours(9, 0, 0, 0); // Default to 9 AM

      const result = await scheduleContent({
        scheduledFor: scheduledDate,
        platform: item.platform,
        contentType: item.contentType,
        title: item.title,
        content: item.description, // Placeholder — actual content generated at publish time
        metadata: { fromWeeklyPlan: true, description: item.description },
      });

      if (result.ok) scheduledCount++;

      const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
      planItems.push({
        day: dayNames[item.dayOffset] ?? `Day ${item.dayOffset}`,
        platform: item.platform,
        contentType: item.contentType,
        title: item.title,
        description: item.description,
      });
    }

    const plan: WeeklyPlan = {
      weekOf: args.weekStartDate.toISOString().split('T')[0],
      items: planItems,
    };

    return { ok: true, plan, scheduledCount };
  } catch (e: any) {
    return { ok: false, error: `Failed to generate weekly plan: ${e.message}` };
  }
}

/* ------------------------------------------------------------------ */
/*  KPI Tracking                                                       */
/* ------------------------------------------------------------------ */

/**
 * Record a KPI metric for the current week.
 */
export async function recordKPI(args: {
  metric: string;
  value: number;
  target?: number;
}): Promise<void> {
  await sql()`
    insert into weekly_kpis (week_start, metric, value, target)
    values (date_trunc('week', now())::date, ${args.metric}, ${args.value}, ${args.target ?? null})
    on conflict (week_start, metric)
    do update set value = ${args.value}, target = coalesce(${args.target ?? null}, weekly_kpis.target)
  `;
}

/**
 * Get KPIs for the current week.
 */
export async function getCurrentWeekKPIs(): Promise<{
  metrics: { metric: string; value: number; target: number | null }[];
}> {
  const rows = await sql()<{ metric: string; value: number; target: number | null }[]>`
    select metric, value, target
    from weekly_kpis
    where week_start = date_trunc('week', now())::date
    order by metric
  `;

  return { metrics: rows };
}

/**
 * Get a summary of all KPIs for reporting.
 */
export async function getKPISummary(): Promise<{
  contentPublished: number;
  contentTarget: number;
  socialInteractions: number;
  socialTarget: number;
  feedbackSubmitted: number;
  feedbackTarget: number;
  growthExperiments: number;
}> {
  // Count content published this week
  const [contentRows, socialRows, feedbackRows] = await Promise.all([
    sql()<{ count: string }[]>`
      select count(*)::text as count from public_artifacts
      where created_at >= date_trunc('week', now())
    `,
    sql()<{ count: string }[]>`
      select count(*)::text as count from social_actions
      where created_at >= date_trunc('week', now())
    `,
    sql()<{ count: string }[]>`
      select count(*)::text as count from social_actions
      where created_at >= date_trunc('week', now())
      and platform = 'slack' and action = 'product_feedback'
    `,
  ]);

  return {
    contentPublished: parseInt(contentRows[0]?.count ?? '0', 10),
    contentTarget: 2,
    socialInteractions: parseInt(socialRows[0]?.count ?? '0', 10),
    socialTarget: 50,
    feedbackSubmitted: parseInt(feedbackRows[0]?.count ?? '0', 10),
    feedbackTarget: 3,
    growthExperiments: 0, // TODO: track growth experiments separately
  };
}
