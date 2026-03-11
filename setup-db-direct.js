/**
 * Direct PostgreSQL Database Setup for Supabase
 * Connects directly to execute SQL for table creation
 */

const pg = require('pg');
const { Client } = pg;

// Supabase PostgreSQL connection string
// Using transaction mode pooler (port 6543)
// Note: Need the actual database password
const connectionString = 'postgresql://postgres.fkwczudzzmigxwejfmap:@aws-0-us-east-1.pooler.supabase.com:6543/postgres';

const SQL_SCRIPT = `
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

async function setupDatabase() {
    const client = new Client({ connectionString });

    console.log('====================================================');
    console.log('   Supabase Database Setup');
    console.log('====================================================\n');

    try {
        console.log('📡 Connecting to Supabase PostgreSQL...');
        await client.connect();
        console.log('✓ Connected!\n');

        // Split SQL by semicolon and execute each statement
        const statements = SQL_SCRIPT
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0 && !s.startsWith('--'));

        console.log(`📝 Executing ${statements.length} SQL statements...\n`);

        for (let i = 0; i < statements.length; i++) {
            const statement = statements[i];
            const shortStmt = statement.substring(0, 50) + (statement.length > 50 ? '...' : '');

            try {
                await client.query(statement);
                console.log(`✓ [${i+1}/${statements.length}] ${shortStmt}`);
            } catch (err) {
                // Some errors are OK (e.g., "already exists")
                if (err.message.includes('already exists')) {
                    console.log(`⊙ [${i+1}/${statements.length}] ${shortStmt} (already exists)`);
                } else {
                    console.log(`⚠️  [${i+1}/${statements.length}] ${shortStmt}`);
                    console.log(`   Error: ${err.message}`);
                }
            }
        }

        console.log('\n====================================================');
        console.log('✅ Database setup complete!');
        console.log('====================================================\n');

        // Verify tables exist
        console.log('🔍 Verifying tables...');
        const checkTables = await client.query(`
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_name IN ('comments', 'comment_reactions')
        `);

        console.log(`✓ Found ${checkTables.rows.length} tables:`);
        checkTables.rows.forEach(row => console.log(`  - ${row.table_name}`));

    } catch (error) {
        console.error('\n❌ Setup failed:', error.message);
        console.error('\nPossible causes:');
        console.error('1. Network connection blocked');
        console.error('2. Invalid connection string');
        console.error('3. Firewall preventing outbound connections on port 5432');
        console.error('\nPlease run the SQL manually in Supabase dashboard:');
        console.error('https://supabase.com/dashboard/project/fkwczudzzmigxwejfmap/sql/new\n');
        process.exit(1);
    } finally {
        await client.end();
    }
}

// Check if pg module is installed
try {
    require.resolve('pg');
} catch (e) {
    console.error('❌ "pg" module not installed!');
    console.error('\nPlease install it first:');
    console.error('  npm install pg\n');
    console.error('Or run the SQL manually in Supabase dashboard:');
    console.error('https://supabase.com/dashboard/project/fkwczudzzmigxwejfmap/sql/new\n');
    process.exit(1);
}

setupDatabase();
