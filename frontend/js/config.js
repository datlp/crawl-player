const API_URL = '/api/videos';
let videos = [];
let currentPage = 1;
let isLoading = false;
let hasMore = true;
let searchKey = null;
let currentTab = null;
let currentVideoIndex = -1;
let currentDetailIndex = -1;
let currentPlayingVideo = null;
let currentRenderId = 0;
let lastNavTime = 0;
let currentFetchId = 0;

let isSeekingUI = false;
let seekThrottleTimeout = null;
let pendingSeekTime = null;
let lastSeekTime = 0;

let searchTimeout = null;
let activePlayer = null;

const SESSION_KEY = 'missav_remote_session_id';
const EXPIRE_KEY = 'missav_remote_session_expire';
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const TEN_DAYS_MS = 10 * 24 * 60 * 60 * 1000;

let sessionId = localStorage.getItem(SESSION_KEY);
let sessionExpire = localStorage.getItem(EXPIRE_KEY);
let missavJwt = localStorage.getItem('missav_jwt');
let missavUsername = localStorage.getItem('missav_username');

const loadingIndicator = document.getElementById('loading');
const mediaContainer = document.getElementById('media-container');
const titleEl = document.getElementById('title');
const overlay = document.getElementById('overlay');
const seekBar = document.getElementById('seek-bar');
const timeDisplay = document.getElementById('time-display');
const progressContainer = document.getElementById('progress-container');
const galleryPage = document.getElementById('gallery-page');
const galleryGrid = document.getElementById('gallery-grid');
const videoSearchInput = document.getElementById('video-search');
const clearSearchBtn = document.getElementById('clear-search');
const submitSearchBtn = document.getElementById('submit-search');
const btnPlayPause = document.getElementById('btn-play-pause');
const profilePage = document.getElementById('profile-page');
const detailsPage = document.getElementById('details-page');
const fastSeekIndicator = document.getElementById('fast-seek-indicator');

const tabMapping = {
    'all': 'tabAll',
    'global_frequent': 'tabGlobalFrequent',
    'unwatched': 'tabUnwatched',
    'related': 'tabRelated',
    'favorites': 'tabProfileFav',
    'recent': 'tabProfileRecent',
    'frequent': 'tabProfileFrequent',
    'you': 'tabProfileYou'
};

function showToast(msg, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerText = msg;
    container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function hide(el) { if(el) el.style.display = 'none'; }
function show(el, display = 'block') { if(el) el.style.display = display; }

function formatCount(num) {
    if (num >= 1000000000) return (num / 1000000000).toFixed(1).replace(/\.0$/, '') + 'b';
    if (num >= 1000000) return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'm';
    if (num >= 1000) return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
    return num;
}

function debounce(func, wait) {
    let timeout;
    return function (...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), wait);
    };
}

function formatTime(seconds) {
    if (isNaN(seconds)) return "00:00";
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
    const s = Math.floor(seconds % 60).toString().padStart(2, '0');
    if (h > 0) {
        return `${h}:${m}:${s}`;
    }
    return `${m}:${s}`;
}

function formatTimeAgo(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return dateString;
    
    if (diffDays === 0) {
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        if (diffHours === 0) {
            const diffMins = Math.floor(diffMs / (1000 * 60));
            return diffMins <= 0 ? 'Vừa xong' : `${diffMins} phút trước`;
        }
        return `${diffHours} giờ trước`;
    }
    if (diffDays === 1) return 'Hôm qua';
    if (diffDays < 30) return `${diffDays} ngày trước`;
    
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
}
