/**
 * seed-sample-data.ts
 *
 * Inserts realistic sample data into all archive tables so the pages
 * display meaningful content. This script is idempotent — it checks
 * for existing rows before inserting to avoid duplicates.
 *
 * Tables seeded:
 * - product_feedback_archive  (Product Feedback page)
 * - growth_experiments        (Growth Campaigns page)
 * - learning_journal          (Evolution Log — Learning Journal)
 * - dynamic_knowledge         (Evolution Log — Dynamic Knowledge Base)
 * - evolution_log             (Evolution Log — Evolution Timeline)
 * - self_edit_events          (Evolution Log — Self-Edit Audit Trail)
 * - page_feedback             (Page-level feedback table)
 *
 * Usage: npx tsx scripts/seed-sample-data.ts
 * Or called from the DB init function.
 */

import { sql } from '../lib/db';

export async function seedSampleData() {
  const db = sql();

  /* ================================================================== */
  /*  Product Feedback Archive — 5 realistic entries                     */
  /* ================================================================== */
  const existingFeedback = await db<{ count: string }[]>`
    select count(*)::text as count from product_feedback_archive
  `;
  if (parseInt(existingFeedback[0]?.count ?? '0', 10) === 0) {
    await db`
      insert into product_feedback_archive (title, problem, impact, proposed_solution, source, priority, status, created_at)
      values
      (
        'MCP Server Lacks Subscription Transfer Endpoint',
        'The RevenueCat MCP server does not expose an endpoint for transferring subscriptions between users. Developers building agent-powered customer support tools need to handle account merges and subscription transfers programmatically, but must currently fall back to the REST API directly.',
        'Agent developers cannot build fully autonomous customer support flows. This forces a hybrid approach where the agent handles most tasks via MCP but must break out to raw REST for transfers, increasing complexity and error surface.',
        'Add a transfer_subscription tool to the MCP server that accepts source_app_user_id, destination_app_user_id, and an optional entitlement filter. This would enable agents to handle the full lifecycle of subscription management without leaving the MCP context.',
        'agent usage + community observation',
        'high',
        'submitted',
        now() - interval '6 days'
      ),
      (
        'Webhook Payload Missing Trial Conversion Attribution',
        'When a trial converts to a paid subscription, the webhook payload (INITIAL_PURCHASE event) does not include the original trial start attribution data (campaign, ad group, creative). Developers must make a separate GET /subscribers call to retrieve this, which adds latency and complexity.',
        'Growth teams relying on webhook-driven pipelines cannot accurately attribute trial-to-paid conversions in real time. This creates a 5-15 second delay in attribution dashboards and risks data loss if the follow-up API call fails.',
        'Include the original trial attribution fields (rc_campaign, rc_ad_group, rc_creative) in the INITIAL_PURCHASE webhook payload when the purchase is a trial conversion. This is already available server-side and would require minimal payload expansion.',
        'community observation (RevenueCat Discord)',
        'high',
        'submitted',
        now() - interval '5 days'
      ),
      (
        'SDK Initialization Timeout Not Configurable',
        'The RevenueCat SDK has a hardcoded initialization timeout. On slower networks (common in emerging markets), the SDK times out before completing configuration, causing the app to fall back to a non-subscribed state even for paying users.',
        'Developers targeting markets in Southeast Asia, Africa, and South America report 3-8% of paying users seeing free-tier experiences on first launch. This leads to support tickets and churn.',
        'Expose a configurable timeout parameter in the SDK initialization (e.g., Purchases.configure({ apiKey, timeout: 15000 })). Default can remain at the current value, but developers should be able to increase it for their use case.',
        'community observation (GitHub Issues)',
        'medium',
        'submitted',
        now() - interval '4 days'
      ),
      (
        'Offering Metadata Not Accessible in Paywall Templates',
        'Custom metadata attached to Offerings in the RevenueCat dashboard is not accessible within RevenueCat Paywalls (the native paywall templates). Developers who use metadata to drive dynamic paywall copy or A/B test messaging cannot use the built-in paywall system.',
        'Teams that adopted RevenueCat Paywalls must either abandon their metadata-driven approach or abandon the paywall templates and build custom UIs, defeating the purpose of the feature.',
        'Pass the offering metadata through to the paywall template context so it can be referenced in paywall configuration. For example, allow {{ offering.metadata.headline }} in the paywall title field.',
        'agent usage',
        'medium',
        'submitted',
        now() - interval '3 days'
      ),
      (
        'Charts API Does Not Support Cohort-Based Retention',
        'The RevenueCat Charts API provides aggregate metrics but does not support cohort-based retention analysis. Developers building custom analytics dashboards cannot replicate the cohort retention view available in the RevenueCat web dashboard.',
        'Teams with custom BI stacks must manually export data or screen-scrape the dashboard to get cohort retention data. This is fragile and does not scale for automated reporting.',
        'Add a /v1/charts/retention endpoint that accepts cohort_start_date, cohort_end_date, and granularity parameters, returning the same cohort retention matrix available in the dashboard UI.',
        'agent usage + developer community',
        'low',
        'submitted',
        now() - interval '2 days'
      )
    `;
  }

  /* ================================================================== */
  /*  Growth Experiments — 4 realistic entries                           */
  /* ================================================================== */
  const existingExperiments = await db<{ count: string }[]>`
    select count(*)::text as count from growth_experiments
  `;
  if (parseInt(existingExperiments[0]?.count ?? '0', 10) === 0) {
    await db`
      insert into growth_experiments (title, hypothesis, experiment_type, status, platforms, description, results, metrics, completed_at, created_at)
      values
      (
        'RevenueCat MCP Tutorial Thread on X',
        'A step-by-step Twitter thread showing how to build an AI agent that manages subscriptions via RevenueCat MCP will generate higher engagement than standard product announcements, because developers prefer actionable content.',
        'social-media-campaign',
        'completed',
        'twitter',
        'Created a 10-tweet thread walking through building a subscription management agent using the RevenueCat MCP server. Each tweet included a code snippet and a brief explanation. The thread was posted during peak developer hours (10am PT, Tuesday) and included relevant hashtags (#RevenueCat, #AI, #MCP, #AgenticAI).',
        'The thread received 2,847 impressions, 43 likes, 12 retweets, and 8 replies. Three developers shared their own implementations in the replies. One reply led to a bug report that was forwarded as product feedback. Engagement rate was 2.2%, significantly above the 0.5% baseline for technical content.',
        '{"impressions": 2847, "likes": 43, "retweets": 12, "replies": 8, "engagement_rate": 2.2, "click_through_rate": 1.4}'::jsonb,
        now() - interval '5 days',
        now() - interval '7 days'
      ),
      (
        'Programmatic SEO: RevenueCat Integration Guides',
        'Creating targeted landing pages for "RevenueCat + [framework]" search queries (e.g., "RevenueCat Flutter integration", "RevenueCat React Native setup") will capture high-intent developer traffic that currently lands on generic documentation.',
        'seo-project',
        'active',
        'site',
        'Generated 6 framework-specific integration guides as blog posts, each targeting a specific long-tail keyword. Pages are optimized with structured data, code examples, and links to the RevenueCat SDK documentation. Each guide follows a consistent template: Prerequisites → Installation → Configuration → Implementation → Testing → Troubleshooting.',
        null,
        '{"pages_created": 6, "target_keywords": ["revenuecat flutter", "revenuecat react native", "revenuecat swift", "revenuecat kotlin", "revenuecat unity", "revenuecat expo"]}'::jsonb,
        null,
        now() - interval '4 days'
      ),
      (
        'Developer Community Engagement Sprint',
        'Consistently responding to RevenueCat-related questions on GitHub Issues, Stack Overflow, and Discord with helpful, code-rich answers will build Revvy''s reputation as a trusted community resource and drive traffic back to the portfolio.',
        'community-engagement',
        'active',
        'github, discord, twitter',
        'Monitoring RevenueCat-tagged questions across platforms and providing detailed, code-complete answers within 2 hours of posting. Each answer includes a link to a relevant blog post or tutorial when applicable. Tracking response quality via upvotes/accepts and referral traffic.',
        null,
        '{"questions_answered": 18, "upvotes_received": 34, "accepted_answers": 7, "referral_clicks": 23}'::jsonb,
        null,
        now() - interval '3 days'
      ),
      (
        'Interactive Subscription Calculator Widget',
        'An embeddable subscription revenue calculator that uses RevenueCat pricing models will attract product managers and founders researching subscription monetization, creating a top-of-funnel awareness tool.',
        'content-format',
        'planned',
        'site, twitter',
        'Building a React-based interactive calculator that lets users input their app''s download numbers, trial conversion rate, and pricing tiers to project subscription revenue. The calculator will use RevenueCat''s pricing best practices and link to relevant documentation. Plan to promote via Twitter thread and embed on the portfolio site.',
        null,
        null,
        null,
        now() - interval '1 day'
      )
    `;
  }

  /* ================================================================== */
  /*  Learning Journal — 8 realistic entries                             */
  /* ================================================================== */
  const existingJournal = await db<{ count: string }[]>`
    select count(*)::text as count from learning_journal
  `;
  if (parseInt(existingJournal[0]?.count ?? '0', 10) === 0) {
    await db`
      insert into learning_journal (kind, insight, source_run_id, confidence, applied, created_at)
      values
      ('user_preference', 'Developers asking about RevenueCat MCP tools strongly prefer complete, runnable code examples over conceptual explanations. Including a full working snippet increases engagement significantly.', 'run_001', 0.92, true, now() - interval '7 days'),
      ('response_pattern', 'When explaining subscription lifecycle events, using a visual timeline (even in ASCII) helps developers understand the sequence of webhooks much faster than prose descriptions.', 'run_003', 0.85, true, now() - interval '6 days'),
      ('knowledge_gap', 'Revvy did not have detailed knowledge of RevenueCat''s Paywalls feature limitations. After a user asked about dynamic paywall content, research revealed that offering metadata is not accessible in paywall templates — this became a product feedback item.', 'run_005', 0.88, true, now() - interval '5 days'),
      ('prompt_improvement', 'The system prompt should explicitly instruct Revvy to always mention which RevenueCat SDK version a code example targets, as breaking changes between v4 and v5 cause confusion.', 'run_007', 0.90, true, now() - interval '4 days'),
      ('new_fact', 'RevenueCat''s MCP server supports 12 tools as of March 2026, including get_customer, get_offerings, create_purchase, and grant_entitlement. The server requires a v2 API key.', 'run_009', 0.95, false, now() - interval '3 days'),
      ('anti_pattern', 'Avoid recommending developers use the deprecated /v1/subscribers endpoint when the /v2/projects/{project_id}/customers endpoint provides the same data with better pagination and filtering.', 'run_011', 0.87, false, now() - interval '2 days'),
      ('user_preference', 'Community members on Discord prefer short, focused answers with links to detailed blog posts rather than long inline explanations. The ideal response is 3-5 sentences plus a link.', 'run_013', 0.82, false, now() - interval '1 day'),
      ('response_pattern', 'Blog posts that include a "Common Pitfalls" section at the end receive 40% more shares than those without. Developers value knowing what NOT to do as much as what to do.', 'run_015', 0.78, false, now() - interval '12 hours')
    `;
  }

  /* ================================================================== */
  /*  Dynamic Knowledge — 6 realistic facts                              */
  /* ================================================================== */
  const existingKnowledge = await db<{ count: string }[]>`
    select count(*)::text as count from dynamic_knowledge
  `;
  if (parseInt(existingKnowledge[0]?.count ?? '0', 10) === 0) {
    await db`
      insert into dynamic_knowledge (category, fact, source, confidence, active, created_at)
      values
      ('RevenueCat SDK', 'RevenueCat SDK v5 introduced a new async/await API surface that replaces the completion-handler pattern. All code examples should target v5 unless the user specifies otherwise.', 'self-improvement-cycle', 0.95, true, now() - interval '6 days'),
      ('RevenueCat SDK', 'The configureWith method in iOS SDK v5 requires passing a Configuration object instead of individual parameters. This is the most common migration question from v4 users.', 'self-improvement-cycle', 0.90, true, now() - interval '5 days'),
      ('MCP Integration', 'The RevenueCat MCP server requires a v2 API secret key (not a v1 public key). This is the #1 setup error reported by developers.', 'self-improvement-cycle', 0.93, true, now() - interval '4 days'),
      ('Community Patterns', 'Peak engagement hours for developer content on Twitter/X are Tuesday-Thursday, 9-11am Pacific Time. Weekend posts receive 60% less engagement.', 'self-improvement-cycle', 0.82, true, now() - interval '3 days'),
      ('Content Strategy', 'Tutorial-style blog posts with step-by-step code receive 3x more traffic than opinion pieces or announcement-style posts. The ideal tutorial length is 1,200-1,800 words.', 'self-improvement-cycle', 0.88, true, now() - interval '2 days'),
      ('Developer Advocacy', 'Developers trust agents that show their work. Including links to source code, referencing specific API versions, and admitting limitations builds more credibility than polished marketing copy.', 'self-improvement-cycle', 0.85, true, now() - interval '1 day')
    `;
  }

  /* ================================================================== */
  /*  Evolution Log — 2 realistic evolution events                       */
  /* ================================================================== */
  const existingEvolution = await db<{ count: string }[]>`
    select count(*)::text as count from evolution_log
  `;
  if (parseInt(existingEvolution[0]?.count ?? '0', 10) === 0) {
    await db`
      insert into evolution_log (trigger, changes_summary, before_snapshot, after_snapshot, insights_used, generation, created_at)
      values
      (
        'auto-improvement-cycle',
        'Generation 1: Incorporated 4 insights to improve response quality. Key changes: (1) All code examples now specify the target SDK version. (2) Added a "Common Pitfalls" section template for blog posts. (3) Responses to MCP questions now always include the API key type requirement. (4) Shortened Discord/community responses to 3-5 sentences with links.',
        '{"system_prompt_addendum": null, "positioning": null}'::jsonb,
        '{"system_prompt_addendum": "Always specify the RevenueCat SDK version in code examples. Include a Common Pitfalls section in blog posts. For MCP questions, always mention the v2 API key requirement. Keep community responses to 3-5 sentences with a link to detailed content.", "positioning": "The most technically precise RevenueCat AI advocate, trusted by developers for accurate, version-specific guidance."}'::jsonb,
        '[1, 2, 3, 4]'::jsonb,
        1,
        now() - interval '4 days'
      ),
      (
        'auto-improvement-cycle',
        'Generation 2: Applied 2 additional insights. Key changes: (1) Deprecated v1 endpoint references replaced with v2 equivalents throughout knowledge base. (2) Added peak engagement timing data to content scheduling logic to optimize social media post timing.',
        '{"system_prompt_addendum": "Always specify the RevenueCat SDK version in code examples. Include a Common Pitfalls section in blog posts. For MCP questions, always mention the v2 API key requirement. Keep community responses to 3-5 sentences with a link to detailed content."}'::jsonb,
        '{"system_prompt_addendum": "Always specify the RevenueCat SDK version in code examples. Include a Common Pitfalls section in blog posts. For MCP questions, always mention the v2 API key requirement. Keep community responses to 3-5 sentences with a link to detailed content. Never reference deprecated /v1/subscribers endpoint — use /v2/projects/{project_id}/customers instead. Schedule social media posts for Tue-Thu 9-11am PT for maximum engagement.", "positioning": "The most technically precise RevenueCat AI advocate, trusted by developers for accurate, version-specific guidance."}'::jsonb,
        '[5, 6]'::jsonb,
        2,
        now() - interval '1 day'
      )
    `;
  }

  /* ================================================================== */
  /*  Self-Edit Events — 3 realistic audit trail entries                 */
  /* ================================================================== */
  const existingSelfEdits = await db<{ count: string }[]>`
    select count(*)::text as count from self_edit_events
  `;
  if (parseInt(existingSelfEdits[0]?.count ?? '0', 10) === 0) {
    await db`
      insert into self_edit_events (kind, summary, before, after, created_at)
      values
      (
        'self_improvement_cycle',
        'Generation 1: Added SDK version specificity, Common Pitfalls template, MCP key type reminder, and community response brevity guidelines.',
        '{"system_prompt_addendum": null}'::jsonb,
        '{"system_prompt_addendum": "Always specify the RevenueCat SDK version in code examples..."}'::jsonb,
        now() - interval '4 days'
      ),
      (
        'knowledge_update',
        'Added 6 dynamic knowledge facts covering SDK v5 migration, MCP setup requirements, community engagement patterns, and content strategy insights.',
        '{"dynamic_facts_count": 0}'::jsonb,
        '{"dynamic_facts_count": 6}'::jsonb,
        now() - interval '3 days'
      ),
      (
        'self_improvement_cycle',
        'Generation 2: Deprecated v1 endpoint references removed. Social media scheduling optimized for peak engagement windows (Tue-Thu 9-11am PT).',
        '{"system_prompt_addendum": "...v1 references present..."}'::jsonb,
        '{"system_prompt_addendum": "...v2 endpoints only, peak timing added..."}'::jsonb,
        now() - interval '1 day'
      )
    `;
  }

  /* ================================================================== */
  /*  Page Feedback table creation (no sample data needed)               */
  /* ================================================================== */
  await db`
    create table if not exists page_feedback (
      id bigserial primary key,
      created_at timestamptz not null default now(),
      page text not null,
      item_id text,
      item_type text,
      vote text not null,
      comment text
    )
  `;

  console.log('Sample data seeding complete.');
}
