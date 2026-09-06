function renderChips(containerId, videoData) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';
    container.className = '';
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.gap = '12px';
    container.style.marginBottom = '15px';
    
    const createBlock = (title, items, type, icon) => {
        const block = document.createElement('div');
        block.style.display = 'flex';
        block.style.flexDirection = 'column';
        block.style.alignItems = 'center';
        
        const titleEl = document.createElement('div');
        titleEl.innerText = title;
        titleEl.style.fontSize = '12px';
        titleEl.style.color = '#888';
        titleEl.style.marginBottom = '6px';
        block.appendChild(titleEl);
        
        const chipsDiv = document.createElement('div');
        chipsDiv.className = 'chips-container';
        chipsDiv.style.marginBottom = '0';
        
        if (!items || items.length === 0 || items[0] === 'N/A' || items[0] === 'Đang tải...') {
            const emptyChip = document.createElement('span');
            emptyChip.className = `detail-chip chip-${type}`;
            emptyChip.innerHTML = `<span class="material-symbols-outlined" style="font-size: 14px; vertical-align: text-bottom; margin-right: 4px;">${icon}</span>N/A`;
            emptyChip.style.cursor = 'default';
            emptyChip.style.opacity = '0.5';
            chipsDiv.appendChild(emptyChip);
        } else {
            items.forEach(text => {
                if (!text) return;
                const chip = document.createElement('span');
                chip.className = `detail-chip chip-${type}`;
                chip.innerHTML = `<span class="material-symbols-outlined" style="font-size: 14px; vertical-align: text-bottom; margin-right: 4px;">${icon}</span>${text}`;
                chip.onclick = () => {
                    const p = getBaseUrlParams();
                    p.set('searchKey', text);
                    p.set('tab', 'all');
                    p.delete('watch');
                    p.delete('video');
                    p.delete('id');
                    history.pushState(null, '', `/?${p.toString()}`);
                    handleNavigation();
                };
                chipsDiv.appendChild(chip);
            });
        }
        
        block.appendChild(chipsDiv);
        return block;
    };

    const actresses = videoData.actress ? videoData.actress.split(',').map(s => s.trim()).filter(Boolean) : [];
    const genres = videoData.genre ? videoData.genre.split(',').map(s => s.trim()).filter(Boolean) : [];
    const makers = videoData.maker ? videoData.maker.split(',').map(s => s.trim()).filter(Boolean) : [];

    container.appendChild(createBlock('Diễn viên', actresses, 'actress', 'person'));
    container.appendChild(createBlock('Thể loại', genres, 'genre', 'label'));
    container.appendChild(createBlock('Nhà sản xuất', makers, 'maker', 'business'));
}

async function showVideoDetail(index, fallbackVideo = null) {
    let video = null;
    if (index >= 0 && index < videos.length) {
        currentDetailIndex = index;
        video = videos[index];
    } else if (fallbackVideo) {
        currentDetailIndex = -1;
        video = fallbackVideo;
    } else {
        return;
    }

    document.getElementById('details-cover').src = video.cover || '';
    document.getElementById('details-title').innerText = video.title || '';
    document.getElementById('details-date').innerText = video.release_date || 'Đang tải...';
    renderChips('details-chips', video);
    
    if (video.details && video.details.trim() !== '') {
        document.getElementById('details-desc-wrapper').style.display = 'block';
        document.getElementById('details-desc').innerText = video.details;
    } else {
        document.getElementById('details-desc-wrapper').style.display = 'none';
        document.getElementById('details-desc').innerText = '';
    }
    
    function getSourceInfo(v) {
        if (!v) return { name: 'Trang gốc', domain: '', url: '#' };
        let url = (v.url || '').trim();
        let domain = (v.domain || '').trim();
        let source = (v.source || '').trim();

        if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
            try {
                const parsed = new URL(url);
                if (!domain) domain = parsed.hostname;
            } catch(e) {}
        }

        let cleanDomain = domain ? domain.replace(/^www\./i, '') : '';

        if (!source) {
            if (cleanDomain) {
                if (cleanDomain.includes('javtiful')) source = 'Javtiful';
                else if (cleanDomain.includes('missav')) source = 'MissAV';
                else if (cleanDomain.includes('vlxx')) source = 'VLXX';
                else if (cleanDomain.includes('sextop1')) source = 'Sextop1';
                else if (cleanDomain.includes('javguru')) source = 'JavGuru';
                else source = cleanDomain;
            } else {
                source = 'Trang gốc';
            }
        }

        let displayName = source || cleanDomain || 'Trang gốc';
        let targetUrl = url;
        if (!targetUrl) {
            const baseDomain = cleanDomain || 'javtiful.com';
            const srcLower = (source || '').toLowerCase();
            if (srcLower.includes('missav')) {
                targetUrl = `https://${baseDomain}/vi/v/${v.id}`;
            } else {
                targetUrl = `https://${baseDomain}/video/${v.id}`;
            }
        } else if (targetUrl.startsWith('/')) {
            const baseDomain = cleanDomain || 'javtiful.com';
            targetUrl = `https://${baseDomain}${targetUrl}`;
        }

        return {
            name: displayName,
            domain: cleanDomain,
            url: targetUrl
        };
    }

    const setupButtons = (v) => {
        document.getElementById('btn-watch-now').onclick = () => {
            const p = getBaseUrlParams();
            p.set('watch', v.id);
            history.pushState(null, '', `/?${p.toString()}`);
            handleNavigation();
        };

        const srcInfo = getSourceInfo(v);
        const btnOpen = document.getElementById('btn-open-javtiful');
        if (btnOpen) {
            btnOpen.innerHTML = `<span class="material-symbols-outlined">language</span> ${srcInfo.name}`;
            btnOpen.onclick = () => window.open(srcInfo.url, '_blank');
        }

        document.getElementById('btn-search-list').onclick = () => {
            const p = getBaseUrlParams();
            p.set('id', v.id);
            p.delete('watch');
            p.delete('video');
            history.pushState(null, '', `/?${p.toString()}`);
            handleNavigation();
        };
    };
    setupButtons(video);
    
    try {
        const res = await apiFetch(`/api/video_details?id=${video.id}`);
        if (res.success && res.data) {
            const d = res.data;
            document.getElementById('details-cover').src = d.cover || '';
            document.getElementById('details-title').innerText = d.title || '';
            document.getElementById('details-date').innerText = d.release_date || 'N/A';
            renderChips('details-chips', d);
            
            if (d.details && d.details.trim() !== '') {
                document.getElementById('details-desc-wrapper').style.display = 'block';
                document.getElementById('details-desc').innerText = d.details;
            } else {
                document.getElementById('details-desc-wrapper').style.display = 'none';
            }
            
            setupButtons(d);
        }
    } catch(e) {
        console.error("Lỗi khi tải chi tiết", e);
    }
}

let detailStartX = 0;
let detailStartY = 0;
detailsPage.addEventListener('touchstart', e => {
    detailStartX = e.changedTouches[0].clientX;
    detailStartY = e.changedTouches[0].clientY;
}, {passive: true});
detailsPage.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - detailStartX;
    const dy = e.changedTouches[0].clientY - detailStartY;
    
    // Vuốt xuống (Swipe down) để đóng / ẩn drawer chi tiết video
    if (dy > 60 && Math.abs(dy) > Math.abs(dx)) {
        const isHeader = e.target.closest('.page-header');
        const contentEl = document.getElementById('details-content');
        const isAtTop = !contentEl || contentEl.scrollTop <= 0;
        
        if (isHeader || isAtTop) {
            if (typeof closeDetailsPage === 'function') {
                closeDetailsPage();
                return;
            }
        }
    }

    // Vuốt ngang chuyển video trước/kế tiếp
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 50) {
        if (dx > 0) {
            if (currentDetailIndex > 0) {
                const prevVid = videos[currentDetailIndex - 1];
                const p = getBaseUrlParams(); p.set('video', prevVid.id);
                history.replaceState(null, '', `/?${p.toString()}`);
                handleNavigation();
            }
        } else {
            if (currentDetailIndex !== -1 && currentDetailIndex < videos.length - 1) {
                const nextVid = videos[currentDetailIndex + 1];
                const p = getBaseUrlParams(); p.set('video', nextVid.id);
                history.replaceState(null, '', `/?${p.toString()}`);
                handleNavigation();
            } else if (currentDetailIndex !== -1 && hasMore) {
                if (typeof fetchVideos === 'function') {
                    fetchVideos().then(() => {
                        if (currentDetailIndex < videos.length - 1) {
                            const nextVid = videos[currentDetailIndex + 1];
                            const p = getBaseUrlParams(); p.set('video', nextVid.id);
                            history.replaceState(null, '', `/?${p.toString()}`);
                            handleNavigation();
                        }
                    });
                }
            }
        }
    }
}, {passive: true});

const imageViewer = document.getElementById('image-viewer');
const fsImage = document.getElementById('fullscreen-image');
const closeImageViewer = document.getElementById('close-image-viewer');

if (document.getElementById('details-cover') && imageViewer && fsImage && closeImageViewer) {
    document.getElementById('details-cover').addEventListener('click', () => {
        const src = document.getElementById('details-cover').src;
        if (src) {
            fsImage.src = src;
            imageViewer.style.display = 'flex';
            fsCurrentScale = 1;
            fsTranslateX = 0;
            fsTranslateY = 0;
            updateImageTransform();
        }
    });

    closeImageViewer.addEventListener('click', () => {
        imageViewer.style.display = 'none';
    });

    let fsCurrentScale = 1;
    let fsTranslateX = 0, fsTranslateY = 0;
    let fsStartDistance = 0;
    let fsInitialScale = 1;
    let fsIsPanning = false;
    let fsStartPanX = 0, fsStartPanY = 0;
    let fsInitialPanX = 0, fsInitialPanY = 0;

    imageViewer.addEventListener('touchstart', (e) => {
        if (e.touches.length === 2) {
            fsStartDistance = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
            fsInitialScale = fsCurrentScale;
            fsIsPanning = false;
        } else if (e.touches.length === 1) {
            fsIsPanning = true;
            fsStartPanX = e.touches[0].clientX;
            fsStartPanY = e.touches[0].clientY;
            fsInitialPanX = fsTranslateX;
            fsInitialPanY = fsTranslateY;
        }
    }, { passive: false });

    imageViewer.addEventListener('touchmove', (e) => {
        e.preventDefault();
        if (e.touches.length === 2) {
            const currentDistance = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
            fsCurrentScale = Math.min(Math.max(1, fsInitialScale * (currentDistance / fsStartDistance)), 5);
            if (fsCurrentScale === 1) { fsTranslateX = 0; fsTranslateY = 0; }
            updateImageTransform();
        } else if (e.touches.length === 1 && fsIsPanning && fsCurrentScale > 1) {
            fsTranslateX = fsInitialPanX + (e.touches[0].clientX - fsStartPanX);
            fsTranslateY = fsInitialPanY + (e.touches[0].clientY - fsStartPanY);
            updateImageTransform();
        }
    }, { passive: false });

    let fsLastTap = 0;
    imageViewer.addEventListener('touchend', (e) => {
        if (e.changedTouches.length === 1) {
            const currentTime = new Date().getTime();
            const tapLength = currentTime - fsLastTap;
            if (tapLength < 300 && tapLength > 0) {
                if (fsCurrentScale > 1) { fsCurrentScale = 1; fsTranslateX = 0; fsTranslateY = 0; }
                else { fsCurrentScale = 2.5; }
                updateImageTransform();
            }
            fsLastTap = currentTime;
        }
    });

    function updateImageTransform() {
        fsImage.style.transform = `translate(${fsTranslateX}px, ${fsTranslateY}px) scale(${fsCurrentScale})`;
    }
}
