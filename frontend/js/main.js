function getBaseUrlParams() {
    const params = new URLSearchParams();
    if (currentTab && currentTab !== 'all' && currentTab !== 'you') params.set('tab', currentTab);
    if (searchKey) params.set('searchKey', searchKey);
    return params;
}

function updateTabUI(tabKey) {
    Object.keys(tabMapping).forEach(key => {
        const btn = document.getElementById(tabMapping[key]);
        if (!btn) return;
        if (key === tabKey) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    
    if (['favorites', 'recent', 'frequent', 'you'].includes(tabKey)) {
        if (tabKey === 'you') {
            document.getElementById('profile-content-you').style.display = 'block';
            document.getElementById('profile-gallery-grid').style.display = 'none';
            document.getElementById('profile-load-more').style.display = 'none';
        } else {
            document.getElementById('profile-content-you').style.display = 'none';
            document.getElementById('profile-gallery-grid').style.display = 'grid';
        }
    }
}

function updateBottomNav(activeId) {
    document.querySelectorAll('#action-icons .action-btn').forEach(el => el.classList.remove('active'));
    if (activeId) {
        document.getElementById(activeId)?.classList.add('active');
    }
}

function handleNavigation() {
    const urlParams = new URLSearchParams(window.location.search);
    const watchId = urlParams.get('watch');
    const videoId = urlParams.get('video');
    const focusId = urlParams.get('id');
    const hash = window.location.hash;

    const urlTab = urlParams.get('tab') || 'all';
    const urlSearchKey = urlParams.get('searchKey') || '';
    
    let targetTab = urlTab;
    if (hash === '#profile') {
        if (!['favorites', 'recent', 'frequent'].includes(urlTab)) {
            targetTab = 'you';
        }
    } else if (targetTab === 'you') {
        targetTab = 'all';
    }
    
    let needReset = false;
    if (targetTab !== currentTab) {
        currentTab = targetTab;
        updateTabUI(currentTab);
        needReset = true;
    }
    if (urlSearchKey !== searchKey) {
        searchKey = urlSearchKey;
        videoSearchInput.value = searchKey;
        clearSearchBtn.style.display = searchKey ? 'block' : 'none';
        localStorage.setItem('missav_search_key', searchKey);
        needReset = true;
    }

    if (typeof updateSearchVisuals === 'function') updateSearchVisuals();

    if (needReset) {
        videos = [];
        currentPage = 1;
        hasMore = true;
        isLoading = false;
        currentFetchId++;
        currentVideoIndex = -1;
        currentDetailIndex = -1;
        galleryGrid.innerHTML = '';
        document.getElementById('video-search').placeholder = 'Tìm kiếm videos...';
        if (typeof fetchTabCounts === 'function') fetchTabCounts();
        if (typeof fetchVideos === 'function') {
            fetchVideos().then(() => {
                executeNavigationState(watchId, videoId, focusId, hash);
            });
        }
    } else {
        executeNavigationState(watchId, videoId, focusId, hash);
    }
}

function executeNavigationState(watchId, videoId, focusId, hash) {
    if (videoId) {
        profilePage.classList.remove('active');
        galleryPage.classList.remove('active');
        detailsPage.classList.add('active');
        updateBottomNav('');
        showVideoDetailById(videoId);
    } else if (watchId) {
        profilePage.classList.remove('active');
        galleryPage.classList.remove('active');
        detailsPage.classList.remove('active');
        updateBottomNav('');
        playVideoById(watchId);
    } else if (hash === '#profile' || ['favorites', 'recent', 'frequent', 'you'].includes(currentTab)) {
        profilePage.classList.add('active');
        galleryPage.classList.remove('active');
        detailsPage.classList.remove('active');
        updateBottomNav('nav-profile');
        
        let targetGrid = document.getElementById('profile-gallery-grid');
        let targetItem = null;
        if (focusId) {
            targetItem = targetGrid.querySelector(`.gallery-item[data-id="${focusId}"]`);
        }
        if (!targetItem) {
            targetItem = targetGrid.querySelector('.gallery-item.active');
        }
        targetGrid.querySelectorAll('.gallery-item.focused').forEach(el => el.classList.remove('focused'));
        if (targetItem) {
            if (focusId) targetItem.classList.add('focused');
            setTimeout(() => targetItem.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
        }
    } else {
        profilePage.classList.remove('active');
        galleryPage.classList.add('active');
        detailsPage.classList.remove('active');
        updateBottomNav(searchKey ? 'nav-search' : 'nav-list');
        
        let targetItem = null;
        if (focusId) {
            targetItem = galleryGrid.querySelector(`.gallery-item[data-id="${focusId}"]`);
        }
        if (!targetItem) {
            targetItem = galleryGrid.querySelector('.gallery-item.active');
        }

        document.querySelectorAll('.gallery-item.focused').forEach(el => el.classList.remove('focused'));
        
        if (targetItem) {
            if (focusId) targetItem.classList.add('focused');
            setTimeout(() => targetItem.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
        }
    }
}

window.addEventListener('popstate', handleNavigation);
window.addEventListener('hashchange', handleNavigation);

async function showVideoDetailById(id) {
    const idx = videos.findIndex(v => v.id === id);
    if (idx !== -1) {
        showVideoDetail(idx);
    } else {
        try {
            const res = await apiFetch(`/api/video_details?id=${id}`);
            if (res.success && res.data) {
                showVideoDetail(-1, res.data);
            }
        } catch(e) {
            console.error("Lỗi khi tải chi tiết", e);
        }
    }
}

async function playVideoById(id) {
    if (currentPlayingVideo && currentPlayingVideo.id === id) return;
    
    const idx = videos.findIndex(v => v.id === id);
    if (idx !== -1) {
        currentVideoIndex = idx;
        renderCurrentVideo();
    } else {
        try {
            const res = await apiFetch(`/api/video_details?id=${id}`);
            if (res.success && res.data) {
                videos.push(res.data);
                currentVideoIndex = videos.length - 1;
                renderCurrentVideo();
            }
        } catch(e) {
            console.error("Lỗi tải video", e);
        }
    }
}

document.getElementById('nav-profile').addEventListener('click', () => {
    const p = getBaseUrlParams();
    if (!['favorites', 'recent', 'frequent'].includes(currentTab)) {
        p.delete('tab');
    }
    history.pushState(null, '', `/?${p.toString()}#profile`);
    handleNavigation();
});

function closeProfilePage() {
    const now = Date.now();
    if (now - lastNavTime < 500) return;
    lastNavTime = now;
    if (window.location.hash === '#profile' || ['favorites', 'recent', 'frequent', 'you'].includes(currentTab)) {
        const p = getBaseUrlParams();
        p.delete('tab');
        history.pushState(null, '', `/?${p.toString()}`);
        handleNavigation();
    } else {
        profilePage.classList.remove('active');
    }
}
document.getElementById('close-profile-page').addEventListener('click', closeProfilePage);

function closeDetailsPage() {
    const now = Date.now();
    if (now - lastNavTime < 500) return;
    lastNavTime = now;
    if (new URLSearchParams(window.location.search).has('video')) {
        history.back();
    } else {
        detailsPage.classList.remove('active');
    }
}
document.getElementById('close-details-page').addEventListener('click', closeDetailsPage);

function openGalleryPage() {
    const urlParams = new URLSearchParams(window.location.search);
    if (!urlParams.has('watch') && !urlParams.has('video') && window.location.hash !== '#profile') {
        const focusId = urlParams.get('id');
        let targetItem = null;
        if (focusId) {
            targetItem = galleryGrid.querySelector(`.gallery-item[data-id="${focusId}"]`);
        }
        if (!targetItem) targetItem = galleryGrid.querySelector('.gallery-item.active');
        
        document.querySelectorAll('.gallery-item.focused').forEach(el => el.classList.remove('focused'));

        if (targetItem) {
            if (focusId) targetItem.classList.add('focused');
            targetItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
            videoSearchInput.focus();
        }
    } else {
        const p = getBaseUrlParams();
        if (currentPlayingVideo && urlParams.has('watch')) {
            p.set('id', currentPlayingVideo.id);
        } else if (urlParams.has('video')) {
            p.set('id', urlParams.get('video'));
        }
        history.pushState(null, '', `/?${p.toString()}`);
        handleNavigation();
    }
}

function closeGalleryPage() {
    const now = Date.now();
    if (now - lastNavTime < 500) return;
    lastNavTime = now;
    
    const urlParams = new URLSearchParams(window.location.search);
    if (!urlParams.has('watch') && !urlParams.has('video')) {
        if (currentPlayingVideo) {
            const p = getBaseUrlParams();
            p.set('watch', currentPlayingVideo.id);
            history.pushState(null, '', `/?${p.toString()}`);
            handleNavigation();
        }
    } else {
        history.back();
    }
}

document.getElementById('nav-list').addEventListener('click', () => {
    history.pushState(null, '', '/');
    currentTab = null;
    searchKey = null;
    handleNavigation();
    galleryGrid.scrollTop = 0;
});
document.getElementById('nav-search').addEventListener('click', () => {
    openGalleryPage();
    setTimeout(() => { document.getElementById('video-search').focus(); }, 300);
});
document.getElementById('close-gallery-page').addEventListener('click', closeGalleryPage);

titleEl.onclick = async () => {
    if (currentPlayingVideo) {
        const p = getBaseUrlParams();
        p.set('video', currentPlayingVideo.id);
        history.pushState(null, '', `/?${p.toString()}`);
        handleNavigation();
    }
};

function setupExternalLinks() {
    const hostname = window.location.hostname;
    const protocol = window.location.protocol;
    const port = window.location.port || (protocol === 'https:' ? '443' : '80');

    const links = [
        { id: 'linkJavtiful', port: '5004', name: 'Javtiful' },
        { id: 'linkMissav', port: '5003', name: 'MissAV' },
        { id: 'linkVlxx', port: '5002', name: 'VLXX' },
        { id: 'linkSextop1', port: '5001', name: 'Sextop1' }
    ];

    links.forEach(link => {
        const el = document.getElementById(link.id);
        if (el) {
            el.href = `${protocol}//${hostname}:${link.port}`;
            if (port === link.port) {
                el.classList.add('active');
                el.removeAttribute('target');
                el.href = 'javascript:void(0)';
                el.style.cursor = 'default';
                el.innerHTML = `<span class="material-symbols-outlined" style="font-size: 16px;">check_circle</span> ${link.name}`;
            }
        }
    });
}

async function initApp() {
    setupExternalLinks();
    await initSessionId();
    
    const urlParams = new URLSearchParams(window.location.search);
    let initTab = urlParams.get('tab') || 'all';
    let initSearch = urlParams.has('searchKey') ? urlParams.get('searchKey') : (localStorage.getItem('missav_search_key') || '');
    
    const p = new URLSearchParams(window.location.search);
    if (initTab !== 'all') p.set('tab', initTab);
    if (initSearch) p.set('searchKey', initSearch);
    
    let newUrl = window.location.pathname;
    const qs = p.toString();
    if (qs) newUrl += '?' + qs;
    newUrl += window.location.hash;
    
    history.replaceState(null, '', newUrl);

    handleNavigation();
    updateIdentityDisplay();
}

initApp();
