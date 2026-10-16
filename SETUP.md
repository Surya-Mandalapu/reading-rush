# Activate DosPrep accounts and analytics

The site uses Firebase project **dosprep-study-a7f31** (DosPrep) and Web app **1:772349583234:web:18813d737ab9b9a1f8399b**. Google and Email/Password authentication have been deployed, including the GitHub Pages authorized domain. Real-backend email signup, login, and sign-out passed tests; the temporary QA account was deleted. The live Google popup reaches Google Accounts, and its Firebase project config confirms that suryamandalapu-boop.github.io is authorized.

**Analytics is linked:** Firebase returned measurement ID **G-H9PYRFYZ4R** for DosPrep Web. The public site config uses this ID. Tracking loads only after visitor consent; activation is deployed through GitHub Pages.

## Project configuration reference

The project and web app are already created. If the operator login expires, run `npx -y firebase-tools@latest login --reauth` to reconnect. No billing upgrade is required for the implemented email/password and Google sign-in flows under their applicable free quotas; do not enable paid services just for this app.

1. Register a **Web app** in the project and obtain its public `firebaseConfig` object (apiKey, authDomain, projectId, appId, and related public fields). Do not share service-account private keys or OAuth tokens.
2. In **Authentication → Sign-in method**, enable **Email/Password** and **Google**. Choose the project's support email when enabling Google. Set a password policy of at least 8 characters, and enable email enumeration protection where supported.
3. In **Authentication → Settings → Authorized domains**, verify `suryamandalapu-boop.github.io`. Add `localhost` and `127.0.0.1` only if local testing is needed. Keep the Firebase-provided auth domain; Google sign-in uses a popup on GitHub Pages. With CLI 15.34, use `auth.providers.googleSignIn.authorizedRedirectUris` in `firebase.json` (already configured here); the older top-level `auth.authorizedDomains` field is ignored. Deploying the redirect URIs provisions the corresponding origin allowlist.
4. Create or link a Google Analytics 4 property and Web data stream for `https://suryamandalapu-boop.github.io/reading-rush/`. Record its `G-…` measurement ID. A Firebase project can be linked to Analytics, but a real GA4 Web data stream is still required. Configure enhanced measurement carefully so it does not collect form inputs or URL query values. The app itself sends sanitized page paths and a small allowlist of event parameters.
5. Save the public Firebase web config as JSON in a local temporary file, then run:

```powershell
node tools/configure-site.mjs "public-firebase-web-config.json" "G-YOURREALID"
```

6. Commit the generated public `app/site-config.js` and push to `main`. GitHub Pages deploys the app. Public Firebase API keys identify a project; authorization is enforced by Firebase Authentication. Never put administrator credentials in browser files.
7. Verify Google popup sign-in, email signup/login, reset email delivery, sign-out, and guest/account data separation on the live site. Accept analytics, confirm a request to Google's collection endpoint, and check GA4 Realtime. Analytics reports may take time; event generation alone does not prove the correct property received events.

## What the backend does

Firebase handles identity only. Guest, signed-in, and other accounts have separate browser-local study stores. This update does not add Firestore or cloud synchronization. An account does not make static question assets private; GitHub Pages serves the public app and assets. The original guest history remains under its existing storage key. Export it as a backup before signing in and restore it within the account if desired.

Authentication and Analytics are configured. Practice works independently of analytics. Optional usage tracking is off until visitors consent. The app does not send emails, passwords, answers, question content, highlights, or Firebase user IDs to Analytics. Analytics preference can be changed on the privacy page.

## SEO

`index.html` is a static, crawlable DosPrep homepage with a descriptive title, description, canonical URL, Open Graph/Twitter cards, favicon, and WebSite structured data. `sitemap.xml` lists the homepage and privacy page. `practice.html` and `signin.html` are `noindex` so personal screens are not search results. Metadata does not guarantee rankings or indexing.

GitHub Pages project sites cannot control the hostname's root `robots.txt` from a subdirectory. The supplied project-level file is informational; submit the sitemap directly in [Google Search Console](https://search.google.com/search-console/) after verifying ownership. Search Console verification needs access to the owner's Google account or a supplied verification token and has not been completed. Keep the current URL unless intentionally moving the site, and update canonicals/sitemap/social URLs together if it changes.

## Verification

The practice regression suite runs with `npm test` against a local server (or `READING_RUSH_URL` pointing at `practice.html`). Set `CHROMIUM_EXECUTABLE` to an existing Chromium executable, or install the Playwright browser.

The Firebase integration test uses **only the local Authentication emulator**, not a production account:

```powershell
firebase emulators:start --only auth --project demo-dosprep
python -m http.server 8767 --bind 127.0.0.1 --directory app
node tools/verify-dosprep.cjs
```

It injects demo configuration into the browser test only and tests email signup, login, rejected passwords, password resets, sign-out, account isolation, SEO metadata, consent behavior, and sanitized analytics event payloads. Google OAuth completion requires an interactive Google account. Use `node tools/verify-live-analytics.cjs` to check consent behavior and real collection requests on the live website. HTTP acceptance verifies collection transport; report visibility must be checked in the owner's GA4 account.
