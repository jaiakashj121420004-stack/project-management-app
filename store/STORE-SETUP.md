# Store setup — order of operations

Everything below the dashed line needs a paid developer account (blocked on DUNS, ~30 days). Everything above is done or can be done now.

## Done in this repo
- Capacitor wrapper: `capacitor.config.ts`, `android/`, `ios/` (SPM, no CocoaPods), icons + splash from the Jotspring logo.
- Store billing: `entitlements` table, `revenuecat-webhook`, in-app purchase flow (iOS/Android only; web + Windows keep Dodo).
- Push: `push_tokens` table, `send-native-push` (FCM → Android + iOS), device registration.
- CI: `codemagic.yaml` (iOS → TestFlight, Android → Play bundle).

## You can do now (free)
1. **Codemagic** (codemagic.io): sign up with GitHub, add the repo, choose "codemagic.yaml". Free tier gives macOS minutes.
2. **Firebase** (console.firebase.google.com): create project "Jotspring"; add an Android app `com.nvexis.jotspring` and an iOS app `com.nvexis.jotspring`; download `google-services.json` and `GoogleService-Info.plist`. Cloud Messaging is on by default. Create a service account key (Project settings → Service accounts → Generate new private key) → Supabase secret `FCM_SERVICE_ACCOUNT` (paste the whole JSON). Also check the `CRON_SECRET` secret already exists (same one send-due-reminders uses).
3. **RevenueCat** (revenuecat.com): create project "Jotspring"; add the iOS and Android apps (it will ask for store credentials later — skip for now); create entitlements `pro` and `team`; create offerings `pro` and `team` with `$rc_monthly` / `$rc_annual` packages (products come after the store accounts exist). Webhooks → add URL `https://rpwklsrdfqyisogbcdgg.supabase.co/functions/v1/revenuecat-webhook` with an Authorization header value you invent (a long random string).
4. **Supabase secrets** (`npx supabase secrets set …`, one per line):
   - `REVENUECAT_WEBHOOK_SECRET=<the random string above>`
   - `STORE_PRODUCTS_PRO=jotspring_pro_monthly,jotspring_pro_annual`
   - `STORE_PRODUCTS_TEAM=jotspring_team_monthly,jotspring_team_annual`
   - `FCM_SERVICE_ACCOUNT=<service-account JSON>`
   Then redeploy: `npx supabase functions deploy revenuecat-webhook --no-verify-jwt`
5. **Codemagic variables** (group `jotspring_store`, mark secure): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (same as Cloudflare), `VITE_PUBLIC_APP_URL=https://jotspring.nvexis.com`, `VITE_RC_IOS_KEY`, `VITE_RC_ANDROID_KEY` (RevenueCat public SDK keys), `GOOGLE_SERVICES_JSON_B64`, `GOOGLE_SERVICE_INFO_PLIST_B64` (base64 of the two Firebase files: `certutil -encodehex -f google-services.json out.txt 0x40000001` on Windows, or paste into https://www.base64encode.org/).
6. Create a dedicated **App Review demo account** and fill the placeholders in STORE-LISTINGS.md.
7. Make store screenshots (phone-sized) — ask me.

------------------------------------------------------------------ needs paid accounts

## Google Play (US$25 once; org account needs DUNS)
1. Play Console → create developer account (Organization → Nvexis).
2. Create app "Jotspring", package `com.nvexis.jotspring`, free app, Productivity.
3. Fill the forms from STORE-LISTINGS.md + PRIVACY-ANSWERS.md (listing, content rating, data safety, target audience, app access with review account, ads = no).
4. Monetize → Subscriptions → create the 4 products from the table (ids exactly as listed).
5. Generate an upload keystore in Codemagic (Code signing identities → Android → Generate) named `jotspring-upload`; run the `android-play` workflow; upload the `.aab` to Internal testing; enrol in Play App Signing.
6. RevenueCat → Google app: add service-account credentials (Play Console → API access) and the package name.
7. New personal accounts must run closed testing with 12 testers for 14 days before production; organization accounts skip this.

## Apple (US$99/year; org needs DUNS)
1. Apple Developer Program → enrol as Organization (Nvexis).
2. Certificates, Identifiers & Profiles: App ID `com.nvexis.jotspring` with **Push Notifications** enabled. Keys → create an APNs key (.p8) → upload it to Firebase (Project settings → Cloud Messaging → Apple app config).
3. App Store Connect → My Apps → New App (name Jotspring, bundle id above). Create the subscription group and the 4 subscriptions (ids from the table), add review screenshots for each.
4. App Store Connect → Users and Access → Integrations → create an API key; add it in Codemagic as integration `jotspring-asc`; set `APP_STORE_APPLE_ID` (the app's numeric id) as a Codemagic variable.
5. Run the `ios-testflight` workflow, install via TestFlight on your iPhone/iPad, test a sandbox purchase and a push.
6. Fill App Privacy + age rating from PRIVACY-ANSWERS.md, add the screenshots, submit for review.
7. RevenueCat → Apple app: add the App Store Connect API key + shared secret (In-App Purchase key).

## Known follow-ups before submitting
- Add a visible **Restore purchases** button and the subscription terms text to the native Billing page (Apple requires it); `restoreStorePurchases()` already exists in `storeBilling.ts`.
- The Windows `Pro` upgrade page must not show store prices that differ from the native app's (keep one price list).
- First CI build may need small fixes (iOS Firebase package resolution); send me the Codemagic log.
