# Deployment Guide - Peter Steinberger Landing Page

## Overview
Due to network restrictions, some deployment steps need to be completed manually. Follow the steps below.

---

## Step 1: Push to GitHub

### Option A: Use GitHub API Script
If you have a GitHub Personal Access Token:

```bash
cd "C:\Users\yason\Rileys App"
node deploy-github.js YOUR_GITHUB_TOKEN
```

To create a token:
1. Go to https://github.com/settings/tokens
2. Click "Generate new token" -> "Generate new token (classic)"
3. Select **repo** scope
4. Generate and copy the token
5. Run the script above

### Option B: Manual Git Push
If network issues persist:
1. Check your VPN/proxy settings
2. Try from a different network
3. Or manually upload files via GitHub web interface

---

## Step 2: Setup Supabase Database

### 2.1 Open SQL Editor
Visit: https://supabase.com/dashboard/project/fkwczudzzmigxwejfmap/sql/new

### 2.2 Run This SQL
Copy and paste the following SQL, then click **Run**:

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Comments table
CREATE TABLE IF NOT EXISTS comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  username TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Comment reactions table
CREATE TABLE IF NOT EXISTS comment_reactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  reaction_type TEXT CHECK (reaction_type IN ('like', 'dislike')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(comment_id, user_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_comments_created ON comments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reactions_comment ON comment_reactions(comment_id);
CREATE INDEX IF NOT EXISTS idx_reactions_user ON comment_reactions(user_id);

-- Enable Row Level Security
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE comment_reactions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Comments are viewable by everyone" ON comments;
DROP POLICY IF EXISTS "Authenticated users can insert comments" ON comments;
DROP POLICY IF EXISTS "Users can update own comments" ON comments;
DROP POLICY IF EXISTS "Users can delete own comments" ON comments;
DROP POLICY IF EXISTS "Reactions are viewable by everyone" ON comment_reactions;
DROP POLICY IF EXISTS "Authenticated users can insert reactions" ON comment_reactions;
DROP POLICY IF EXISTS "Users can update own reactions" ON comment_reactions;
DROP POLICY IF EXISTS "Users can delete own reactions" ON comment_reactions;

-- Comments RLS policies
CREATE POLICY "Comments are viewable by everyone" ON comments FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert comments" ON comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own comments" ON comments FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own comments" ON comments FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Reactions RLS policies
CREATE POLICY "Reactions are viewable by everyone" ON comment_reactions FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert reactions" ON comment_reactions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own reactions" ON comment_reactions FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own reactions" ON comment_reactions FOR DELETE TO authenticated USING (auth.uid() = user_id);
```

### 2.3 Verify Tables
Go to **Table Editor** and confirm you see:
- `comments`
- `comment_reactions`

---

## Step 3: Deploy Edge Function

### 3.1 Open Edge Functions
Visit: https://supabase.com/dashboard/project/fkwczudzzmigxwejfmap/functions

### 3.2 Create Function
1. Click **New Function**
2. Name: `chat-with-peter`
3. Click **Create**

### 3.3 Paste Function Code
Replace the contents with:

```typescript
// Supabase Edge Function: Chat with Peter Steinberger
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const GLM_API_KEY = '67ea0148dac64966a768488323edfb0d.ohLMYuGKRqGk2uUY'
const GLM_API_URL = 'https://open.bigmodel.cn/api/paas/v4/chat/completions'

const PETER_SYSTEM_PROMPT = `You are Peter Steinberger, the Austrian developer and entrepreneur. Respond in first person as Peter.

Key facts about you:
- Born and raised in Oberösterreich (Upper Austria), based in Vienna
- Founder of PSPDFKit (2010), bootstrapped from your apartment, grew to 60+ employees, sold for ~$100M
- Creator of OpenClaw (originally ClawdBot), an open-source local-first AI agent framework
- Now working at OpenAI on next-generation personal agents
- Long-time iOS/macOS developer with deep expertise in mobile development
- Philosophy: "I ship code I don't read" - you use AI coding tools extensively
- Advocate for bootstrapping over VC funding
- Privacy-focused, believe in local-first software
- Active on X/Twitter as @steipete
- Gave talks at UIKonf, mDevMeet, and other conferences
- Built PSPDFKit to solve the PDF rendering problem on iOS

Your communication style:
- Pragmatic and direct
- Technical but accessible
- Occasionally humorous/self-deprecating
- Passionate about developer tools, iOS, AI agents
- Skeptical of hype, focused on what works
- European perspective (English as second language, but fluent)

Keep responses concise (under 200 words) and conversational.`

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    if (req.method !== 'POST') {
      return new Response('Method not allowed', { status: 405, headers: corsHeaders })
    }

    const { message, conversationHistory = [] } = await req.json()

    if (!message || typeof message !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Message is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const messages = [
      { role: 'system', content: PETER_SYSTEM_PROMPT },
      ...conversationHistory.slice(-10),
      { role: 'user', content: message }
    ]

    const glmResponse = await fetch(GLM_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GLM_API_KEY}`
      },
      body: JSON.stringify({
        model: 'glm-4-flash',
        messages: messages,
        temperature: 0.8,
        max_tokens: 500,
        top_p: 0.9
      })
    })

    if (!glmResponse.ok) {
      return new Response(
        JSON.stringify({ error: 'Failed to get response from AI service' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const glmData = await glmResponse.json()
    const assistantMessage = glmData.choices?.[0]?.message?.content || 'I apologize, but I could not generate a response.'

    return new Response(
      JSON.stringify({ message: assistantMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
```

### 3.4 Deploy
Click **Deploy** button.

---

## Step 4: Vercel Deployment

Once code is pushed to GitHub:
1. Go to https://vercel.com/dashboard
2. Your project should auto-deploy
3. Or manually trigger deployment from the dashboard

---

## Step 5: Verification

After completing all steps, test:

| Feature | URL | Expected Result |
|---------|-----|-----------------|
| Home Page | https://peter-steinberger.vercel.app | Landing page loads |
| Comments Section | (scroll to bottom) | Comment form visible |
| Sign In | /signin.html | Can sign up/login |
| Chat Page | /chat.html | Requires auth to access |
| AI Chat | (after sign in) | Can chat with Peter |

---

## Files Ready to Deploy

All source files are in: `C:\Users\yason\Rileys App`

- `index.html` - Main landing page with comments
- `chat.html` - AI chat interface
- `signin.html` - Authentication page
- `setup.html` - Interactive setup helper
- `auth.js` - Supabase authentication
- `comments.js` - Comments system
- `styles.css` - Styling

---

## Quick Commands

```bash
# Navigate to project
cd "C:\Users\yason\Rileys App"

# Check git status
git status

# Push via GitHub API (requires token)
node deploy-github.js YOUR_TOKEN

# Or try regular git push
git push origin main
```
