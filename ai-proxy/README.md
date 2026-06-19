# NoMoreBets AI Proxy

This backend is the cost-control layer for NoMoreBets AI chat.

The mobile app must never call OpenAI/Groq directly. It should call:

```text
POST /ai/chat
```

The proxy verifies RevenueCat membership, blocks non-annual AI use, enforces monthly annual quotas, grants add-on credits from RevenueCat non-subscription purchases, enforces a whole-app monthly budget, caps output tokens, and only then calls the AI provider.

## Product Policy

Launch policy:

```text
Monthly Pro ($4.99/month): no AI access, basic Pro features only.
Annual Pro ($34.99/year): all Pro features plus 100 base AI chats per month.
No daily AI limit.
After 100 monthly AI chats: user must buy an AI add-on pack.
Add-on credits do not reset monthly. They are consumed by usage until empty.
If add-on credit remains when a new month starts, the server keeps using the add-on credit first.
After that add-on credit reaches 0, the current month's 100 base AI chats become available.
Emergency/local replies cost $0 and do not consume AI quota.
```

Example add-on:

```text
AI add-on $10 purchase -> backend grants $3 AI cost credit.
AI calls reserve RESERVED_COST_PER_AI_CALL_CENTS from that credit.
When credit reaches 0, the user must buy another pack.
```

Billing order:

```text
1. If add-on credit is greater than 0, consume add-on credit first.
2. If add-on credit is 0, use the current month's 100 annual base chats.
3. If both are used, require another add-on pack.
```

This protects the app from losing money because subscription AI is capped and extra use is prepaid.

## Required Production Environment

Copy `.env.example` to `.env` and fill:

```text
AI_ENABLED=true
AI_PROVIDER=openai
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-4o-mini
REQUIRE_REVENUECAT_PRO=true
REVENUECAT_SECRET_KEY=...
REVENUECAT_ENTITLEMENT_ID=NO MORE BETS Pro
MONTHLY_PRODUCT_IDS=your_monthly_product_id
ANNUAL_PRODUCT_IDS=your_annual_product_id
ANNUAL_MONTHLY_AI_LIMIT=100
AI_ADDON_10_PRODUCT_IDS=your_ai_addon_10_product_id
AI_ADDON_10_CREDIT_CENTS=300
GLOBAL_MONTHLY_BUDGET_CENTS=500
RESERVED_COST_PER_AI_CALL_CENTS=1
```

If `REQUIRE_REVENUECAT_PRO=true` and `REVENUECAT_SECRET_KEY` is missing, AI calls are denied. This is intentional.

## Cost Controls

The server has four independent protections:

1. Monthly Pro users cannot use AI.
2. Annual Pro users get only `ANNUAL_MONTHLY_AI_LIMIT` base AI chats per month.
3. Add-on credit carries across months and is consumed before the current month's base chats.
4. `GLOBAL_MONTHLY_BUDGET_CENTS` stops the whole app if total AI spending reaches your safety budget.

Recommended first launch values:

```text
ANNUAL_MONTHLY_AI_LIMIT=100
GLOBAL_MONTHLY_BUDGET_CENTS=500
RESERVED_COST_PER_AI_CALL_CENTS=1
MAX_OUTPUT_TOKENS=180
```

With `GLOBAL_MONTHLY_BUDGET_CENTS=500`, the app stops AI at about $5 reserved spend for the entire app that month. Raise this only after you see real usage and revenue.

## Run Locally

```powershell
npm install
copy .env.example .env
npm start
```

Health check:

```text
http://localhost:8787/health
```

## App Request

After deployment, set the app's `AI_PROXY_URL` to:

```text
https://your-domain.example.com/ai/chat
```

The mobile app should send:

```json
{
  "appUserId": "RevenueCat app user id",
  "messages": [
    { "role": "user", "content": "I want to gamble" }
  ]
}
```

Successful responses include remaining usage:

```json
{
  "reply": "...",
  "usage": {
    "plan": "annual",
    "monthlyLimit": 100,
    "monthlyUsed": 12,
    "monthlyRemaining": 88,
    "addonCreditCentsRemaining": 300,
    "usingAddonBeforeMonthlyQuota": true
  }
}
```

If the annual quota is used and no add-on credit exists, the backend returns:

```json
{
  "error": "addon_required",
  "needsAddon": true
}
```

## Deploy

Deploy this as a single-instance Node service with persistent disk, or replace the JSON ledger with Redis/Postgres before serverless deployment.

Good first deployment targets:

- Render Web Service with persistent disk
- Railway service with persistent volume
- VPS

Avoid deploying this exact JSON-ledger version to multi-instance/serverless hosting unless you replace the ledger with Redis/Postgres. Multiple instances could each keep separate budgets.
