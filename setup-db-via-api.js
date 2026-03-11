/**
 * Supabase Database Setup via REST API
 * Creates tables using Supabase REST API with proper authentication
 */

const SUPABASE_URL = 'https://fkwczudzzmigxwejfmap.supabase.co';
const SUPABASE_KEY = 'sb_publishable_9EMtJ7eG_kTBkO7ChoyPQA_rVDFt4RO';

// Step 1: Try to create a test comment to verify table exists
async function testTable() {
    console.log('🔍 Testing if comments table exists...\n');

    const response = await fetch(`${SUPABASE_URL}/rest/v1/comments?limit=1`, {
        headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`
        }
    });

    console.log('Response status:', response.status);

    if (response.status === 406) {
        console.log('✅ Table exists but needs specific Accept header\n');
    } else if (response.status === 200) {
        console.log('✅ Table exists!\n');
    } else if (response.status === 404) {
        console.log('❌ Table does not exist. Manual setup required.\n');
    } else {
        const text = await response.text();
        console.log('Response:', text, '\n');
    }

    return response.ok || response.status === 406;
}

// Step 2: Open Supabase SQL Editor in browser
function openSQLEditor() {
    const url = 'https://supabase.com/dashboard/project/fkwczudzzmigxwejfmap/sql/new';
    console.log('📝 Opening Supabase SQL Editor...\n');
    console.log(`Please visit: ${url}\n`);
    console.log('And run the SQL from setup.html or DEPLOYMENT_GUIDE.md\n');
}

// Main execution
(async () => {
    console.log('====================================================');
    console.log('   Supabase Database Setup');
    console.log('====================================================\n');

    await testTable();
    openSQLEditor();

    console.log('====================================================\n');
    console.log('⚠️  IMPORTANT: Supabase REST API cannot execute DDL');
    console.log('    (CREATE TABLE, ALTER TABLE, etc.)');
    console.log('\n    Please run the SQL manually in the dashboard.\n');
    console.log('====================================================\n');
})();
