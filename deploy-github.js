/**
 * GitHub API Deployment Script (Node.js version)
 * Uploads files directly to GitHub repository without git push
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const GITHUB_API_URL = 'https://api.github.com';
const REPO_OWNER = 'yeahsonhan-AGI';
const REPO_NAME = 'Peter-Steinberger-Landing-Page-Learning-Material-';

// Get token from command line
const GITHUB_TOKEN = process.argv[2];

if (!GITHUB_TOKEN) {
    console.error(`
====================================================
   GitHub API Deployment Script
====================================================

Usage: node deploy-github.js <YOUR_GITHUB_TOKEN>

To create a token:
1. Go to: https://github.com/settings/tokens
2. Click "Generate new token" -> "Generate new token (classic)"
3. Select 'repo' scope
4. Generate and copy the token
5. Run: node deploy-github.js <paste_token_here>

====================================================
`);
    process.exit(1);
}

// Files to deploy
const filesToDeploy = [
    'index.html',
    'chat.html',
    'signin.html',
    'setup.html',
    'auth.js',
    'comments.js',
    'styles.css'
];

function httpsRequest(options, data = null) {
    return new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(body);
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        resolve(parsed);
                    } else {
                        reject(new Error(`HTTP ${res.statusCode}: ${parsed.message || body}`));
                    }
                } catch {
                    resolve({ status: res.statusCode, body });
                }
            });
        });

        req.on('error', reject);

        if (data) {
            req.write(JSON.stringify(data));
        }

        req.end();
    });
}

async function getBranchSHA() {
    const options = {
        hostname: 'api.github.com',
        path: `/repos/${REPO_OWNER}/${REPO_NAME}/git/refs/heads/main`,
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${GITHUB_TOKEN}`,
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'Deploy-Script'
        }
    };

    const data = await httpsRequest(options);
    return data.object.sha;
}

async function createBlob(content) {
    const base64Content = Buffer.from(content, 'utf-8').toString('base64');

    const options = {
        hostname: 'api.github.com',
        path: `/repos/${REPO_OWNER}/${REPO_NAME}/git/blobs`,
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${GITHUB_TOKEN}`,
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'Deploy-Script',
            'Content-Type': 'application/json'
        }
    };

    const data = await httpsRequest(options, {
        content: base64Content,
        encoding: 'base64'
    });

    return data.sha;
}

async function createCommit(message, treeSHA, parentSHA) {
    const options = {
        hostname: 'api.github.com',
        path: `/repos/${REPO_OWNER}/${REPO_NAME}/git/commits`,
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${GITHUB_TOKEN}`,
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'Deploy-Script',
            'Content-Type': 'application/json'
        }
    };

    const data = await httpsRequest(options, {
        message: message,
        tree: treeSHA,
        parents: [parentSHA]
    });

    return data.sha;
}

async function createTree(baseTreeSHA, items) {
    const options = {
        hostname: 'api.github.com',
        path: `/repos/${REPO_OWNER}/${REPO_NAME}/git/trees`,
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${GITHUB_TOKEN}`,
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'Deploy-Script',
            'Content-Type': 'application/json'
        }
    };

    const data = await httpsRequest(options, {
        base_tree: baseTreeSHA,
        tree: items
    });

    return data.sha;
}

async function updateReference(commitSHA) {
    const options = {
        hostname: 'api.github.com',
        path: `/repos/${REPO_OWNER}/${REPO_NAME}/git/refs/heads/main`,
        method: 'PATCH',
        headers: {
            'Authorization': `Bearer ${GITHUB_TOKEN}`,
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'Deploy-Script',
            'Content-Type': 'application/json'
        }
    };

    return await httpsRequest(options, { sha: commitSHA });
}

async function deploy() {
    console.log('🚀 Starting GitHub API deployment...\n');

    try {
        // Get current branch tip
        console.log('📡 Fetching current branch info...');
        const branchSHA = await getBranchSHA();
        console.log(`✓ Current commit: ${branchSHA.substring(0, 7)}\n`);

        // Read files and create blobs
        console.log('📄 Processing files...');
        const treeItems = [];

        for (const file of filesToDeploy) {
            const filePath = path.join(__dirname, file);
            if (fs.existsSync(filePath)) {
                const content = fs.readFileSync(filePath, 'utf-8');
                console.log(`  - ${file} (${content.length} bytes)`);

                const blobSHA = await createBlob(content);
                treeItems.push({
                    path: file,
                    mode: '100644',
                    type: 'blob',
                    sha: blobSHA
                });
            } else {
                console.log(`  ⚠️  ${file} (not found, skipping)`);
            }
        }

        // Create tree
        console.log('\n🌳 Creating git tree...');
        const treeSHA = await createTree(branchSHA, treeItems);
        console.log(`✓ Tree: ${treeSHA.substring(0, 7)}\n`);

        // Create commit
        console.log('💾 Creating commit...');
        const commitMessage = 'Deploy: Add AI chat, authentication, and comments system';
        const commitSHA = await createCommit(commitMessage, treeSHA, branchSHA);
        console.log(`✓ Commit: ${commitSHA.substring(0, 7)}\n`);

        // Update reference
        console.log('⬆️  Pushing to main branch...');
        await updateReference(commitSHA);
        console.log('✓ Push successful!\n');

        console.log('====================================================');
        console.log('✅ Deployment complete!');
        console.log('====================================================');
        console.log(`\nView at: https://github.com/${REPO_OWNER}/${REPO_NAME}\n`);

    } catch (error) {
        console.error('\n❌ Deployment failed:', error.message);
        if (error.message.includes('ECONNREFUSED') || error.message.includes('Could not connect')) {
            console.error('\n⚠️  Network error: Could not connect to GitHub API.');
            console.error('Please check your network connection and try again.\n');
        }
        process.exit(1);
    }
}

deploy();
