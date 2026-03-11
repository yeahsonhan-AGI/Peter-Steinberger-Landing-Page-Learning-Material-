/**
 * Supabase Setup Automation Script
 * Paste this into your browser's Developer Console on Supabase pages
 *
 * Instructions:
 * 1. Open Supabase SQL Editor: https://supabase.com/dashboard/project/fkwczudzzmigxwejfmap/sql/new
 * 2. Press F12 to open Developer Console
 * 3. Paste this entire script and press Enter
 */

const SQL_CODE = `-- Enable UUID extension
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
CREATE POLICY "Users can delete own reactions" ON comment_reactions FOR DELETE TO authenticated USING (auth.uid() = user_id);`;

// Try to find the SQL editor textarea and fill it
function findAndFillSQLEditor() {
    console.log('🔍 Looking for SQL editor...');

    // Try different selectors for the SQL editor
    const selectors = [
        'textarea[placeholder*="SQL"]',
        'textarea.monaco-editor-textarea',
        'textarea.inputarea',
        '.monaco-editor textarea',
        'textarea',
        '#sql-editor',
        '[contenteditable="true"]'
    ];

    for (const selector of selectors) {
        const element = document.querySelector(selector);
        if (element) {
            console.log(`✅ Found editor: ${selector}`);
            console.log('📋 SQL code copied to clipboard!');
            console.log('⌨️  Please paste in the editor (Ctrl+V) and click Run');

            // Copy to clipboard
            navigator.clipboard.writeText(SQL_CODE).then(() => {
                console.log('✅ SQL copied to clipboard!');
            }).catch(() => {
                console.log('⚠️  Auto-copy failed, copying manually...');
                console.log('--- COPY BELOW ---');
                console.log(SQL_CODE);
                console.log('--- END ---');
            });

            // If it's a textarea, try to fill it
            if (element.tagName === 'TEXTAREA') {
                element.value = SQL_CODE;
                element.dispatchEvent(new Event('input', { bubbles: true }));
                console.log('✅ SQL filled into editor!');
                console.log('🚀 Click the "Run" button to execute');
            }

            return true;
        }
    }

    console.log('❌ Could not find SQL editor automatically');
    console.log('📋 Please manually paste the SQL from below:');
    console.log('--- COPY THIS SQL ---');
    console.log(SQL_CODE);
    console.log('--- END ---');

    return false;
}

// Run
console.log('====================================================');
console.log('   Supabase SQL Editor Auto-Fill');
console.log('====================================================\n');

findAndFillSQLEditor();

console.log('\n====================================================');
console.log('After running the SQL, you can verify at:');
console.log('https://supabase.com/dashboard/project/fkwczudzzmigxwejfmap/editor');
console.log('====================================================');
