/**
 * Supabase Authentication Setup
 * This file handles user authentication for the Peter Steinberger landing page
 */

// Supabase configuration
const SUPABASE_URL = 'https://fkwczudzzmigxwejfmap.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZrd2N6dWR6em1pZ3h3ZWpmbWFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyMTUxMDksImV4cCI6MjA4ODc5MTEwOX0.iCEStD_8sfZDhbthK8AhMkrN4Nj626ZC_Nb34vcr3vs';

// Initialize Supabase client
let supabaseClient;

// Load Supabase from CDN
async function initSupabase() {
    if (supabaseClient) return supabaseClient;

    try {
        // Dynamically load Supabase library
        if (typeof supabase === 'undefined') {
            console.log('Loading Supabase CDN...');
            await loadScript('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js');
            console.log('Supabase CDN loaded successfully');
        }

        if (typeof supabase === 'undefined') {
            throw new Error('Supabase library failed to load');
        }

        supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        console.log('Supabase client initialized');
        return supabaseClient;
    } catch (error) {
        console.error('Failed to initialize Supabase:', error);
        throw error;
    }
}

function loadScript(src) {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.onload = () => {
            console.log(`Script loaded: ${src}`);
            resolve();
        };
        script.onerror = () => {
            console.error(`Failed to load script: ${src}`);
            reject(new Error(`Failed to load: ${src}`));
        };
        document.head.appendChild(script);
    });
}

// Get current session
async function getSession() {
    const supabase = await initSupabase();
    const { data: { session } } = await supabase.auth.getSession();
    return session;
}

// Get current user
async function getCurrentUser() {
    const supabase = await initSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    return user;
}

// Sign in with email and password
async function signIn(email, password) {
    const supabase = await initSupabase();
    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
    });

    if (error) {
        throw error;
    }

    return data;
}

// Sign up with email and password
async function signUp(email, password) {
    const supabase = await initSupabase();
    const { data, error } = await supabase.auth.signUp({
        email,
        password
    });

    if (error) {
        throw error;
    }

    return data;
}

// Sign out
async function signOut() {
    const supabase = await initSupabase();
    const { error } = await supabase.auth.signOut();

    if (error) {
        throw error;
    }

    // Redirect to home
    window.location.href = 'index.html';
}

// Check if user is authenticated
async function isAuthenticated() {
    const session = await getSession();
    return session !== null;
}

// Protect route - redirect to sign-in if not authenticated
async function protectRoute() {
    const authenticated = await isAuthenticated();

    if (!authenticated) {
        window.location.href = 'signin.html?redirect=' + encodeURIComponent(window.location.href);
        return false;
    }

    return true;
}

// Listen to auth state changes
function onAuthStateChange(callback) {
    initSupabase().then(supabase => {
        supabase.auth.onAuthStateChange((event, session) => {
            callback(event, session);
        });
    });
}

// Update UI based on auth state
async function updateAuthUI() {
    const user = await getCurrentUser();
    const signInLinks = document.querySelectorAll('.signin-link');
    const signOutLinks = document.querySelectorAll('.signout-link');
    const userDisplays = document.querySelectorAll('.user-display');

    // Handle comment form
    const commentInput = document.getElementById('comment-input');
    const submitBtn = document.getElementById('comment-submit');

    if (user) {
        // User is signed in
        signInLinks.forEach(link => link.style.display = 'none');
        signOutLinks.forEach(link => link.style.display = 'inline');
        userDisplays.forEach(display => {
            display.textContent = user.email || 'User';
        });

        // Enable comment form
        if (commentInput) commentInput.disabled = false;
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Post Comment';
        }
    } else {
        // User is not signed in
        signInLinks.forEach(link => link.style.display = 'inline');
        signOutLinks.forEach(link => link.style.display = 'none');
        userDisplays.forEach(display => {
            display.textContent = '';
        });

        // Disable comment form but enable button for redirect
        if (commentInput) commentInput.disabled = true;
        if (submitBtn) {
            submitBtn.disabled = false; // Enable so user can click to sign in
            submitBtn.textContent = 'Sign in to comment';
        }
    }
}

// Get username from user metadata or email
function getUsername(user) {
    return user?.user_metadata?.username || user?.email?.split('@')[0] || 'Anonymous';
}

// Export functions for use in other files
window.Auth = {
    initSupabase,
    getSession,
    getCurrentUser,
    signIn,
    signUp,
    signOut,
    isAuthenticated,
    protectRoute,
    onAuthStateChange,
    updateAuthUI,
    getUsername
};
