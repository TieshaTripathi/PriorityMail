# Product Plan

## Product promise
PriorityMail tells a user only about emails that deserve attention, explains why, and gets them to the original message in one tap.

## Phase 1 — Working MVP
1. Google OAuth sign in
2. Read-only Gmail connection
3. Rules for label, sender, domain, keyword
4. Priority inbox
5. VIP senders
6. Classification reason
7. Open original Gmail thread
8. Push notification plumbing

## Phase 2 — Event-driven Gmail
1. Gmail Watch
2. Google Cloud Pub/Sub webhook
3. Fetch changed messages
4. De-duplicate message events
5. Run priority engine
6. Push via FCM/APNs

## Phase 3 — Personal AI
The model produces structured output:
- important: boolean
- urgency: low/medium/high
- category: work/college/personal
- action_type: reply/submit/review/approve/attend/decide/fyi
- deadline: optional datetime
- reason: short explanation
- confidence: 0..1

Rules remain as hard overrides. AI acts as a second layer, not a replacement.

## Phase 4 — Learning
Use explicit user feedback:
- "Always notify me for this sender"
- "Don't notify me about emails like this"
- "This was important"
- "This wasn't important"

Never silently infer sensitive personal traits from email content.
