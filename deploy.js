/**
 * GitHub API Deployment Script
 * Uploads files directly to GitHub repository without git push
 */

const GITHUB_API_URL = 'https://api.github.com';
const REPO_OWNER = 'yeahsonhan-AGI';
const REPO_NAME = 'Peter-Steinberger-Landing-Page-Learning-Material-';

// You need a GitHub Personal Access Token with 'repo' scope
// Create one at: https://github.com/settings/tokens
let GITHUB_TOKEN = '';

// Files to upload
const filesToUpload = [
    { path: 'index.html', content: '' },
    { path: 'chat.html', content: '' },
    { path: 'signin.html', content: '' },
    { path: 'auth.js', content: '' },
    { path: 'comments.js', content: '' },
    { path: 'setup.html', content: '' },
];

async function getBranchSHA() {
    const response = await fetch(
        `${GITHUB_API_URL}/repos/${REPO_OWNER}/${REPO_NAME}/git/refs/heads/main`,
        {
            headers: {
                'Authorization': `Bearer ${GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        }
    );

    if (!response.ok) {
        throw new Error(`Failed to get branch: ${response.statusText}`);
    }

    const data = await response.json();
    return data.object.sha;
}

async function createCommit(message, changes) {
    // Get current branch SHA
    const branchSHA = await getBranchSHA();

    // Get latest commit SHA
    const branchData = await fetch(
        `${GITHUB_API_URL}/repos/${REPO_OWNER}/${REPO_NAME}/git/refs/heads/main`,
        {
            headers: {
                'Authorization': `Bearer ${GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        }
    ).then(r => r.json());

    const treeItems = [];

    for (const change of changes) {
        // Create blob
        const blobResponse = await fetch(
            `${GITHUB_API_URL}/repos/${REPO_OWNER}/${REPO_NAME}/git/blobs`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${GITHUB_TOKEN}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    content: btoa(unescape(encodeURIComponent(change.content))),
                    encoding: 'base64'
                })
            }
        );

        const blobData = await blobResponse.json();
        treeItems.push({
            path: change.path,
            mode: '100644',
            type: 'blob',
            sha: blobData.sha
        });
    }

    // Create tree
    const treeResponse = await fetch(
        `${GITHUB_API_URL}/repos/${REPO_OWNER}/${REPO_NAME}/git/trees`,
        {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                base_tree: branchData.object.sha,
                tree: treeItems
            })
        }
    );

    const treeData = await treeResponse.json();

    // Create commit
    const commitResponse = await fetch(
        `${GITHUB_API_URL}/repos/${REPO_OWNER}/${REPO_NAME}/git/commits`,
        {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: message,
                tree: treeData.sha,
                parents: [branchData.object.sha]
            })
        }
    );

    const commitData = await commitResponse.json();

    // Update reference
    await fetch(
        `${GITHUB_API_URL}/repos/${REPO_OWNER}/${REPO_NAME}/git/refs/heads/main`,
        {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                sha: commitData.sha
            })
        }
    );

    return commitData.sha;
}

// Browser version
console.log(`
====================================================
   GitHub API Deployment Script
====================================================

To use this script:

1. Create a GitHub Personal Access Token:
   https://github.com/settings/tokens

2. Select 'repo' scope

3. Run this script with the token:
   node deploy.js YOUR_TOKEN

Or paste the token in the GITHUB_TOKEN variable.

====================================================
`);
