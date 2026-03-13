/**
 * X/Twitter integration for Revvy.
 *
 * Uses the Twitter API v2 for:
 * - Posting tweets (original + threads)
 * - Replying to tweets
 * - Searching for relevant conversations
 * - Monitoring mentions
 *
 * All operations are gated behind environment variable availability.
 * If TWITTER_* env vars are not set, functions return graceful errors.
 */

import { sql } from './db';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type TweetResult = {
  ok: boolean;
  tweet_id?: string;
  url?: string;
  error?: string;
};

export type SearchResult = {
  ok: boolean;
  tweets?: {
    id: string;
    text: string;
    author_id: string;
    author_username?: string;
    created_at: string;
  }[];
  error?: string;
};

export type MentionResult = {
  ok: boolean;
  mentions?: {
    id: string;
    text: string;
    author_id: string;
    author_username?: string;
    created_at: string;
    conversation_id?: string;
  }[];
  error?: string;
};

/* ------------------------------------------------------------------ */
/*  Config                                                             */
/* ------------------------------------------------------------------ */

function getTwitterConfig() {
  const apiKey = process.env.TWITTER_API_KEY;
  const apiSecret = process.env.TWITTER_API_SECRET;
  const accessToken = process.env.TWITTER_ACCESS_TOKEN;
  const accessTokenSecret = process.env.TWITTER_ACCESS_TOKEN_SECRET;
  const bearerToken = process.env.TWITTER_BEARER_TOKEN;

  const configured = !!(apiKey && apiSecret && accessToken && accessTokenSecret);

  return {
    apiKey: apiKey ?? '',
    apiSecret: apiSecret ?? '',
    accessToken: accessToken ?? '',
    accessTokenSecret: accessTokenSecret ?? '',
    bearerToken: bearerToken ?? '',
    configured,
  };
}

export function isTwitterConfigured(): boolean {
  return getTwitterConfig().configured;
}

/* ------------------------------------------------------------------ */
/*  OAuth 1.0a Signature (for user-context endpoints)                  */
/* ------------------------------------------------------------------ */

/**
 * Generates OAuth 1.0a signature for Twitter API v2.
 * Twitter requires OAuth 1.0a for posting tweets (user context).
 */
async function generateOAuthHeader(
  method: string,
  url: string,
  params: Record<string, string> = {},
): Promise<string> {
  const crypto = await import('crypto');
  const config = getTwitterConfig();

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = crypto.randomBytes(16).toString('hex');

  const oauthParams: Record<string, string> = {
    oauth_consumer_key: config.apiKey,
    oauth_nonce: nonce,
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: timestamp,
    oauth_token: config.accessToken,
    oauth_version: '1.0',
  };

  // Combine all params for signature base
  const allParams = { ...oauthParams, ...params };
  const sortedParams = Object.keys(allParams)
    .sort()
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(allParams[k])}`)
    .join('&');

  const signatureBase = `${method.toUpperCase()}&${encodeURIComponent(url)}&${encodeURIComponent(sortedParams)}`;
  const signingKey = `${encodeURIComponent(config.apiSecret)}&${encodeURIComponent(config.accessTokenSecret)}`;

  const signature = crypto
    .createHmac('sha1', signingKey)
    .update(signatureBase)
    .digest('base64');

  oauthParams['oauth_signature'] = signature;

  const authHeader = Object.keys(oauthParams)
    .sort()
    .map((k) => `${encodeURIComponent(k)}="${encodeURIComponent(oauthParams[k])}"`)
    .join(', ');

  return `OAuth ${authHeader}`;
}

/* ------------------------------------------------------------------ */
/*  Core API Functions                                                 */
/* ------------------------------------------------------------------ */

/**
 * Post a tweet.
 */
export async function postTweet(args: {
  text: string;
  replyToId?: string;
  quoteTweetId?: string;
}): Promise<TweetResult> {
  const config = getTwitterConfig();
  if (!config.configured) {
    return { ok: false, error: 'Twitter API not configured. Set TWITTER_API_KEY, TWITTER_API_SECRET, TWITTER_ACCESS_TOKEN, TWITTER_ACCESS_TOKEN_SECRET environment variables.' };
  }

  if (args.text.length > 280) {
    return { ok: false, error: `Tweet exceeds 280 characters (${args.text.length} chars). Shorten the text.` };
  }

  const url = 'https://api.twitter.com/2/tweets';
  const body: Record<string, unknown> = { text: args.text };

  if (args.replyToId) {
    body.reply = { in_reply_to_tweet_id: args.replyToId };
  }
  if (args.quoteTweetId) {
    body.quote_tweet_id = args.quoteTweetId;
  }

  try {
    const authHeader = await generateOAuthHeader('POST', url);

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();

    if (!res.ok) {
      return { ok: false, error: `Twitter API error (${res.status}): ${JSON.stringify(data)}` };
    }

    const tweetId = data.data?.id;
    const tweetUrl = tweetId ? `https://x.com/i/web/status/${tweetId}` : undefined;

    // Log the tweet to the database
    await logSocialAction({
      platform: 'twitter',
      action: args.replyToId ? 'reply' : 'tweet',
      contentId: tweetId,
      content: args.text,
      url: tweetUrl,
      metadata: { replyToId: args.replyToId, quoteTweetId: args.quoteTweetId },
    });

    return { ok: true, tweet_id: tweetId, url: tweetUrl };
  } catch (e: any) {
    return { ok: false, error: `Twitter API request failed: ${e.message}` };
  }
}

/**
 * Post a thread (multiple tweets in sequence).
 */
export async function postThread(args: {
  tweets: string[];
}): Promise<{ ok: boolean; tweet_ids?: string[]; urls?: string[]; error?: string }> {
  if (args.tweets.length === 0) {
    return { ok: false, error: 'Thread must have at least one tweet.' };
  }

  const tweetIds: string[] = [];
  const urls: string[] = [];
  let replyToId: string | undefined;

  for (const text of args.tweets) {
    const result = await postTweet({ text, replyToId });
    if (!result.ok) {
      return {
        ok: false,
        tweet_ids: tweetIds,
        urls,
        error: `Thread failed at tweet ${tweetIds.length + 1}: ${result.error}`,
      };
    }
    tweetIds.push(result.tweet_id!);
    if (result.url) urls.push(result.url);
    replyToId = result.tweet_id;
  }

  return { ok: true, tweet_ids: tweetIds, urls };
}

/**
 * Search for recent tweets matching a query.
 * Uses Twitter API v2 search/recent endpoint (requires Bearer Token).
 */
export async function searchTweets(args: {
  query: string;
  maxResults?: number;
}): Promise<SearchResult> {
  const config = getTwitterConfig();
  if (!config.bearerToken) {
    return { ok: false, error: 'Twitter Bearer Token not configured. Set TWITTER_BEARER_TOKEN environment variable.' };
  }

  const maxResults = Math.min(args.maxResults ?? 10, 100);
  const params = new URLSearchParams({
    query: args.query,
    max_results: maxResults.toString(),
    'tweet.fields': 'created_at,author_id,conversation_id',
    expansions: 'author_id',
    'user.fields': 'username',
  });

  try {
    const res = await fetch(`https://api.twitter.com/2/tweets/search/recent?${params}`, {
      headers: { Authorization: `Bearer ${config.bearerToken}` },
    });

    const data = await res.json();

    if (!res.ok) {
      return { ok: false, error: `Twitter search error (${res.status}): ${JSON.stringify(data)}` };
    }

    // Map author IDs to usernames
    const userMap = new Map<string, string>();
    if (data.includes?.users) {
      for (const user of data.includes.users) {
        userMap.set(user.id, user.username);
      }
    }

    const tweets = (data.data ?? []).map((t: any) => ({
      id: t.id,
      text: t.text,
      author_id: t.author_id,
      author_username: userMap.get(t.author_id),
      created_at: t.created_at,
    }));

    return { ok: true, tweets };
  } catch (e: any) {
    return { ok: false, error: `Twitter search failed: ${e.message}` };
  }
}

/**
 * Get recent mentions of the authenticated user.
 * Requires the user ID (fetched once and cached).
 */
export async function getMentions(args: {
  maxResults?: number;
  sinceId?: string;
}): Promise<MentionResult> {
  const config = getTwitterConfig();
  if (!config.bearerToken || !config.configured) {
    return { ok: false, error: 'Twitter API not fully configured.' };
  }

  try {
    // First, get our user ID
    const meRes = await fetch('https://api.twitter.com/2/users/me', {
      headers: { Authorization: `Bearer ${config.bearerToken}` },
    });
    const meData = await meRes.json();
    if (!meRes.ok) {
      return { ok: false, error: `Failed to get user ID: ${JSON.stringify(meData)}` };
    }
    const userId = meData.data?.id;

    // Then get mentions
    const params = new URLSearchParams({
      max_results: Math.min(args.maxResults ?? 20, 100).toString(),
      'tweet.fields': 'created_at,author_id,conversation_id',
      expansions: 'author_id',
      'user.fields': 'username',
    });
    if (args.sinceId) params.set('since_id', args.sinceId);

    const res = await fetch(`https://api.twitter.com/2/users/${userId}/mentions?${params}`, {
      headers: { Authorization: `Bearer ${config.bearerToken}` },
    });
    const data = await res.json();

    if (!res.ok) {
      return { ok: false, error: `Mentions fetch error (${res.status}): ${JSON.stringify(data)}` };
    }

    const userMap = new Map<string, string>();
    if (data.includes?.users) {
      for (const user of data.includes.users) {
        userMap.set(user.id, user.username);
      }
    }

    const mentions = (data.data ?? []).map((t: any) => ({
      id: t.id,
      text: t.text,
      author_id: t.author_id,
      author_username: userMap.get(t.author_id),
      created_at: t.created_at,
      conversation_id: t.conversation_id,
    }));

    return { ok: true, mentions };
  } catch (e: any) {
    return { ok: false, error: `Mentions fetch failed: ${e.message}` };
  }
}

/* ------------------------------------------------------------------ */
/*  Social Action Logging                                              */
/* ------------------------------------------------------------------ */

/**
 * Logs a social media action to the database for tracking and metrics.
 */
async function logSocialAction(args: {
  platform: string;
  action: string;
  contentId?: string;
  content: string;
  url?: string;
  metadata?: unknown;
}): Promise<void> {
  try {
    await sql()`
      insert into social_actions (platform, action, content_id, content, url, metadata)
      values (${args.platform}, ${args.action}, ${args.contentId ?? null}, ${args.content}, ${args.url ?? null}, ${JSON.stringify(args.metadata ?? null)}::jsonb)
    `;
  } catch (e) {
    console.error('Failed to log social action (non-fatal):', e);
  }
}

/* ------------------------------------------------------------------ */
/*  DB Schema (called from initDb)                                     */
/* ------------------------------------------------------------------ */

export async function initSocialTables() {
  const db = sql();

  // Social media actions log
  await db`
    create table if not exists social_actions (
      id bigserial primary key,
      created_at timestamptz not null default now(),
      platform text not null,
      action text not null,
      content_id text,
      content text not null,
      url text,
      metadata jsonb
    )
  `;

  // Content schedule
  await db`
    create table if not exists content_schedule (
      id bigserial primary key,
      created_at timestamptz not null default now(),
      scheduled_for timestamptz not null,
      platform text not null,
      content_type text not null,
      title text,
      content text not null,
      status text not null default 'pending',
      published_at timestamptz,
      published_id text,
      published_url text,
      metadata jsonb
    )
  `;

  // Weekly KPI tracking
  await db`
    create table if not exists weekly_kpis (
      id bigserial primary key,
      week_start date not null,
      metric text not null,
      value real not null default 0,
      target real,
      metadata jsonb,
      unique(week_start, metric)
    )
  `;
}

/* ------------------------------------------------------------------ */
/*  Metrics Helpers                                                    */
/* ------------------------------------------------------------------ */

/**
 * Get social action counts for the current week.
 */
export async function getWeeklySocialStats(): Promise<{
  tweets: number;
  replies: number;
  githubActions: number;
  slackMessages: number;
  totalInteractions: number;
}> {
  const rows = await sql()<{ platform: string; action: string; count: string }[]>`
    select platform, action, count(*)::text as count
    from social_actions
    where created_at >= date_trunc('week', now())
    group by platform, action
  `;

  let tweets = 0, replies = 0, githubActions = 0, slackMessages = 0;
  for (const row of rows) {
    const c = parseInt(row.count, 10);
    if (row.platform === 'twitter' && row.action === 'tweet') tweets += c;
    if (row.platform === 'twitter' && row.action === 'reply') replies += c;
    if (row.platform === 'github') githubActions += c;
    if (row.platform === 'slack') slackMessages += c;
  }

  return {
    tweets,
    replies,
    githubActions,
    slackMessages,
    totalInteractions: tweets + replies + githubActions + slackMessages,
  };
}

/**
 * Get content publishing stats for the current week.
 */
export async function getWeeklyContentStats(): Promise<{
  published: number;
  scheduled: number;
  target: number;
}> {
  const [pubRows, schedRows] = await Promise.all([
    sql()<{ count: string }[]>`
      select count(*)::text as count
      from public_artifacts
      where created_at >= date_trunc('week', now())
    `,
    sql()<{ count: string }[]>`
      select count(*)::text as count
      from content_schedule
      where status = 'pending' and scheduled_for > now()
    `,
  ]);

  return {
    published: parseInt(pubRows[0]?.count ?? '0', 10),
    scheduled: parseInt(schedRows[0]?.count ?? '0', 10),
    target: 2, // 2 pieces per week per job description
  };
}
