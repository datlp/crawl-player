function resetAndFetch() {
    videos = [];
    currentPage = 1;
    hasMore = true;
    isLoading = false;
    currentFetchId++;
    currentVideoIndex = -1;
    currentDetailIndex = -1;
    galleryGrid.innerHTML = '';
    document.getElementById('profile-gallery-grid').innerHTML = '';
    galleryGrid.scrollTop = 0;
    document.getElementById('profile-gallery-grid').scrollTop = 0;
    document.getElementById('video-search').placeholder = 'Tìm kiếm videos...';
    fetchTabCounts();
    if (currentTab !== 'you') {
        fetchVideos();
    }
}

function switchGalleryTab(tabKey) {
    const p = getBaseUrlParams();
    if (tabKey === 'you') {
        p.delete('tab');
        history.pushState(null, '', `/?${p.toString()}#profile`);
        handleNavigation();
        return;
    }
    p.set('tab', tabKey);
    p.delete('watch');
    p.delete('video');
    if (tabKey !== 'related') {
        p.delete('id');
    } else {
        const currentId = new URLSearchParams(window.location.search).get('id') || (currentPlayingVideo ? currentPlayingVideo.id : '');
        if (currentId) {
            p.set('id', currentId);
        }
    }
    let hash = '';
    if (['favorites', 'recent', 'frequent'].includes(tabKey)) {
        hash = '#profile';
    }
    history.pushState(null, '', `/?${p.toString()}${hash}`);
    handleNavigation();
}

Object.keys(tabMapping).forEach(key => {
    const btn = document.getElementById(tabMapping[key]);
    if (btn) btn.addEventListener('click', () => switchGalleryTab(key));
});

async function fetchTabCounts() {
    try {
        const relatedVidId = new URLSearchParams(window.location.search).get('id') || (currentPlayingVideo ? currentPlayingVideo.id : '');
        const res = await apiFetch(`/api/counts?search_key=${encodeURIComponent(searchKey || '')}&video_id=${encodeURIComponent(relatedVidId)}`);
        if (res) {
            const keys = ['all', 'favorites', 'recent', 'frequent', 'global_frequent', 'unwatched', 'related'];
            keys.forEach(key => {
                const badge = document.getElementById(`badge-${key}`);
                if (badge) {
                    badge.innerText = formatCount(res[key] || 0);
                }
            });
        }
    } catch (e) {
        console.error("Lỗi lấy số lượng videos:", e);
    }
}

async function fetchVideos() {
    if (isLoading || !hasMore || currentTab === 'you') return;
    isLoading = true;
    
    const isProfileTab = ['favorites', 'recent', 'frequent'].includes(currentTab);
    const loadMoreEl = document.getElementById(isProfileTab ? 'profile-load-more' : 'load-more');
    const targetGrid = document.getElementById(isProfileTab ? 'profile-gallery-grid' : 'gallery-grid');
    
    loadMoreEl.style.display = 'block';

    const fetchId = currentFetchId;

    try {
        let relatedVidId = '';
        if (currentTab === 'related') {
            relatedVidId = new URLSearchParams(window.location.search).get('id') || (currentPlayingVideo ? currentPlayingVideo.id : '');
            if (!relatedVidId) {
                isLoading = false;
                loadMoreEl.style.display = 'none';
                targetGrid.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; color: #888; padding: 20px;">Vui lòng chọn hoặc xem một video trước để hiển thị các video tương tự.</div>';
                const relatedBadge = document.getElementById('badge-related');
                if (relatedBadge) relatedBadge.innerText = '0';
                return;
            }
        }

        let url = `${API_URL}?page=${currentPage}&search_key=${encodeURIComponent(searchKey || '')}&tab=${currentTab || 'all'}`;
        if (currentTab === 'related') {
            url += `&video_id=${encodeURIComponent(relatedVidId)}`;
        }
        const data = await apiFetch(url);
        
        if (fetchId !== currentFetchId) return;

        if (data.total !== undefined) {
            document.getElementById('video-search').placeholder = `Tìm kiếm trong ${data.total} videos...`;
        }
        
        if (data.items && data.items.length > 0) {
            const startIndex = videos.length;
            videos = videos.concat(data.items);
            
            data.items.forEach((video, i) => {
                const idx = startIndex + i;
                const item = document.createElement('div');
                item.className = 'gallery-item';
                item.dataset.id = video.id;
                if (idx === currentVideoIndex) {
                    item.classList.add('active');
                }
                item.id = `gallery-item-${idx}`;
                
                let dateStr = '';
                if (video.added_at) {
                    dateStr = `<span class="material-symbols-outlined" style="font-size: 14px; vertical-align: text-bottom; margin-right: 2px;">schedule</span>${formatTimeAgo(video.added_at)}`;
                } else if (video.release_date) {
                    dateStr = `<span class="material-symbols-outlined" style="font-size: 14px; vertical-align: text-bottom; margin-right: 2px;">calendar_today</span>${formatTimeAgo(video.release_date)}`;
                }
                
                const isFavTab = currentTab === 'favorites';
                const favClass = isFavTab ? 'favorited' : '';
                const favIcon = isFavTab ? 'favorite' : 'favorite_border';

                item.innerHTML = `
                    <div class="gallery-item-thumb" style="background-image: url('${video.cover}')">
                        <div class="item-fav-btn ${favClass}" data-id="${video.id}" title="Yêu thích">
                            <span class="material-symbols-outlined">${favIcon}</span>
                        </div>
                        <div class="item-view-count" title="Lượt xem">
                            <span class="material-symbols-outlined">visibility</span>
                            <span>${video.views || 0}</span>
                        </div>
                    </div>
                    <div class="item-info">
                        <div class="item-title">${video.title}</div>
                        <div class="item-meta"><span>${dateStr}</span></div>
                    </div>
                `;

                const favBtn = item.querySelector('.item-fav-btn');
                favBtn.onclick = (e) => {
                    e.stopPropagation();
                    const isFav = favBtn.classList.contains('favorited');
                    favBtn.classList.toggle('favorited', !isFav);
                    favBtn.querySelector('.material-symbols-outlined').innerText = !isFav ? 'favorite' : 'favorite_border';
                    if (typeof toggleFavorite === 'function') {
                        toggleFavorite(video.id, e.clientX, e.clientY, isFav ? 'remove' : 'add');
                    }
                };

                item.querySelector('.gallery-item-thumb').onclick = (e) => {
                    e.stopPropagation();
                    const p = getBaseUrlParams();
                    p.set('watch', video.id);
                    history.pushState(null, '', `/?${p.toString()}`);
                    handleNavigation();
                };
                item.querySelector('.item-info').onclick = (e) => {
                    e.stopPropagation();
                    const p = getBaseUrlParams();
                    p.set('video', video.id);
                    history.pushState(null, '', `/?${p.toString()}`);
                    handleNavigation();
                };
                targetGrid.appendChild(item);
            });
            currentPage++;
        } else {
            hasMore = false;
            if (videos.length === 0) {
                titleEl.innerText = 'Không tìm thấy kết quả';
                if (isProfileTab) {
                    targetGrid.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; color: #888; padding: 20px;">Không có video nào</div>';
                }
            }
        }
    } catch (error) {
        console.error('Fetch error:', error);
    } finally {
        if (fetchId === currentFetchId) {
            isLoading = false;
            loadMoreEl.style.display = 'none';
        }
    }
}

let galleryStartX = 0;
let galleryStartY = 0;
const galleryTabsOrder = ['all', 'global_frequent', 'unwatched', 'related'];
galleryPage.addEventListener('touchstart', e => {
    galleryStartX = e.changedTouches[0].clientX;
    galleryStartY = e.changedTouches[0].clientY;
}, {passive: true});
galleryPage.addEventListener('touchend', e => {
    if (e.target.closest('#gallery-tabs') || e.target.closest('#search-suggestions') || Math.abs(e.changedTouches[0].clientX - galleryStartX) < 10) return; 
    const dx = e.changedTouches[0].clientX - galleryStartX;
    const dy = e.changedTouches[0].clientY - galleryStartY;

    // Vuốt xuống (Swipe down) trên thanh tìm kiếm/header hoặc khi đang ở đỉnh trang để đóng Gallery
    if (dy > 60 && Math.abs(dy) > Math.abs(dx)) {
        const isHeader = e.target.closest('#search-container');
        const isAtTop = !galleryGrid || galleryGrid.scrollTop <= 0;
        if (isHeader || isAtTop) {
            if (typeof closeGalleryPage === 'function') {
                closeGalleryPage();
                return;
            }
        }
    }

    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 50) {
        const currentIndex = galleryTabsOrder.indexOf(currentTab || 'all');
        if (dx > 0) {
            if (currentIndex > 0) {
                switchGalleryTab(galleryTabsOrder[currentIndex - 1]);
                document.getElementById(tabMapping[galleryTabsOrder[currentIndex - 1]])?.scrollIntoView({behavior: 'smooth', block: 'nearest', inline: 'center'});
            } else {
                if (typeof closeGalleryPage === 'function') closeGalleryPage();
            }
        } else {
            if (currentIndex < galleryTabsOrder.length - 1) {
                switchGalleryTab(galleryTabsOrder[currentIndex + 1]);
                document.getElementById(tabMapping[galleryTabsOrder[currentIndex + 1]])?.scrollIntoView({behavior: 'smooth', block: 'nearest', inline: 'center'});
            }
        }
    }
}, {passive: true});

galleryGrid.addEventListener('scroll', () => {
    if (galleryGrid.scrollTop + galleryGrid.clientHeight >= galleryGrid.scrollHeight - 100) {
        fetchVideos();
    }
});

document.getElementById('profile-gallery-grid').addEventListener('scroll', () => {
    const grid = document.getElementById('profile-gallery-grid');
    if (grid.scrollTop + grid.clientHeight >= grid.scrollHeight - 100) {
        fetchVideos();
    }
});
