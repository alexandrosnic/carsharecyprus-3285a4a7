

# Complete Guide: Moving Out of Lovable & Self-Hosting

## Do You Need a Mac?

**No, you don't need a Mac for Android.** You can build and publish to Google Play from any Windows or Linux laptop using Android Studio.

**You only need a Mac for iOS/Apple App Store.** Apple requires Xcode, which only runs on macOS. Workarounds exist (cloud Mac services like MacStadium or GitHub Actions with macOS runners) but they add complexity and cost.

---

## Step-by-Step Migration Plan (in order)

### Phase 1: Export Your Code

1. **Connect to GitHub** — In Lovable, go to Connectors → GitHub → Connect project. This creates a GitHub repo with all your code.
2. **Clone the repo** to your laptop: `git clone <your-repo-url>`
3. **Export your database data** — In Lovable, go to Cloud → Database → Tables. Export each table as CSV for backup.

### Phase 2: Set Up Your Own Supabase

4. **Create a Supabase account** at [supabase.com](https://supabase.com) (free tier available).
5. **Create a new project** — note down the project URL and anon key.
6. **Run your migrations** — All your SQL migrations are in `supabase/migrations/`. Install the Supabase CLI locally, link to your new project, and run:
   ```bash
   npx supabase link --project-ref <your-new-project-ref>
   npx supabase db push
   ```
   This recreates all tables, RLS policies, functions, and triggers.
7. **Set up storage** — Create an `avatars` bucket (public) in your new Supabase dashboard.
8. **Configure Auth** — Enable the same auth providers (email, Google, etc.) in the new Supabase project under Authentication → Providers.
9. **Add secrets to new Supabase** — In your new project's Edge Functions settings, add these secrets:
   - `STRIPE_SECRET_KEY`
   - `STRIPE_WEBHOOK_SECRET`
   - `RESEND_API_KEY`
   - `MAPBOX_PUBLIC_TOKEN`
10. **Deploy edge functions** — From your cloned repo:
    ```bash
    npx supabase functions deploy create-payment-intent
    npx supabase functions deploy create-payment
    npx supabase functions deploy get-mapbox-token
    npx supabase functions deploy send-notification-email
    npx supabase functions deploy stripe-webhook
    ```

### Phase 3: Update Your Code

11. **Update Supabase credentials** — Edit `src/integrations/supabase/client.ts` and `.env` to point to your new Supabase project URL and anon key.
12. **Update Stripe webhook URL** — In your Stripe dashboard, change the webhook endpoint to your new Supabase edge function URL (`https://<new-ref>.supabase.co/functions/v1/stripe-webhook`).
13. **Update payment redirect URLs** — In `supabase/functions/create-payment-intent/index.ts`, change `success_url` and `cancel_url` from the Lovable preview URL to your production domain.
14. **Remove Lovable-specific code** — Remove `lovable-tagger` from `vite.config.ts` and `package.json` (it's a dev-only dependency for Lovable's editor).

### Phase 4: Host Your Web App

15. **Choose a hosting provider** — Options (all have free tiers):
    - **Vercel** — `npm i -g vercel && vercel` (easiest for React/Vite)
    - **Netlify** — drag-and-drop the `dist` folder or connect GitHub
    - **Cloudflare Pages** — connect GitHub, set build command to `npm run build`, output to `dist`
16. **Set environment variables** on your host:
    - `VITE_SUPABASE_URL`
    - `VITE_SUPABASE_PUBLISHABLE_KEY`
    - `VITE_SUPABASE_PROJECT_ID`
17. **Connect your custom domain** — Configure DNS at your domain registrar to point to your new host.

### Phase 5: Build the Android App (from your laptop)

18. **Install Android Studio** on your Windows/Linux laptop.
19. **Update `capacitor.config.ts`**:
    - Change `appId` to `com.carsharecyprus.app` (or your preferred reverse-domain ID)
    - **Remove the `server.url` property entirely** (production must serve from bundled files)
20. **Build and sync**:
    ```bash
    npm install
    npm run build
    npx cap add android
    npx cap sync
    npx cap open android
    ```
21. **Generate a signed AAB** in Android Studio (Build → Generate Signed Bundle).
22. **Create Google Play Developer account** ($25 one-time) at [play.google.com/console](https://play.google.com/console).
23. **Create store listing** — app name, description, screenshots, privacy policy URL, content rating.
24. **Upload AAB and submit for review** (1-7 days).

### Phase 6: Build the iOS App (requires Mac or cloud Mac)

25. **On a Mac**, install Xcode.
26. **Apple Developer Program** — enroll at [developer.apple.com](https://developer.apple.com) ($99/year).
27. **Build iOS**:
    ```bash
    npx cap add ios
    npx cap sync
    npx cap open ios
    ```
28. **Configure signing** in Xcode, archive, and upload to App Store Connect.
29. **Create App Store listing** and submit for review.

---

## Ongoing Costs After Leaving Lovable

| Service | Free Tier | Paid |
|---------|-----------|------|
| Supabase | 500 MB DB, 50K auth users | $25/mo (Pro) |
| Vercel/Netlify/Cloudflare | 100 GB bandwidth | $20/mo (Pro) |
| Stripe | No monthly fee | 2.9% + €0.25/txn |
| Mapbox | 50K map loads/month | ~$5/1K after |
| Google Play | One-time $25 | — |
| Apple Developer | — | $99/year |
| Custom domain | — | ~$10-15/year |

**Minimum monthly cost**: $0 (all free tiers) + transaction fees. Realistically ~$10-15/year for domain only, until you outgrow free tiers.

---

## Summary Checklist

1. Export code to GitHub
2. Export database data
3. Create standalone Supabase project
4. Run migrations & deploy edge functions
5. Update credentials in code
6. Deploy web app to Vercel/Netlify/Cloudflare
7. Connect custom domain
8. Build Android APK from your laptop (no Mac needed)
9. (Optional) Build iOS on a Mac
10. Update Stripe webhook + payment URLs for production
11. Switch Stripe to live mode
12. Create privacy policy page

