# App Review Notes - NO MORE BETS 1.1.0

## Overview
NO MORE BETS is a gambling recovery support app. It helps users track gambling-free days, record relapse triggers, use emergency urge-control tools, keep personal goals, and access support hotlines.

## Sign-in
This version includes a local account sign-in flow. Reviewers can test with any email address.

Suggested reviewer user account:
- Email: reviewer@example.com
- Password: not required

Suggested admin demo account:
- Email: harrychen168168168@gmail.com
- Password: not required

The admin mode is only visible to configured admin emails. The current admin screen shows local aggregate stats and management placeholders only. It does not expose private user diary content, contact phone numbers, future letters, or other sensitive recovery records.

## Subscription
The app uses RevenueCat for subscription status and App Store auto-renewable subscriptions. The 3-day free trial is configured in App Store Connect. The paywall includes Restore Purchases, Manage Subscription, Privacy Policy, and Terms links. Build 3 also includes clearer Apple auto-renewal wording and improved subscription error handling.

RevenueCat entitlement configured in the app:
- NO MORE BETS Pro

The app also accepts common entitlement identifiers such as pro/premium if the RevenueCat dashboard uses those names, to avoid reviewer lockout caused by naming mismatch.

## Account deletion
Account deletion is available in:
Profile > Privacy & Safety > Delete account and local data

This deletes the local account and local recovery records on the device. App Store subscriptions must be managed separately by the user in Apple ID subscription settings.

## AI / Emergency support
The app no longer includes an AI provider API key in the client app. AI requests are designed to go through a developer-owned backend proxy via AI_PROXY_URL. If no proxy is configured, the app provides local emergency support responses so the emergency flow remains usable.

The app is not a medical service, therapy service, crisis hotline, or emergency service. When users enter crisis/self-harm language, the app guides them to call 988, 911, or contact trusted real people immediately.

## User Generated Content / Stories
The story wall is designed for moderated gambling-recovery stories only. Daily records are private by default and are never automatically published. If a user chooses to share a story, it is submitted as pending and must be approved by an administrator before it can appear publicly.

The public story UI does not include free-form comments, private messages, group chat, rankings, gambling tips, platform names, or casino promotion. It only allows fixed encouragement reactions and a report button. Reports can be reviewed in the administrator screen.

AI companion stories are clearly labeled as AI companion stories and are not presented as real user stories. They are used only as startup filler when there are not enough approved user stories.

The Supabase setup file documents the database tables, moderation flow, and the requirement to use server-side permissions or Supabase Edge Functions for production moderation writes.

## Test path
1. Launch the app.
2. Sign in with reviewer@example.com or continue as guest.
3. Test Home daily check-in.
4. Open Emergency and test countdown / support flow.
5. Open Records, add/edit a daily record, and select previous dates from the calendar.
6. Open Hope and add a goal/contact if desired.
7. Open Profile, test paywall, restore purchase, privacy links, and account deletion.
8. Sign in with the admin demo email to confirm the Admin Center entry appears.
