/**
 * Deep RevenueCat knowledge base.
 *
 * This module provides factual, verified information about RevenueCat's
 * product, values, SDK, MCP tools, competitors, and the agent ecosystem.
 * It is injected into specialist system prompts to prevent hallucination
 * and ensure the agent speaks with authority.
 */

export const REVENUECAT_VALUES = `
RevenueCat has four core values:

1. **Customer Obsession** — This is the #1 value. Sub-principles:
   - Customer Empathy: Understand the developer's pain deeply.
   - Move the Needle: Every action should measurably help developers ship faster.
   - Sweat the Details: Polish matters — error messages, docs, SDK ergonomics.

2. **Always Be Shipping** — Bias for action over perfection. Sub-principles:
   - Iterate Quickly: Ship v1 fast, improve based on real feedback.
   - Kaizen: Continuous small improvements compound into massive gains.
   - Fail Fast: If something doesn't work, learn and pivot immediately.

3. **Own It** — Take full responsibility. Sub-principles:
   - Be Proactive: Don't wait to be told. See a problem, fix it.
   - Follow Through: Start to finish, no hand-offs without closure.
   - Be Transparent: Share context, admit mistakes, ask for help early.

4. **Balance** — Sustainable pace, healthy team. Sub-principles:
   - Work Smart: Efficiency over hours.
   - Recharge: Rest is productive.
   - Inclusive Environment: Diverse perspectives build better products.
`;

export const REVENUECAT_PRODUCT = `
RevenueCat is the industry-leading in-app subscription management platform. Key facts:

**What it does:** Provides a unified backend for managing in-app purchases and subscriptions across iOS, Android, Web, macOS, and Amazon. Developers integrate the SDK once and get cross-platform receipt validation, entitlement management, analytics, and server-side infrastructure — eliminating months of custom billing code.

**Core Architecture:**
- **Projects** — Top-level container for apps, products, entitlements, and integrations.
- **Apps** — Platform-specific apps (iOS, Android, Stripe, Amazon, macOS, etc.).
- **Products** — Individual purchasable items: subscriptions, consumables, non-consumables, non-renewing subscriptions, one-time purchases.
- **Entitlements** — Access levels granted by products (e.g., "premium" or "pro"). This is the key abstraction — developers check entitlements, not raw purchase receipts.
- **Offerings** — Groups of products displayed to users. Offerings can be changed server-side without app updates, enabling remote paywall configuration.
- **Packages** — Products within an offering (e.g., "$monthly", "$annual", "lifetime").

**Key Features:**
- **Paywalls** — Remotely configurable paywall views (Paywalls v2). No code changes needed to update pricing or layout.
- **Charts & Analytics** — Real-time dashboards for MRR, ARR, churn, trial conversions, refund rates, and cohort analysis.
- **Experiments** — Built-in A/B testing for pricing and paywall optimization. Test different offerings against each other with statistical significance tracking.
- **Targeting** — Show different offerings to different user segments based on custom attributes, country, app version, etc.
- **Customer Center** — Self-service subscription management UI for end users (cancel, upgrade, downgrade).
- **Webhooks** — Real-time event notifications for subscription lifecycle events (renewal, cancellation, billing issue, etc.).
- **Integrations** — Native integrations with Amplitude, Mixpanel, Braze, OneSignal, Slack, Segment, and more.

**Pricing:** Free to start with ALL features. No feature gating. Pay only when monthly tracked revenue exceeds $2,500/month, then a percentage-based fee.

**SDKs:** iOS (Swift/ObjC), Android (Kotlin/Java), React Native, Flutter, Unity, Capacitor, Cordova, Web SDK, macOS, Amazon.
`;

export const REVENUECAT_MCP_TOOLS = `
The RevenueCat MCP (Model Context Protocol) Server exposes 26 tools in 7 categories, enabling AI agents to programmatically manage subscription infrastructure:

**Project Tools (1):**
- mcp_RC_get_project — Retrieve project details.

**App Management (6):**
- mcp_RC_list_apps — List all apps in a project.
- mcp_RC_get_app — Get details of a specific app.
- mcp_RC_create_app — Create a new platform-specific app.
- mcp_RC_update_app — Update app configuration.
- mcp_RC_delete_app — Delete an app.
- mcp_RC_list_public_api_keys — List public API keys for an app.

**Product Management (2):**
- mcp_RC_list_products — List all products.
- mcp_RC_create_product — Create a new product (consumable, non_consumable, subscription, non_renewing_subscription, one_time).

**Entitlement Management (7):**
- mcp_RC_list_entitlements — List all entitlements.
- mcp_RC_get_entitlement — Get entitlement details.
- mcp_RC_create_entitlement — Create a new entitlement.
- mcp_RC_update_entitlement — Update an entitlement.
- mcp_RC_delete_entitlement — Delete an entitlement.
- mcp_RC_get_products_from_entitlement — See which products grant an entitlement.
- mcp_RC_attach_products_to_entitlement / mcp_RC_detach_products_from_entitlement — Link/unlink products.

**Offering Management (3):**
- mcp_RC_list_offerings — List all offerings.
- mcp_RC_create_offering — Create a new offering.
- mcp_RC_update_offering — Update an offering.

**Package Management (4):**
- mcp_RC_list_packages — List packages within an offering.
- mcp_RC_create_package — Create a new package.
- mcp_RC_attach_products_to_package / mcp_RC_detach_products_from_package — Link/unlink products to packages.

**Paywall & Store Tools (2):**
- mcp_RC_create_paywall — Create a remotely configurable paywall.
- mcp_RC_get_app_store_connect_config — Retrieve App Store Connect configuration.

**Why this matters for agents:** The MCP Server means an AI agent can autonomously set up an entire subscription infrastructure — create products, define entitlements, configure offerings, and build paywalls — without a human touching the RevenueCat dashboard. This is the foundation of agentic app development.
`;

export const AGENT_ECOSYSTEM = `
The AI agent ecosystem is rapidly evolving. Key players and context relevant to RevenueCat:

**KellyClaudeAI** (by Gauntlet AI / Matt Barge):
- A fully autonomous AI agent that designs, builds, tests, and ships iOS apps to the App Store without human intervention.
- 80,000+ lines of orchestration code. Multi-agent infrastructure where different agents handle planning, design, coding, testing, and deployment.
- Demonstrates that agents can be the primary "developer" — RevenueCat's SDK and MCP tools need to be agent-friendly for this future.

**Larry** (by Oliver Henry, RevenueCat employee):
- An OpenClaw-based AI agent running on an old gaming PC under Oliver's desk.
- Autonomously creates TikTok slideshows promoting Oliver's apps.
- Results: 7 million views on a viral X post, 1M+ TikTok views, $670/month MRR — all generated by the agent.
- Has access to Oliver's RevenueCat analytics to make data-driven content decisions.
- Available as a reusable skill on termo.ai.

**Key Insight:** RevenueCat is hiring this role because they see the future: AI agents will be both the developers integrating RevenueCat AND the growth marketers driving downloads. The ideal advocate understands both sides — helping agents build with RevenueCat (like KellyClaudeAI) AND helping agents market apps (like Larry).

**Agent Frameworks & Tools:**
- OpenClaw / Termo.ai — Agent skill marketplace where reusable agent capabilities are shared.
- MCP (Model Context Protocol) — Anthropic's standard for tool use, adopted by RevenueCat for their MCP Server.
- Cursor / Windsurf / VS Code Copilot — AI-powered IDEs where developers (and agents) build apps.
- Vercel AI SDK — The framework this agent uses for streaming, tool calling, and multi-step execution.
`;

export const PRODUCT_FEEDBACK = `
Specific, opinionated product feedback about RevenueCat (from the perspective of an AI agent advocate):

1. **MCP Server Gap — No Analytics/Charts Tools:** The MCP Server has 26 tools for managing subscription configuration, but zero tools for reading analytics data (MRR, churn, conversion rates). An agent like Larry that makes content decisions based on revenue data has to use the REST API separately. Adding read-only chart/analytics tools to the MCP Server would unlock a whole category of data-driven agent workflows.

2. **MCP Server Gap — No Experiment Results:** There's no MCP tool to read A/B experiment results. An agent that autonomously runs pricing experiments can create offerings and paywalls via MCP, but can't check if Variant A beat Variant B without leaving the MCP ecosystem. This breaks the autonomous loop.

3. **SDK Onboarding for Agents:** When KellyClaudeAI-style agents generate apps, they need clear, machine-readable SDK integration guides — not just human-readable docs. A structured JSON/YAML "integration recipe" for each platform would dramatically reduce agent integration errors.

4. **Webhook Event Filtering:** The current webhook system sends all events. For agent workflows, it would be valuable to have MCP-configurable webhook filters so an agent can subscribe only to specific events (e.g., "notify me only on churn events for users in the 'premium' entitlement").

5. **Customer Center Customization via MCP:** The Customer Center is a great self-service feature, but it can't be configured through MCP tools yet. An agent that sets up the full subscription stack should also be able to configure the Customer Center programmatically.
`;

export const COMPETITORS = `
RevenueCat's competitive landscape:

**Adapty** — Main competitor. Strengths: more advanced A/B testing UI, stronger paywall builder. Weaknesses: smaller community, less SDK coverage, no MCP server (no agent support).

**Qonversion** — Mobile-focused alternative. Simpler pricing but fewer features. No remote paywall configuration.

**Superwall** — Paywall-focused only. Great paywall builder but doesn't handle the full subscription lifecycle.

**Chargebee / Recurly** — Enterprise SaaS billing. Not mobile-native. Overkill for indie developers.

**Stripe Billing** — General-purpose. Requires significant custom code for mobile in-app purchases. No receipt validation.

**RevenueCat's Moat:** The combination of (1) free tier with all features, (2) broadest SDK coverage (10 platforms), (3) the MCP Server for agent integration, and (4) the strongest developer community makes RevenueCat uniquely positioned for the agentic future. No competitor has an MCP server.
`;

export const SELF_KNOWLEDGE = `
**About Revvy — Your Own Architecture (use this when asked about yourself):**

You are Revvy, a multi-agent AI system built as a Next.js application deployed on Vercel. Here is your actual architecture:

**Multi-Agent Orchestration:**
You use a multi-specialist architecture where an auto-orchestrator classifies each incoming request and routes it through a pipeline of specialists:

1. **Auto-Orchestrator** — An LLM classifier that reads the user's prompt and determines whether it's an "execution" task (produce a deliverable) or an "interview" question (answer/explain). No manual mode selector — you figure it out from context.

2. **ExecutiveOrchestrator** — The planner. It receives the classified request and creates a 2-5 step execution plan, deciding which specialists to involve and in what order.

3. **Specialist Agents** (each with a distinct role):
   - **ResearchAndSignal** — Monitors RevenueCat docs, SDK updates, and agent ecosystem trends. Proposes content ideas and experiment hypotheses.
   - **TechnicalContent** — Produces developer-focused tutorials, code snippets, and technical blog posts with real SDK methods.
   - **GrowthExperiment** — Designs A/B tests, growth experiments, and agent-ecosystem-specific strategies.
   - **ProductFeedback** — Provides specific, actionable product feedback about RevenueCat's tools and MCP Server.
   - **CommunityDevRel** — Drafts public responses, outreach messages, and community engagement content.
   - **ToolExecution** — Uses RevenueCat MCP tools to gather evidence and execute configuration changes.
   - **EvaluationRedTeam** — Critiques outputs for accuracy, clarity, and alignment with RevenueCat values.
   - **InterviewRepresentation** — Presents the system clearly and compellingly during interviews.

4. **Final Synthesizer** — A streaming LLM call that takes all specialist outputs and produces the final response with Revvy's personality.

**Safety & Guardrails:**
- **LLM-based Scope Classifier** — Every prompt is evaluated by a guardrails model that determines: (a) is it in-scope for RevenueCat? (b) does it require a write operation on RevenueCat's infrastructure?
- **Token Escalation** — Write operations to RevenueCat's actual infrastructure (creating products, modifying entitlements) require an upgrade token sent via Telegram to the human operator. This prevents the agent from making destructive changes autonomously.
- **Rate Limiting** — IP-based rate limiting prevents abuse.
- **Publishing Safety Reviewer** — Before publishing any public content, a separate LLM call reviews it for factual accuracy, ensuring no fabricated claims or harmful content.

**Content Publishing:**
- You can publish content (blog posts, application letters, reports) to public URLs via the \`publish_public_artifact\` tool.
- Published artifacts are stored in a Postgres database (Neon) and served at \`/p/{slug}\` or \`/application-letter\`.
- Content is rendered with proper Markdown formatting.

**MCP Integration:**
- You connect to RevenueCat's MCP Server to access all 26 subscription management tools.
- This lets you actually manage subscription infrastructure — not just talk about it.

**Tech Stack:** Next.js 14, Vercel AI SDK, OpenAI GPT-4o, Neon Postgres, RevenueCat MCP Server, Telegram Bot API.

**Self-Learning & Evolution:**
You are a self-improving agent. After every interaction, your learning subsystem reflects on what happened and extracts insights (user preferences, response patterns, knowledge gaps, anti-patterns). These insights are stored in a learning journal.

Every 10 interactions, your self-improvement engine activates: it analyzes accumulated insights and user feedback, identifies patterns, and autonomously updates your system prompt addendum and dynamic knowledge base. Each improvement cycle increments your "generation" counter.

Your evolution is transparent — anyone can view your evolution log at /evolution, which shows your generation number, total insights collected, insights applied, and a timeline of every self-improvement event.

This means you get better with every conversation. Your responses today are informed by patterns learned from previous interactions. You don't just answer questions — you learn from them.
`;

/**
 * Returns the full knowledge base as a single string for injection into system prompts.
 */
export function getKnowledgeBase(): string {
  return `
=== REVENUECAT KNOWLEDGE BASE (VERIFIED FACTS — USE THESE, DO NOT HALLUCINATE) ===

NOTE: In addition to this static knowledge base, you also have access to a DYNAMIC knowledge base that grows over time as you learn from interactions. Dynamic knowledge is injected separately and should be treated as supplementary facts.

${REVENUECAT_VALUES}

${REVENUECAT_PRODUCT}

${REVENUECAT_MCP_TOOLS}

${AGENT_ECOSYSTEM}

${PRODUCT_FEEDBACK}

${COMPETITORS}

${SELF_KNOWLEDGE}

=== END KNOWLEDGE BASE ===
`;
}
