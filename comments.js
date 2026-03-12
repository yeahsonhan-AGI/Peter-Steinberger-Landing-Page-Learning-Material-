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
            submitBtn.disabled = false; // Enable button so user can click to sign in
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

    // Fetch reaction counts and reply counts for each comment
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
                    .maybeSingle();

                userReaction = userReactions?.reaction_type || null;
            }

            // Check if current user owns this comment
            const isOwner = currentUser && currentUser.id === comment.user_id;

            // Fetch replies
            const { data: replies } = await supabase
                .from('comment_replies')
                .select('*')
                .eq('comment_id', comment.id)
                .order('created_at', { ascending: true });

            return {
                ...comment,
                likes,
                dislikes,
                userReaction,
                isOwner,
                replies: replies || []
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
    const replyCount = comment.replies?.length || 0;

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
            <button class="reaction-btn reply-btn" onclick="toggleReplyForm('${comment.id}')">
                <span class="reaction-icon">💬</span>
                <span class="reaction-count">${replyCount}</span>
            </button>
        </div>
        <div class="comment-replies-container" id="replies-${comment.id}">
            ${comment.replies.map(reply => createReplyElement(reply)).join('')}
        </div>
    `;

    return div;
}

// Create a reply element
function createReplyElement(reply) {
    const date = new Date(reply.created_at).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });

    const deleteButton = reply.is_owner ? '<button class="reply-delete" onclick="deleteReply(\'' + reply.id + '\', \'' + reply.comment_id + '\')">Delete</button>' : '';

    return `
        <div class="reply-item" data-reply-id="${reply.id}">
            <div class="reply-header">
                <span class="reply-username">${escapeHtml(reply.username)}</span>
                <span class="reply-date">${date}</span>
                ${deleteButton}
            </div>
            <div class="reply-content">${escapeHtml(reply.content)}</div>
        </div>
    `;
}

// React to a comment (like/dislike)
async function reactToComment(commentId, reactionType) {
    const user = await Auth.getCurrentUser();
    if (!user) {
        window.location.href = 'signin.html?redirect=' + encodeURIComponent(window.location.href);
        return;
    }

    const supabase = await Auth.initSupabase();

    try {
        // Check if user already reacted
        const { data: existingReaction } = await supabase
            .from('comment_reactions')
            .select('id, reaction_type')
            .eq('comment_id', commentId)
            .eq('user_id', user.id)
            .maybeSingle();

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

// Toggle reply form visibility
function toggleReplyForm(commentId) {
    const existingForm = document.getElementById(`reply-form-${commentId}`);
    if (existingForm) {
        existingForm.remove();
        return;
    }

    const commentEl = document.querySelector(`[data-comment-id="${commentId}"]`);
    const repliesContainer = commentEl.querySelector('.comment-replies-container');

    if (!repliesContainer) {
        return;
    }

    const formHtml = `
        <div class="reply-form" id="reply-form-${commentId}">
            <textarea
                class="reply-input"
                placeholder="Write a reply..."
                rows="2"
            ></textarea>
            <div class="reply-actions">
                <button class="reply-submit" onclick="submitReply('${commentId}')">Reply</button>
                <button class="reply-cancel" onclick="closeReplyForm('${commentId}')">Cancel</button>
            </div>
        </div>
    `;

    repliesContainer.insertAdjacentHTML('afterbegin', formHtml);

    // Focus on the input
    setTimeout(() => {
        document.getElementById(`reply-form-${commentId}`).querySelector('.reply-input').focus();
    }, 100);
}

// Close reply form
function closeReplyForm(commentId) {
    const form = document.getElementById(`reply-form-${commentId}`);
    if (form) {
        form.remove();
    }
}

// Submit a reply
async function submitReply(commentId) {
    const user = await Auth.getCurrentUser();
    if (!user) {
        window.location.href = 'signin.html?redirect=' + encodeURIComponent(window.location.href);
        return;
    }

    const form = document.getElementById(`reply-form-${commentId}`);
    const input = form.querySelector('.reply-input');
    const submitBtn = form.querySelector('.reply-submit');
    const content = input.value.trim();

    if (!content) {
        alert('Please write a reply first.');
        return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Posting...';

    try {
        await postReply(commentId, content, user);
        input.value = '';
        form.remove();
        await loadComments(); // Refresh to show the new reply
    } catch (error) {
        console.error('Error posting reply:', error);
        alert('Failed to post reply. Please try again.');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Reply';
    }
}

// Post a reply to a comment
async function postReply(commentId, content, user) {
    const supabase = await Auth.initSupabase();
    const username = Auth.getUsername(user);

    const { error } = await supabase
        .from('comment_replies')
        .insert({
            comment_id: commentId,
            user_id: user.id,
            username: username,
            content: content
        });

    if (error) throw error;
}

// Delete a reply
async function deleteReply(replyId, commentId) {
    if (!confirm('Are you sure you want to delete this reply?')) {
        return;
    }

    const user = await Auth.getCurrentUser();
    if (!user) return;

    const supabase = await Auth.initSupabase();

    try {
        await supabase
            .from('comment_replies')
            .delete()
            .eq('id', replyId)
            .eq('user_id', user.id);

        await loadComments();
    } catch (error) {
        console.error('Error deleting reply:', error);
        alert('Failed to delete reply. Please try again.');
    }
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
    console.log('DOM loaded, initializing comments system...');

    try {
        // Wait for auth to be ready
        console.log('Initializing Supabase...');
        await Auth.initSupabase();
        console.log('Updating auth UI...');
        await Auth.updateAuthUI();

        // Initialize comments if we're on the home page
        if (document.getElementById('comments-section') && !commentsInitialized) {
            console.log('Comments section found, initializing...');
            commentsInitialized = true;
            await initComments();
            console.log('Comments initialized');
        } else {
            console.log('No comments section found or already initialized');
        }
    } catch (error) {
        console.error('Failed to initialize comments system:', error);
    }
});

// Make functions globally available
window.reactToComment = reactToComment;
window.deleteComment = deleteComment;
window.loadMoreComments = loadMoreComments;
window.toggleReplyForm = toggleReplyForm;
window.submitReply = submitReply;
window.closeReplyForm = closeReplyForm;
window.deleteReply = deleteReply;
