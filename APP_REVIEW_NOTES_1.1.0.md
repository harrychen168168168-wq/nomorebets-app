# App Review Notes - NO MORE BETS 1.1.0

## Overview
NO MORE BETS is a gambling recovery support app. It helps users track gambling-free days, record relapse triggers, use emergency urge-control tools, keep personal goals, and access support hotlines.

## Sign-in
The app uses Supabase-backed accounts with three options on the login screen:
- Email + password
- Sign in with Apple
- Sign in with Google

An account is required because the app cloud-syncs the user's private recovery data across devices and supports one-to-one guardian sharing.

Demo account for review:
- Email: [FILL IN a real test account email created in App Store Connect]
- Password: [FILL IN the real password]

Admin mode: the admin entry appears only for the developer's own configured admin email and additionally requires a local PIN. It is an operator-only screen showing aggregate stats and moderation status; it does not expose private user diary content, contact phone numbers, future letters, or other sensitive recovery records. It is not needed for review.

## Subscription
The app uses RevenueCat for subscription status and App Store auto-renewable subscriptions. All plans include a 7-day free trial configured in App Store Connect. The paywall includes Restore Purchases, Manage Subscription, Privacy Policy, and Terms links, plus clear Apple auto-renewal wording.

Plans:
- Personal plan (monthly): com.nomorebets.app.monthly
- Family guardian plan (yearly): com.nomorebets.app.yearly
- Mutual guardian plan (yearly): com.nomorebets.app.mutual_yearly
- AI credit pack (consumable): nomorebets_ai_addon_999

RevenueCat entitlement configured in the app:
- NO MORE BETS Pro

The app also accepts common entitlement identifiers such as pro/premium if the RevenueCat dashboard uses those names, to avoid reviewer lockout caused by naming mismatch.

## Account deletion
Account deletion is available in:
Profile > 隐私与安全 > 删除账号与本机数据

This calls a server-side function that fully deletes the auth user and their cloud rows, then clears local data and signs out. App Store subscriptions must be managed separately by the user in Apple ID subscription settings, and the app states this explicitly.

## AI / Emergency support
The app does not include an AI provider API key in the client. AI requests go through a developer-owned backend proxy (AI_PROXY_URL). If the proxy is unreachable, the app provides local emergency support responses so the emergency flow remains usable.

The app is not a medical service, therapy service, crisis hotline, or emergency service. When users enter crisis/self-harm language, the app guides them to call 988, 911, or contact trusted real people immediately.

## User Generated Content / Stories
The story wall shows only moderated gambling-recovery stories. Daily records are private by default and are never automatically published. If a user chooses to share a story, it is submitted as pending and must be approved before it can appear publicly.

Moderation (approve/reject/hide/delete, report handling, user sanctions) is performed server-side through a secured Supabase Edge Function; the in-app admin screen only displays aggregate stats and moderation status.

When there are not enough approved user stories, the app seeds the wall with a small set of pre-written example recovery stories created by the developer and shown under fixed pseudonyms. These are educational example content (composite recovery scenarios, not data from real identifiable users) and contain no gambling promotion, platform names, casino references as endorsement, or gambling tips.

The story UI does not include free-form comments, private messages, group chat, or rankings. It only allows fixed encouragement reactions and a report button.

## Test path
1. Launch the app.
2. Sign in with the demo account above (or use Sign in with Apple).
3. Complete the short profile setup (nickname + quit date).
4. Home: test the daily check-in.
5. Emergency: test the countdown / support flow.
6. Records: add/edit a daily record and select previous dates from the calendar.
7. Hope: view the story wall and milestones; add a goal/contact if desired.
8. Profile: test the paywall, restore purchase, privacy links, and account deletion.
