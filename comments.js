/**
 * Comments System
 * Handles posting, liking/disliking, and displaying comments from Supabase
 */

// Comments configuration
const COMMENTS_PER_PAGE = 10;

// Initialize comments system
async function initComments() {
    await Auth.initSupabase();
    await loadComments();
    setupCommentForm();
    setupAuthListener();
}

// Setup auth state listener for comments
function setupAuthListener() {
    Auth.onAuthStateChange(async (event, session) => {
        // Update comment form state
        const commentForm = document.getElementById('comment-form');
        const commentInput = document.getElementById('comment-input');
        const submitBtn = document.getElementById('comment-submit');

        if (session) {
            commentInput.disabled = false;
            submitBtn.disabled = false;
            submitBtn.textContent = 'Post Comment';
        } else {
            commentInput.disabled = true;
            submitBtn.disabled = true;
            submitBtn.textContent = 'Sign in to comment';
        }

        // Refresh comments to update reaction states
        await loadComments();
    });
}

// Setup comment form submission
function setupCommentForm() {
    const form = document.getElementById('comment-form');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const user = await Auth.getCurrentUser();
        if (!user) {
            window.location.href = 'signin.html?redirect=' + encodeURIComponent(window.location.href);
            return;
        }

        const content = document.getElementById('comment-input').value.trim();
        if (!content) return;

        const submitBtn = document.getElementById('comment-submit');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Posting...';

        try {
            await postComment(user, content);
            document.getElementById('comment-input').value = '';
            await loadComments();
        } catch (error) {
            console.error('Error posting comment:', error);
            alert('Failed to post comment. Please try again.');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Post Comment';
        }
    });
}

// Post a new comment
async function postComment(user, content) {
    const supabase = await Auth.initSupabase();
    const username = Auth.getUsername(user);

    const { error } = await supabase
        .from('comments')
        .insert({
            user_id: user.id,
            username: username,
            content: content
        });

    if (error) throw error;
}

// Load comments from Supabase
async function loadComments(offset = 0) {
    const supabase = await Auth.initSupabase();
    const currentUser = await Auth.getCurrentUser();

    // Fetch comments with reaction counts
    const { data: comments, error } = await supabase
        .from('comments')
        .select(`
            id,
            user_id,
            username,
            content,
            created_at
        `)
        .order('created_at', { ascending: false })
        .range(offset, offset + COMMENTS_PER_PAGE - 1);

    if (error) {
        console.error('Error loading comments:', error);
        return;
    }

    // Fetch reaction counts for each comment
    const commentsWithReactions = await Promise.all(
        comments.map(async (comment) => {
            const { data: reactions } = await supabase
                .from('comment_reactions')
                .select('reaction_type')
                .eq('comment_id', comment.id);

            const likes = reactions?.filter(r => r.reaction_type === 'like').length || 0;
            const dislikes = reactions?.filter(r => r.reaction_type === 'dislike').length || 0;

            // Get current user's reaction
            let userReaction = null;
            if (currentUser) {
                const { data: userReactions } = await supabase
                    .from('comment_reactions')
                    .select('reaction_type')
                    .eq('comment_id', comment.id)
                    .eq('user_id', currentUser.id)
                    .single();

                userReaction = userReactions?.reaction_type || null;
            }

            // Check if current user owns this comment
            const isOwner = currentUser && currentUser.id === comment.user_id;

            return {
                ...comment,
                likes,
                dislikes,
                userReaction,
                isOwner
            };
        })
    );

    displayComments(commentsWithReactions);
    updateLoadMoreButton(comments.length);
}

// Display comments in the DOM
function displayComments(comments) {
    const container = document.getElementById('comments-list');
    container.innerHTML = '';

    if (comments.length === 0) {
        container.innerHTML = '<p class="no-comments">No comments yet. Be the first to share your thoughts!</p>';
        return;
    }

    comments.forEach(comment => {
        const commentEl = createCommentElement(comment);
        container.appendChild(commentEl);
    });
}

// Create a comment element
function createCommentElement(comment) {
    const div = document.createElement('div');
    div.className = 'comment';
    div.dataset.commentId = comment.id;

    const date = new Date(comment.created_at).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });

    const likeActive = comment.userReaction === 'like' ? 'active' : '';
    const dislikeActive = comment.userReaction === 'dislike' ? 'active' : '';
    const deleteButton = comment.isOwner ? '<button class="comment-delete" onclick="deleteComment(\'' + comment.id + '\')">Delete</button>' : '';

    div.innerHTML = `
        <div class="comment-header">
            <span class="comment-username">${escapeHtml(comment.username)}</span>
            <span class="comment-date">${date}</span>
            ${deleteButton}
        </div>
        <div class="comment-content">${escapeHtml(comment.content)}</div>
        <div class="comment-reactions">
            <button class="reaction-btn like-btn ${likeActive}" onclick="reactToComment('${comment.id}', 'like')">
                <span class="reaction-icon">👍</span>
                <span class="reaction-count">${comment.likes}</span>
            </button>
            <button class="reaction-btn dislike-btn ${dislikeActive}" onclick="reactToComment('${comment.id}', 'dislike')">
                <span class="reaction-icon">👎</span>
                <span class="reaction-count">${comment.dislikes}</span>
            </button>
        </div>
    `;

    return div;
}

// React to a comment (like/dislike)
async function reactToComment(commentId, reactionType) {
    const user = await Auth.getCurrentUser();
    if (!user) {
        window.location.href = 'signin.html?redirect=' + encodeURIComponent(window.location.href);
        return;
    }

    const supabase = await Auth.initSupabase();

    // Check if user already reacted
    const { data: existingReaction } = await supabase
        .from('comment_reactions')
        .select('id, reaction_type')
        .eq('comment_id', commentId)
        .eq('user_id', user.id)
        .single();

    try {
        if (existingReaction) {
            if (existingReaction.reaction_type === reactionType) {
                // Remove reaction (clicked same reaction again)
                await supabase
                    .from('comment_reactions')
                    .delete()
                    .eq('id', existingReaction.id);
            } else {
                // Update reaction
                await supabase
                    .from('comment_reactions')
                    .update({ reaction_type: reactionType })
                    .eq('id', existingReaction.id);
            }
        } else {
            // Add new reaction
            await supabase
                .from('comment_reactions')
                .insert({
                    comment_id: commentId,
                    user_id: user.id,
                    reaction_type: reactionType
                });
        }

        // Refresh comments
        await loadComments();
    } catch (error) {
        console.error('Error reacting to comment:', error);
    }
}

// Delete a comment
async function deleteComment(commentId) {
    if (!confirm('Are you sure you want to delete this comment?')) {
        return;
    }

    const user = await Auth.getCurrentUser();
    if (!user) return;

    const supabase = await Auth.initSupabase();

    try {
        await supabase
            .from('comments')
            .delete()
            .eq('id', commentId)
            .eq('user_id', user.id);

        await loadComments();
    } catch (error) {
        console.error('Error deleting comment:', error);
        alert('Failed to delete comment. Please try again.');
    }
}

// Update load more button visibility
function updateLoadMoreButton(loadedCount) {
    const loadMoreBtn = document.getElementById('load-more-comments');
    if (!loadMoreBtn) return;

    if (loadedCount < COMMENTS_PER_PAGE) {
        loadMoreBtn.style.display = 'none';
    } else {
        loadMoreBtn.style.display = 'inline-block';
    }
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Load more comments
let currentOffset = 0;
async function loadMoreComments() {
    currentOffset += COMMENTS_PER_PAGE;
    await loadComments(currentOffset);
}

// Initialize on page load
let commentsInitialized = false;
document.addEventListener('DOMContentLoaded', async () => {
    // Wait for auth to be ready
    await Auth.initSupabase();
    await Auth.updateAuthUI();

    // Initialize comments if we're on the home page
    if (document.getElementById('comments-section') && !commentsInitialized) {
        commentsInitialized = true;
        await initComments();
    }
});

// Make functions globally available
window.reactToComment = reactToComment;
window.deleteComment = deleteComment;
window.loadMoreComments = loadMoreComments;
