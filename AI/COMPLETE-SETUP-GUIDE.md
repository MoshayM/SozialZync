# SozialZynk — Complete API & Setup Guide
> Everything you need to configure, connect, and run the full platform.

---

## PART 1 — AI PROVIDERS (Brain of the platform)

### 🤖 Anthropic (Claude) — PRIMARY AI
**What it powers:** Script writing, research synthesis, compliance checks, AI Copilot
**Get your key:**
1. Go to → https://console.anthropic.com
2. Sign up / Log in
3. Click **API Keys** in left sidebar
4. Click **Create Key** → name it "SozialZynk"
5. Copy the key (starts with `sk-ant-api03-...`)

**Set in Railway:**
```
ANTHROPIC_API_KEY=sk-ant-api03-YOUR-KEY-HERE
```

---

### 🤖 OpenAI — SECONDARY AI + IMAGE + VOICE
**What it powers:** Fallback LLM, DALL-E image generation, TTS voice narration
**Get your key:**
1. Go to → https://platform.openai.com/api-keys
2. Sign up / Log in
3. Click **Create new secret key** → name it "SozialZynk"
4. Copy the key (starts with `sk-proj-...` or `sk-...`)

**Set in Railway:**
```
OPENAI_API_KEY=sk-proj-YOUR-KEY-HERE
IMAGE_PROVIDER=openai        # or gemini
VOICE_PROVIDER=openai        # or elevenlabs
```

---

### 🤖 Groq — FREE FAST INFERENCE
**What it powers:** Fast fallback LLM (Llama 3, Mixtral) — free tier available
**Get your key:**
1. Go to → https://console.groq.com
2. Sign up (free)
3. Click **API Keys** → **Create API Key**
4. Copy the key (starts with `gsk_...`)

**Set in Railway:**
```
GROQ_API_KEY=gsk_YOUR-KEY-HERE
```

---

### 🤖 Google Gemini — IMAGE GENERATION
**What it powers:** Imagen 3 thumbnail generation (best quality images)
**Get your key:**
1. Go to → https://aistudio.google.com/app/apikey
2. Sign in with Google
3. Click **Create API key**
4. Select or create a project
5. Copy the key

**Set in Railway:**
```
GEMINI_API_KEY=AIza-YOUR-KEY-HERE
IMAGE_PROVIDER=gemini        # recommended for best thumbnails
IMAGE_GEMINI_MODEL=imagen-3.0-generate-002
```

---

## PART 2 — VOICE & AUDIO

### 🎙️ ElevenLabs — VOICE NARRATION (Best quality)
**What it powers:** Natural-sounding voice narration for videos
**Get your key:**
1. Go to → https://elevenlabs.io
2. Sign up (free tier: 10K chars/month)
3. Click your avatar → **Profile** → **API Keys**
4. Copy your API key

**Set in Railway:**
```
ELEVENLABS_API_KEY=YOUR-KEY-HERE
VOICE_PROVIDER=elevenlabs
VOICE_ELEVENLABS_MODEL=eleven_turbo_v2
VOICE_ELEVENLABS_VOICE_ID=21m00Tcm4TlvDq8ikWAM   # Rachel (default)
```

**Voice IDs (popular):**
- Rachel: `21m00Tcm4TlvDq8ikWAM`
- Adam: `pNInz6obpgDQGcFmaJgB`
- Bella: `EXAVITQu4vr4xnSDxMaL`

---

### 🎵 Suno — AI MUSIC GENERATION
**What it powers:** Background music for videos
**Get your key:**
1. Go to → https://suno.com
2. Sign up → Go to **Settings** → **API** (requires paid plan)

**Set in Railway:**
```
SUNO_API_KEY=YOUR-KEY-HERE
MUSIC_PROVIDER=suno
```

---

## PART 3 — VIDEO GENERATION

### 🎬 Runway ML — AI VIDEO GENERATION
**What it powers:** Text-to-video, image-to-video clips
**Get your key:**
1. Go to → https://runwayml.com
2. Sign up → **Account** → **API Keys**

```
RUNWAYML_API_KEY=YOUR-KEY-HERE
VIDEO_PROVIDER=runway
```

### 🎬 Kling AI — AI VIDEO (Alternative)
**Get your key:**
1. Go to → https://klingai.com (or Kwai API)
2. Sign up for API access → **Developer Portal**

```
KLING_ACCESS_KEY_ID=YOUR-ID
KLING_ACCESS_KEY_SECRET=YOUR-SECRET
VIDEO_PROVIDER=kling
```

### 🎬 Luma AI — AI VIDEO (Alternative)
```
LUMA_API_KEY=YOUR-KEY-HERE
VIDEO_PROVIDER=luma
```

> **Note:** If no video provider key is set, the platform uses **local FFmpeg** for basic text-overlay videos. This works for simple content but no generative video.

---

## PART 4 — PLATFORM CONNECTIONS

### 📺 YouTube Channel Connection
**Required for:** Publishing videos, reading analytics, shorts upload

**Step 1 — Create Google Cloud Project:**
1. Go to → https://console.cloud.google.com
2. Create a new project (name: "SozialZynk")
3. Go to **APIs & Services** → **Library**
4. Search and **Enable**: `YouTube Data API v3`
5. Also enable: `YouTube Analytics API`, `Google OAuth2 API`

**Step 2 — Create OAuth Client:**
1. Go to **APIs & Services** → **Credentials**
2. Click **Create Credentials** → **OAuth 2.0 Client ID**
3. Application type: **Web application**
4. Name: "SozialZynk"
5. **Authorized redirect URIs** — add ALL of these:
   ```
   https://api-production-cf143.up.railway.app/api/v1/channels/oauth/callback
   http://localhost:4007/api/v1/channels/oauth/callback
   ```
6. Click **Create** → copy **Client ID** and **Client Secret**

**Step 3 — OAuth Consent Screen:**
1. **APIs & Services** → **OAuth consent screen**
2. User Type: **External** → Create
3. App name: "SozialZynk", Support email: your email
4. **Scopes** → Add:
   - `openid`
   - `email`
   - `profile`
   - `https://www.googleapis.com/auth/youtube.readonly`
   - `https://www.googleapis.com/auth/youtube.upload`
   - `https://www.googleapis.com/auth/youtube`
   - `https://www.googleapis.com/auth/yt-analytics.readonly`
5. **Test users** → Add your Google account email

**Step 4 — Set in Railway:**
```
GOOGLE_CLIENT_ID=YOUR-CLIENT-ID.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-YOUR-SECRET
YOUTUBE_API_KEY=YOUR-API-KEY    # (optional, for public data)
```

**Step 5 — Connect in App:**
1. Log in to SozialZynk → **Settings** → **Channels**
2. Click **Connect YouTube**
3. Google OAuth popup opens → Authorize
4. Channel appears in your dashboard

---

### 📸 Instagram / Facebook Connection
**Required for:** Posting Reels, Stories, feed posts

**Step 1:**
1. Go to → https://developers.facebook.com
2. **My Apps** → **Create App**
3. App type: **Business** → Continue
4. Add products: **Instagram Graph API**, **Facebook Login**

**Step 2 — App Settings:**
```
FACEBOOK_APP_ID=YOUR-APP-ID
FACEBOOK_APP_SECRET=YOUR-APP-SECRET
```

**Step 3 — Redirect URI:**
Add to Facebook app's Valid OAuth Redirect URIs:
```
https://api-production-cf143.up.railway.app/api/v1/channels/oauth/instagram/callback
```

**Step 4 — Connect in App:**
Settings → Channels → Connect Instagram → Facebook OAuth flow

---

### 🎵 TikTok Connection
1. Go to → https://developers.tiktok.com
2. Create app → Enable **Login Kit** and **Content Posting API**
3. Set redirect URI: `https://api-production-cf143.up.railway.app/api/v1/channels/oauth/tiktok/callback`

```
TIKTOK_CLIENT_KEY=YOUR-KEY
TIKTOK_CLIENT_SECRET=YOUR-SECRET
```

---

### 💼 LinkedIn Connection
1. Go to → https://developer.linkedin.com
2. Create App → Request access to **Share on LinkedIn** and **Sign In with LinkedIn**
3. Set redirect URI: `https://api-production-cf143.up.railway.app/api/v1/channels/oauth/linkedin/callback`

```
LINKEDIN_CLIENT_ID=YOUR-ID
LINKEDIN_CLIENT_SECRET=YOUR-SECRET
```

---

## PART 5 — PAYMENTS (Stripe)

**Required for:** Paid plan subscriptions, credit purchases

1. Go to → https://dashboard.stripe.com
2. Sign up → **Get test API keys** (for testing) or **Live mode** (for real payments)
3. Copy **Publishable key** and **Secret key**
4. Create Products:
   - **Starter** → $19/month → note the Price ID
   - **Pro** → $49/month → note the Price ID
   - **Agency** → $149/month → note the Price ID

5. Set up **Webhook**:
   - Stripe Dashboard → **Webhooks** → **Add endpoint**
   - URL: `https://api-production-cf143.up.railway.app/api/v1/billing/webhook`
   - Events: `checkout.session.completed`, `invoice.paid`, `customer.subscription.deleted`
   - Copy the **Webhook signing secret**

**Set in Railway:**
```
STRIPE_SECRET_KEY=sk_live_YOUR-KEY   (or sk_test_ for testing)
STRIPE_PUBLISHABLE_KEY=pk_live_YOUR-KEY
STRIPE_WEBHOOK_SECRET=whsec_YOUR-SECRET
STRIPE_STARTER_PRICE_ID=price_XXXXX
STRIPE_PRO_PRICE_ID=price_XXXXX
STRIPE_AGENCY_PRICE_ID=price_XXXXX
```

---

## PART 6 — STORAGE (Cloudflare R2)

**Required for:** Storing generated images, videos, audio files

1. Go to → https://dash.cloudflare.com
2. **R2** → **Create bucket** → name: `sozialzynk-assets`
3. **R2 Overview** → **Manage R2 API Tokens** → Create token with **Object Read & Write**
4. Note: Account ID, Access Key ID, Secret Access Key
5. Create **Public Access** policy or use signed URLs

**Set in Railway:**
```
STORAGE_BACKEND=r2
R2_ACCOUNT_ID=YOUR-ACCOUNT-ID
R2_ACCESS_KEY_ID=YOUR-ACCESS-KEY
R2_SECRET_ACCESS_KEY=YOUR-SECRET-KEY
R2_BUCKET=sozialzynk-assets
R2_PUBLIC_URL=https://pub-XXXXX.r2.dev
```

---

## PART 7 — HOW TO SET VARIABLES IN RAILWAY

1. Go to → https://railway.app
2. Open your project → Click on the **API service**
3. Click **Variables** tab
4. Click **Add Variable** for each key
   - Or click **Raw Editor** to paste multiple at once

**All critical variables for production:**
```
NODE_ENV=production
ANTHROPIC_API_KEY=sk-ant-api03-...
OPENAI_API_KEY=sk-proj-...
GROQ_API_KEY=gsk_...
GEMINI_API_KEY=AIza...
GOOGLE_CLIENT_ID=...apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-...
TOKEN_ENCRYPTION_KEY=<64 hex chars: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))">
JWT_SECRET=<random 32+ chars>
NEXTAUTH_SECRET=<random 32+ chars>
VOICE_PROVIDER=elevenlabs
IMAGE_PROVIDER=gemini
VIDEO_PROVIDER=local
ELEVENLABS_API_KEY=...
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STORAGE_BACKEND=r2
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET=sozialzynk-assets
```

---

## PART 8 — CONTENT CREATION: WHAT USERS CAN MAKE

### Creating a Reel / Short / TikTok
1. Dashboard → **Shorts Studio**
2. Upload a long video OR paste a YouTube URL
3. AI identifies the best 5–10 viral moments
4. Choose moment → AI adds captions, hook text, trending audio
5. Export in vertical (9:16) format
6. Publish directly to TikTok / Instagram Reels / YouTube Shorts

### Creating a Full YouTube Video
1. Dashboard → **Projects** → **New Project**
2. Describe your idea in the AI Copilot: "Make a video about X for Y audience"
3. Copilot runs: Research → Script → Thumbnail → Voice → Compliance
4. Review each stage (edit if needed)
5. Approve → goes to **Publish Hub**
6. Set schedule → publishes to YouTube automatically

### Creating a Post (Instagram/LinkedIn/Twitter)
1. Dashboard → **Content** → **New Post**
2. Choose type: image post, carousel, text
3. Describe your post → AI writes caption, hashtags, image
4. Preview per platform → Publish or schedule

### Creating an AI Thumbnail
1. Inside any project → **Thumbnail** tab
2. Describe the thumbnail OR let AI auto-generate from the video title
3. 3 variations generated → choose or regenerate
4. Download or attach to video directly

---

## PART 9 — TESTING YOUR SETUP

### Test AI Provider Keys
Hit the health endpoint after deploying:
```
GET https://api-production-cf143.up.railway.app/api/v1/health
```
Response shows which providers are connected.

### Test Provider via Copilot
1. Log in → open AI Copilot
2. Type: "Write me a 3-sentence YouTube video description about AI tools"
3. If response arrives: Anthropic key is working ✅

### Test Image Generation
1. Projects → New Project → Thumbnail Generator
2. Enter title → Generate
3. If thumbnail appears: Image provider working ✅

### Test Voice
1. Scripts section → any script → "Generate Voice"
2. If audio plays: Voice provider working ✅

### Test YouTube Connection
1. Settings → Channels → Connect YouTube → Complete OAuth
2. If your channel appears: YouTube API working ✅

---

## PART 10 — QUICK START CHECKLIST

```
□ Set ANTHROPIC_API_KEY in Railway          (required — core AI)
□ Set OPENAI_API_KEY in Railway             (recommended — fallback + images)
□ Set GROQ_API_KEY in Railway               (free — fast responses)
□ Set GEMINI_API_KEY in Railway             (recommended — best thumbnails)
□ Set TOKEN_ENCRYPTION_KEY (64 hex chars)   (required — app won't start without)
□ Set JWT_SECRET (32+ random chars)         (required — auth)
□ Connect YouTube channel via OAuth         (required — publishing)
□ Set ELEVENLABS_API_KEY                    (optional — voice narration)
□ Set STRIPE keys                           (optional — payments)
□ Set R2 keys                               (optional — cloud storage)
□ Set GOOGLE_CLIENT_ID + SECRET             (required — YouTube OAuth)
```

---

*Last updated: 2026-08-23*
*For issues: check Railway logs → open AI Copilot → ask "why is X not working"*
