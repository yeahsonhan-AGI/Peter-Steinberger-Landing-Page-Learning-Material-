// Supabase Edge Function: Chat with Peter Steinberger
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const GLM_API_KEY = '67ea0148dac64966a768488323edfb0d.ohLMYuGKRqGk2uUY'
const GLM_API_URL = 'https://open.bigmodel.cn/api/paas/v4/chat/completions'

// Supabase configuration
const SUPABASE_URL = 'https://fkwczudzzmigxwejfmap.supabase.co'
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZrd2N6dWR6em1pZ3h3ZWpmbWFwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzIxNTEwOSwiZXhwIjoyMDg4NzkxMTA5fQ.iBQHPqvN-1TLdQYbF7L4fK8JHqEQAJ2dWQ8Bh7UaTOA'

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

    // Verify user authentication
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Extract token from "Bearer <token>"
    const token = authHeader.replace('Bearer ', '')

    // Verify user with Supabase
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const { data: { user }, error } = await supabase.auth.getUser(token)

    if (error || !user) {
      console.error('Auth error:', error)
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('User authenticated:', user.email)

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
      const errorText = await glmResponse.text()
      console.error('GLM API error:', errorText)
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
    console.error('Edge function error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
