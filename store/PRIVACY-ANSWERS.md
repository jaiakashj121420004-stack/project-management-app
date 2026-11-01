# Privacy / data-safety answers (Google Play Data safety + Apple App Privacy)

Answers reflect what the app does today. Re-check if analytics, ads or SDKs change.

## What Jotspring collects
| Data | Why | Linked to user | Shared with third parties |
|---|---|---|---|
| Email address, display name | Account + sign-in | Yes | No (Supabase hosts it as our processor) |
| User content (boards, cards, notes, canvas, uploaded files) | Core app function | Yes | No (processor only) |
| Purchase history / subscription status | Unlock Pro/Team | Yes | RevenueCat + Apple/Google process purchases |
| Device push token | Send reminders | Yes | Google Firebase Cloud Messaging delivers it |
| Product-interaction events (funnel events like "signup_completed"; no page-view tracking, no session replay) | Understand the sign-up funnel | Anonymous id; not used for tracking | No |
| Crash/diagnostic logs | — | — | **Not collected** (no crash SDK) |
| Location, contacts, photos library, health, financial info, browsing history | — | — | **Not collected** |

No advertising, no ad SDKs, no data sold, no cross-app tracking.

## Google Play — Data safety form
- Does the app collect or share user data? **Yes (collects), shares only with service providers.**
- Data encrypted in transit: **Yes (HTTPS/TLS).**
- Users can request deletion: **Yes** — in-app (Profile → Delete account) and web: https://jotspring.nvexis.com (same flow, signed in). Enter that URL in the "Delete account URL" field.
- Data types to tick: **Personal info → Email address, Name** · **App activity → In-app actions** (funnel events) · **Files and docs / Other user-generated content** · **Financial info → Purchase history** · **Device or other IDs** (push token).
- For each: Collected = yes, Shared = no (service providers acting for us are not "sharing"), Required = yes except push token and analytics (optional), Purpose = App functionality (+ Analytics for events).
- Ads: **No.** Target audience: **18+ / general audience, not designed for children.**
- Content rating (IARC questionnaire): no violence, no sexual content, no gambling, no user-to-user public content discovery; users can share boards privately by invitation → answer "users can interact: yes (limited, invite-only)". Expected rating: **Everyone / PEGI 3** (may become Teen if the questionnaire flags user-shared content).

## Apple — App Privacy ("nutrition label")
- **Data Used to Track You:** none. (No tracking → no ATT prompt needed.)
- **Data Linked to You:** Contact Info (Email Address, Name) — App Functionality; User Content (Other User Content) — App Functionality; Purchases (Purchase History) — App Functionality; Identifiers (Device ID: push token) — App Functionality; Usage Data (Product Interaction) — Analytics.
- **Data Not Collected:** everything else.
- Privacy Policy URL: https://jotspring.nvexis.com/privacy
- Age rating: answer **None** to every content question → **4+** (user-generated content: invite-only collaboration; no public feed).
- Export compliance: `ITSAppUsesNonExemptEncryption = false` is already set (app only uses standard HTTPS).
- Sign in with Apple: **not required** — the iOS app offers email + password only (Google sign-in is hidden in the native apps). If you add Google/Apple sign-in to the native apps later, Sign in with Apple becomes mandatory.

## Legal pages — must say (check the live /privacy text)
Names Nvexis as controller, lists the data above, names processors (Supabase, RevenueCat, Firebase/Google, Resend, Cloudflare, Dodo Payments for web purchases), explains deletion (in-app + email request), states the minimum age 13 (or 16 in the EU), and gives the support email.
