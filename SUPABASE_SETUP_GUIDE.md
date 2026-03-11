# Supabase 设置步骤指南

## 步骤 1: 设置数据库 (Database Setup)

### 1.1 打开 Supabase SQL 编辑器
在浏览器中打开:
```
https://supabase.com/dashboard/project/fkwczudzzmigxwejfmap/sql/new
```

### 1.2 复制并运行 SQL
复制以下 SQL 代码并粘贴到编辑器中，然后点击 **Run**:

```sql
-- ============================================
-- Peter Steinberger Landing Page - Database Setup
-- ============================================

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

-- Comment reactions (likes/dislikes)
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

-- Comments RLS policies
CREATE POLICY "Comments are viewable by everyone"
  ON comments FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert comments"
  ON comments FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own comments"
  ON comments FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own comments"
  ON comments FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Reactions RLS policies
CREATE POLICY "Reactions are viewable by everyone"
  ON comment_reactions FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert reactions"
  ON comment_reactions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own reactions"
  ON comment_reactions FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own reactions"
  ON comment_reactions FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
```

### 1.3 验证表创建
点击 **Table Editor** 查看 `comments` 和 `comment_reactions` 表是否已创建。

---

## 步骤 2: 部署 Edge Function (AI Chat)

### 2.1 打开 Edge Functions 页面
在浏览器中打开:
```
https://supabase.com/dashboard/project/fkwczudzzmigxwejfmap/functions
```

### 2.2 创建新函数
1. 点击 **New Function** 按钮
2. 函数名称输入: `chat-with-peter`
3. 点击 **Create**

### 2.3 粘贴代码
复制以下代码并替换编辑器中的内容:

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

### 2.4 部署
点击 **Deploy** 按钮。

### 2.5 验证
部署成功后，你应该看到 `chat-with-peter` 函数出现在列表中。

---

## 步骤 3: 推送到 GitHub (手动)

由于网络连接问题，请手动运行以下命令:

```bash
cd "C:\Users\yason\Rileys App"
git push origin main
```

如果仍然失败，可以尝试:
1. 检查网络连接
2. 检查是否需要重新登录 GitHub
3. 或者使用 SSH 而不是 HTTPS

---

## 步骤 4: 验证部署

推送成功后，访问以下页面验证:

| 页面 | URL |
|------|-----|
| 主页 (带评论) | https://peter-steinberger.vercel.app |
| 登录页面 | https://peter-steinberger.vercel.app/signin.html |
| AI 聊天 | https://peter-steinberger.vercel.app/chat.html |

---

## 完成后测试清单

- [ ] Supabase 数据库中可以看到 `comments` 和 `comment_reactions` 表
- [ ] Supabase Edge Functions 中可以看到 `chat-with-peter` 函数
- [ ] 代码已推送到 GitHub
- [ ] Vercel 已自动部署新代码
- [ ] 可以访问网站并看到评论区域
- [ ] 可以注册/登录账户
- [ ] 登录后可以访问聊天页面
- [ ] 可以发布评论
- [ ] 可以点赞/点踩评论
- [ ] AI 聊天功能正常工作
