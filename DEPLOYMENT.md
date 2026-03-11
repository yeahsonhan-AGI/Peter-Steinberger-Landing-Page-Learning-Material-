# Peter Steinberger Landing Page - Deployment Guide

## Overview
This landing page includes AI chat, authentication, and community comments powered by Supabase and GLM API.

---

## Step 1: Set up Supabase Database

1. Go to your Supabase project: https://supabase.com/dashboard/project/fkwczudzzmigxwejfmap
2. Navigate to **SQL Editor**
3. Copy and run the contents of `supabase-setup.sql`

This will create:
- `comments` table
- `comment_reactions` table
- Row Level Security policies
- Helper functions

---

## Step 2: Deploy the Edge Function (Chat with Peter)

### Option A: Using Supabase CLI

1. Install Supabase CLI:
   ```bash
   npm install -g supabase
   ```

2. Link to your project:
   ```bash
   cd "C:\Users\yason\Rileys App"
   supabase link --project-ref fkwczudzzmigxwejfmap
   ```

3. Deploy the Edge Function:
   ```bash
   supabase functions deploy chat-with-peter
   ```

### Option B: Using Supabase Dashboard

1. Go to **Edge Functions** in your Supabase dashboard
2. Click **New Function**
3. Name it: `chat-with-peter`
4. Copy the contents of `supabase/functions/chat-with-peter/index.ts`
5. Paste into the editor
6. Click **Deploy**

---

## Step 3: Deploy the Website to Vercel

The website is already deployed at: https://peter-steinberger.vercel.app

To update with new features:

```bash
cd "C:\Users\yason\Rileys App"
git add .
git commit -m "Add AI chat, auth, and comments"
git push origin main
```

Vercel will auto-deploy on push.

---

## Files Created

| File | Purpose |
|------|---------|
| `index.html` | Home page with comments section |
| `chat.html` | AI chat page (protected) |
| `signin.html` | Sign in/up page |
| `auth.js` | Supabase authentication |
| `comments.js` | Comments system logic |
| `supabase-setup.sql` | Database schema |
| `supabase/functions/chat-with-peter/index.ts` | Edge Function for GLM API |

---

## Environment Variables

No environment variables needed - credentials are embedded in:
- `auth.js` - Supabase anon key
- `supabase/functions/chat-with-peter/index.ts` - GLM API key

---

## Testing

1. **Sign In**: Visit the site and click "Sign In"
2. **Create Account**: Use email/password
3. **Test Chat**: Click "Chat with Peter" and send a message
4. **Test Comments**: Post a comment on the home page
5. **Test Reactions**: Like/dislike comments

---

## Troubleshooting

**Edge Function returns 401:**
- Make sure you're signed in
- Check Supabase anon key in `auth.js`

**Comments not loading:**
- Run the SQL setup in Supabase SQL Editor
- Check browser console for errors

**Chat not responding:**
- Verify Edge Function is deployed
- Check GLM API key in Edge Function
- Check browser console for errors

---

## Architecture

```
┌─────────────┐      ┌──────────────┐      ┌──────────┐
│   Browser   │─────▶│  Supabase    │─────▶│  GLM API │
│             │      │  Edge Fn     │      │          │
└─────────────┘      └──────────────┘      └──────────┘
       │
       │ Auth
       ▼
┌──────────────┐
│  Supabase    │
│  (Auth/DB)   │
└──────────────┘
```

---

## Security Notes

⚠️ **Important:** The GLM API key is exposed in the Edge Function code. This is acceptable because:
- The Edge Function runs server-side
- It requires Supabase authentication to call
- Rate limiting can be added in Supabase

For production, consider:
1. Adding rate limiting
2. Using Supabase secrets management
3. Implementing content moderation for comments
