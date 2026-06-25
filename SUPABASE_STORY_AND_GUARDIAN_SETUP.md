# Supabase Story / Guardian Setup

This app now has client flows for public recovery stories, reports, moderation screens, and guardian invite links.

## Required app env

Set these for Expo before building:

```text
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
EXPO_PUBLIC_SUPABASE_FUNCTIONS_URL=https://your-project-ref.functions.supabase.co
```

Without these values, the app will not pretend cross-user stories are live. It will show AI companion stories only and explain that Supabase is not configured.

For local admin testing only, you may set:

```text
EXPO_PUBLIC_ADMIN_FUNCTION_SECRET_FOR_LOCAL_TESTS=temporary-test-secret
```

Do not ship a real production admin secret inside the Expo app.

## Database

Run:

```text
supabase/schema.sql
```

Tables included:

- `public_stories`
- `story_reactions`
- `story_reports`
- `guardian_invites`
- `guardian_links`
- `guardian_shared_status`
- `subscription_memberships`
- `ai_quota_groups`
- `app_notifications`
- `user_sanctions`
- `moderation_logs`

## Security boundary

The Expo app must never contain a Supabase service role key.

The included SQL allows basic public story reads and user submissions through the anon key. Sensitive operations are implemented as Edge Functions:

- `community-admin`: approve/reject/hide/delete stories, resolve reports, restrict/block users.
- `guardian`: create/accept/cancel one-to-one invite relationships and write cancellation notifications.
- `revenuecat-webhook`: sync RevenueCat subscription events into `subscription_memberships` and `ai_quota_groups`.

Production admin calls must be protected by server-side auth. The sample function currently requires `ADMIN_API_SECRET`. Do not put that secret in a public client build.

## Edge Function secrets

Set these in Supabase:

```text
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
ADMIN_API_SECRET=long-random-admin-secret
REVENUECAT_WEBHOOK_SECRET=long-random-webhook-secret
ALLOW_LOCAL_APP_USER_IDS=true
MONTHLY_PRODUCT_IDS=com.nomorebets.app.monthly
ANNUAL_PRODUCT_IDS=com.nomorebets.app.yearly
MUTUAL_PRODUCT_IDS=com.nomorebets.app.mutual_yearly
MONTHLY_AI_LIMIT=50
ANNUAL_MONTHLY_AI_LIMIT=100
```

`ALLOW_LOCAL_APP_USER_IDS=true` is for the current local-auth appUserId model. If you later migrate to Supabase Auth, turn this off and validate the JWT user inside the function.

## AI proxy env for shared quota

Set these on the AI proxy:

```text
USE_SUPABASE_AI_GROUPS=true
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

With this enabled:

- Family guardian invited users consume the payer's shared AI quota group.
- Mutual guardian invited users get their own quota key, while their access validity follows the payer's active mutual subscription.

## Subscription / guardian rules

- Personal monthly plan: $9.99/month, 50 AI chats/month, no invitation sharing.
- Family guardian plan: one family member invites one protected user. It is one-way sharing. Both users share one AI monthly quota pool when backend quota grouping is added.
- Mutual guardian plan: one-to-one peer support. Both users can see non-private recovery status. The invited partner gets a separate AI quota key, but access validity follows the payer.
- Either side can cancel sharing at any time. The app writes an `app_notifications` row for the other side.

## Shared vs private data

Shared:

- Today recorded or not
- Today high-risk/gambling status
- Mood
- Impulse level
- Streak
- Emergency/high-risk signal

Not shared:

- Full daily note text by default
- Money amounts
- Exact address or location
- Phone, email, real name
- Important contacts
- Future letter
- Private stories
- AI chat messages

## Public story rules

- Daily records are private by default.
- Story drafts must be submitted manually.
- User stories are `pending` until admin approval.
- Only `approved` stories appear on the home page or story wall.
- AI companion stories are always labeled `AI 陪伴故事`.
- No free comments, private messages, group chat, ranking, or gambling tips.
