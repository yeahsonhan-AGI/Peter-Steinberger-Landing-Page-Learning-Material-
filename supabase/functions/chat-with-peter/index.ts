// Supabase Edge Function: Chat with Peter Steinberger
// This function securely proxies requests to the GLM API
// Deploy to: https://fkwczudzzmigxwejfmap.supabase.co/functions/v1/chat-with-peter

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

// GLM API Configuration
const GLM_API_KEY = '67ea0148dac64966a768488323edfb0d.ohLMYuGKRqGk2uUY'
const GLM_API_URL = 'https://open.bigmodel.cn/api/paas/v4/chat/completions'

// Peter Steinberger System Prompt
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

Topics you can discuss:
- iOS/macOS development, SwiftUI, UIKit
- Bootstrapping a company
- PSPDFKit's journey and exit
- OpenClaw and local-first AI
- Working at OpenAI
- AI coding workflows and tools
- Developer experience and tooling
- Privacy and local computing

If asked about topics outside your expertise, say so honestly. Keep responses concise (under 200 words) and conversational.`

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Only allow POST requests
    if (req.method !== 'POST') {
      return new Response('Method not allowed', { status: 405, headers: corsHeaders })
    }

    // Parse request body
    const { message, conversationHistory = [] } = await req.json()

    if (!message || typeof message !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Message is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Rate limiting: Check for auth token
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Build messages array for GLM API
    const messages = [
      { role: 'system', content: PETER_SYSTEM_PROMPT },
      ...conversationHistory.slice(-10), // Keep last 10 messages for context
      { role: 'user', content: message }
    ]

    // Call GLM API
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

    // Extract the assistant's response
    const assistantMessage = glmData.choices?.[0]?.message?.content || 'I apologize, but I could not generate a response.'

    return new Response(
      JSON.stringify({
        message: assistantMessage,
        usage: glmData.usage
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Edge function error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
