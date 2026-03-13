/**
 * GitHub integration for Revvy.
 *
 * Uses the GitHub REST API v3 for:
 * - Creating and commenting on issues
 * - Creating and commenting on discussions (via GraphQL)
 * - Publishing code samples as gists
 * - Searching for relevant issues/discussions
 * - Starring and engaging with repos
 *
 * All operations are gated behind GITHUB_TOKEN availability.
 */

import { sql } from './db';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type GitHubResult = {
  ok: boolean;
  url?: string;
  id?: string | number;
  error?: string;
};

export type GitHubSearchResult = {
  ok: boolean;
  items?: {
    id: number;
    title: string;
    body: string;
    html_url: string;
    user: string;
    created_at: string;
    state?: string;
    comments: number;
    repository?: string;
  }[];
  error?: string;
};

/* ------------------------------------------------------------------ */
/*  Config                                                             */
/* ------------------------------------------------------------------ */

function getGitHubConfig() {
  const token = process.env.GITHUB_TOKEN;
  const username = process.env.GITHUB_USERNAME ?? 'revvy-agent';
  const defaultRepo = process.env.GITHUB_DEFAULT_REPO; // e.g., "RevenueCat/purchases-ios"

  return {
    token: token ?? '',
    username,
    defaultRepo: defaultRepo ?? '',
    configured: !!token,
  };
}

export function isGitHubConfigured(): boolean {
  return getGitHubConfig().configured;
}

/* ------------------------------------------------------------------ */
/*  API Helpers                                                        */
/* ------------------------------------------------------------------ */

async function githubFetch(
  path: string,
  options: RequestInit = {},
): Promise<{ ok: boolean; status: number; data: any }> {
  const config = getGitHubConfig();
  if (!config.configured) {
    return { ok: false, status: 0, data: { message: 'GitHub token not configured.' } };
  }

  const url = path.startsWith('https://') ? path : `https://api.github.com${path}`;

  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${config.token}`,
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
      'User-Agent': 'Revvy-Agent/1.0',
      ...(options.headers ?? {}),
    },
  });

  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

async function githubGraphQL(query: string, variables: Record<string, unknown> = {}): Promise<{ ok: boolean; data: any; errors?: any[] }> {
  const config = getGitHubConfig();
  if (!config.configured) {
    return { ok: false, data: null, errors: [{ message: 'GitHub token not configured.' }] };
  }

  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.token}`,
      'Content-Type': 'application/json',
      'User-Agent': 'Revvy-Agent/1.0',
    },
    body: JSON.stringify({ query, variables }),
  });

  const body = await res.json().catch(() => ({}));
  return {
    ok: res.ok && !body.errors,
    data: body.data,
    errors: body.errors,
  };
}

/* ------------------------------------------------------------------ */
/*  Issue Operations                                                   */
/* ------------------------------------------------------------------ */

/**
 * Create an issue on a GitHub repository.
 */
export async function createIssue(args: {
  repo: string; // "owner/repo"
  title: string;
  body: string;
  labels?: string[];
}): Promise<GitHubResult> {
  const res = await githubFetch(`/repos/${args.repo}/issues`, {
    method: 'POST',
    body: JSON.stringify({
      title: args.title,
      body: args.body,
      labels: args.labels ?? [],
    }),
  });

  if (!res.ok) {
    return { ok: false, error: `GitHub API error (${res.status}): ${JSON.stringify(res.data)}` };
  }

  await logGitHubAction('create_issue', args.repo, res.data.html_url, args.title);
  return { ok: true, url: res.data.html_url, id: res.data.number };
}

/**
 * Comment on an existing issue.
 */
export async function commentOnIssue(args: {
  repo: string;
  issueNumber: number;
  body: string;
}): Promise<GitHubResult> {
  const res = await githubFetch(`/repos/${args.repo}/issues/${args.issueNumber}/comments`, {
    method: 'POST',
    body: JSON.stringify({ body: args.body }),
  });

  if (!res.ok) {
    return { ok: false, error: `GitHub API error (${res.status}): ${JSON.stringify(res.data)}` };
  }

  await logGitHubAction('comment_issue', args.repo, res.data.html_url, `Comment on #${args.issueNumber}`);
  return { ok: true, url: res.data.html_url, id: res.data.id };
}

/* ------------------------------------------------------------------ */
/*  Discussion Operations (via GraphQL)                                */
/* ------------------------------------------------------------------ */

/**
 * Comment on a GitHub Discussion.
 * Requires the discussion's node ID (GraphQL ID).
 */
export async function commentOnDiscussion(args: {
  discussionNodeId: string;
  body: string;
}): Promise<GitHubResult> {
  const mutation = `
    mutation($discussionId: ID!, $body: String!) {
      addDiscussionComment(input: { discussionId: $discussionId, body: $body }) {
        comment {
          id
          url
        }
      }
    }
  `;

  const res = await githubGraphQL(mutation, {
    discussionId: args.discussionNodeId,
    body: args.body,
  });

  if (!res.ok) {
    return { ok: false, error: `GitHub GraphQL error: ${JSON.stringify(res.errors)}` };
  }

  const comment = res.data?.addDiscussionComment?.comment;
  await logGitHubAction('comment_discussion', 'discussion', comment?.url, 'Discussion comment');
  return { ok: true, url: comment?.url, id: comment?.id };
}

/* ------------------------------------------------------------------ */
/*  Gist Operations (Code Samples)                                     */
/* ------------------------------------------------------------------ */

/**
 * Create a GitHub Gist (code sample).
 */
export async function createGist(args: {
  description: string;
  files: Record<string, string>; // filename -> content
  isPublic?: boolean;
}): Promise<GitHubResult> {
  const filesPayload: Record<string, { content: string }> = {};
  for (const [name, content] of Object.entries(args.files)) {
    filesPayload[name] = { content };
  }

  const res = await githubFetch('/gists', {
    method: 'POST',
    body: JSON.stringify({
      description: args.description,
      public: args.isPublic ?? true,
      files: filesPayload,
    }),
  });

  if (!res.ok) {
    return { ok: false, error: `GitHub Gist error (${res.status}): ${JSON.stringify(res.data)}` };
  }

  await logGitHubAction('create_gist', 'gist', res.data.html_url, args.description);
  return { ok: true, url: res.data.html_url, id: res.data.id };
}

/* ------------------------------------------------------------------ */
/*  Search Operations                                                  */
/* ------------------------------------------------------------------ */

/**
 * Search GitHub issues and discussions for relevant conversations.
 */
export async function searchIssues(args: {
  query: string;
  sort?: 'created' | 'updated' | 'comments';
  maxResults?: number;
}): Promise<GitHubSearchResult> {
  const params = new URLSearchParams({
    q: args.query,
    sort: args.sort ?? 'updated',
    order: 'desc',
    per_page: Math.min(args.maxResults ?? 10, 30).toString(),
  });

  const res = await githubFetch(`/search/issues?${params}`);

  if (!res.ok) {
    return { ok: false, error: `GitHub search error (${res.status}): ${JSON.stringify(res.data)}` };
  }

  const items = (res.data.items ?? []).map((item: any) => ({
    id: item.number,
    title: item.title,
    body: (item.body ?? '').slice(0, 500),
    html_url: item.html_url,
    user: item.user?.login ?? 'unknown',
    created_at: item.created_at,
    state: item.state,
    comments: item.comments,
    repository: item.repository_url?.replace('https://api.github.com/repos/', ''),
  }));

  return { ok: true, items };
}

/**
 * Search for RevenueCat-related issues and discussions across GitHub.
 */
export async function searchRevenueCatIssues(args: {
  topic?: string;
  maxResults?: number;
}): Promise<GitHubSearchResult> {
  const baseQuery = args.topic
    ? `${args.topic} revenuecat OR RevenueCat`
    : 'revenuecat OR RevenueCat in-app purchase subscription';

  return searchIssues({
    query: baseQuery,
    sort: 'updated',
    maxResults: args.maxResults ?? 10,
  });
}

/* ------------------------------------------------------------------ */
/*  Repository Engagement                                              */
/* ------------------------------------------------------------------ */

/**
 * Star a repository.
 */
export async function starRepo(repo: string): Promise<GitHubResult> {
  const res = await githubFetch(`/user/starred/${repo}`, {
    method: 'PUT',
    headers: { 'Content-Length': '0' },
  });

  // 204 = success (no content)
  if (res.status === 204 || res.ok) {
    await logGitHubAction('star_repo', repo, `https://github.com/${repo}`, 'Starred');
    return { ok: true, url: `https://github.com/${repo}` };
  }

  return { ok: false, error: `Star failed (${res.status}): ${JSON.stringify(res.data)}` };
}

/* ------------------------------------------------------------------ */
/*  Logging                                                            */
/* ------------------------------------------------------------------ */

async function logGitHubAction(
  action: string,
  repo: string,
  url: string | undefined,
  summary: string,
): Promise<void> {
  try {
    await sql()`
      insert into social_actions (platform, action, content_id, content, url, metadata)
      values ('github', ${action}, ${repo}, ${summary}, ${url ?? null}, ${JSON.stringify({})}::jsonb)
    `;
  } catch (e) {
    console.error('Failed to log GitHub action (non-fatal):', e);
  }
}
