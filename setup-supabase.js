/**
 * Direct Supabase Setup Script
 * This script creates the database tables and policies via REST API
 */

const SUPABASE_URL = 'https://fkwczudzzmigxwejfmap.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZrd2N6dWR6em1pZ3h3ZWpmbWFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzY2OTI3MzIsImV4cCI6MjA1MjI2ODczMn0.wS_jqCQh8pUXx4P0j5Y-8oG8Z5F4J-3vQ7X-0Ks8-8';

// SQL statements to execute
const SQL_STATEMENTS = `
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

-- Drop existing policies if they exist
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
`;

async function executeSQLViaRPC() {
    // Using the Supabase SQL endpoint
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`
        },
        body: JSON.stringify({
            query: SQL_STATEMENTS
        })
    });

    if (!response.ok) {
        const error = await response.text();
        console.error('Error executing SQL:', error);
        throw new Error(`Failed to execute SQL: ${error}`);
    }

    return await response.json();
}

// Alternative: Use the Management API
async function setupViaManagementAPI() {
    // This would require the service_role key
    console.log('Management API approach requires service_role key');
}

// Simple approach: Try creating tables via REST API
async function setupViaRESTAPI() {
    console.log('Setting up Supabase database...');

    // Try to create the comments table via POST (this will fail if table doesn't exist yet)
    // But we can use this to verify connectivity

    // Check if we can connect
    const testResponse = await fetch(`${SUPABASE_URL}/rest/v1/comments`, {
        headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`
        }
    });

    console.log('Connectivity check:', testResponse.status);

    if (testResponse.status === 406 || testResponse.status === 200 || testResponse.status === 400) {
        console.log('✓ Supabase connection successful');
        console.log('');
        console.log('⚠️  To complete the database setup, please:');
        console.log('1. Go to: https://supabase.com/dashboard/project/fkwczudzzmigxwejfmap/sql/new');
        console.log('2. Copy the contents of supabase-setup.sql');
        console.log('3. Paste and run it');
        console.log('');
        console.log('Or run this command if you have Supabase CLI:');
        console.log('supabase db push --db-url "postgresql://postgres:fkwczudzzmigxwejfmap@aws-0-us-east-1.pooler.supabase.com:6543/postgres"');
    } else {
        console.log('✗ Supabase connection failed');
    }
}

// Node.js version
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SQL_STATEMENTS };
}

// Browser version - output the SQL
console.log('=== SUPABASE DATABASE SETUP ===');
console.log('');
console.log('Please run the following SQL in your Supabase SQL Editor:');
console.log('https://supabase.com/dashboard/project/fkwczudzzmigxwejfmap/sql/new');
console.log('');
console.log('--- COPY BELOW THIS LINE ---');
console.log(SQL_STATEMENTS);
console.log('--- END OF SQL ---');
