function throttledSeek(time) {
    pendingSeekTime = time;
    const now = Date.now();
    
    if (activePlayer && activePlayer.duration()) {
        const duration = activePlayer.duration();
        seekBar.value = (time / duration) * 100;
        timeDisplay.innerText = `${formatTime(time)} / ${formatTime(duration)}`;
    }

    if (!seekThrottleTimeout) {
        const delay = Math.max(0, 300 - (now - lastSeekTime));
        seekThrottleTimeout = setTimeout(() => {
            if (activePlayer && pendingSeekTime !== null) {
                activePlayer.currentTime(pendingSeekTime);
                lastSeekTime = Date.now();
            }
            seekThrottleTimeout = null;
        }, delay);
    }
}

function updateFavoriteIcon(isFavorited) {
    const favIcon = document.getElementById('fav-icon');
    if (favIcon) {
        if (isFavorited) {
            favIcon.innerText = 'favorite';
            favIcon.style.color = '#ff4081';
            favIcon.style.fontVariationSettings = "'FILL' 1";
        } else {
            favIcon.innerText = 'favorite_border';
            favIcon.style.color = '#fff';
            favIcon.style.fontVariationSettings = "'FILL' 0";
        }
    }
}

async function checkFavoriteStatus(vidId) {
    try {
        const res = await apiFetch(`/api/favorites/status?video_id=${vidId}`);
        updateFavoriteIcon(res.is_favorited);
    } catch (e) {
        updateFavoriteIcon(false);
    }
}

async function renderCurrentVideo() {
    if (videos.length === 0) return;
    if (currentVideoIndex >= videos.length) currentVideoIndex = videos.length - 1;
    if (currentVideoIndex < 0) currentVideoIndex = 0;

    const renderId = ++currentRenderId;
    const video = videos[currentVideoIndex];
    currentPlayingVideo = video;
    titleEl.innerText = video.title;
    
    checkFavoriteStatus(video.id);
    
    if (activePlayer) {
        activePlayer.dispose();
        activePlayer = null;
    }
    
    mediaContainer.innerHTML = '';
    progressContainer.style.display = 'none';
    loadingIndicator.style.display = 'block';

    document.querySelectorAll('.gallery-item').forEach(el => el.classList.remove('active'));
    const activeItem = document.getElementById(`gallery-item-${currentVideoIndex}`);
    if (activeItem) {
        activeItem.classList.add('active');
    }

    try {
        const data = await apiFetch(`/api/video_url?id=${encodeURIComponent(video.id)}`);
        
        if (renderId !== currentRenderId) return;

        if (data.success && data.url) {
            let cleanUrl = data.url.split('#')[0];
            let url = `/api/proxy?url=${encodeURIComponent(cleanUrl)}`;
            
            let videoType = 'video/mp4';
            if (cleanUrl.includes('.m3u8') || cleanUrl.includes('.vl')) {
                videoType = 'application/x-mpegURL';
            }
            
            const videoEl = document.createElement('video');
            videoEl.id = 'vjs-current-video';
            videoEl.className = 'video-js vjs-default-skin';
            videoEl.setAttribute('playsinline', 'playsinline');
            mediaContainer.appendChild(videoEl);

            activePlayer = videojs('vjs-current-video', {
                sources: [{ src: url, type: videoType }],
                autoplay: true,
                loop: true,
                controls: false,
                muted: false,
                fill: true,
                html5: {
                    vhs: { 
                        overrideNative: true,
                        enableLowInitialPlaylist: true,
                        fastQualityChange: true
                    }
                }
            });

            activePlayer.on('play', () => { document.getElementById('play-pause-icon').innerText = 'pause'; });
            activePlayer.on('pause', () => { document.getElementById('play-pause-icon').innerText = 'play_arrow'; });

            activePlayer.on('timeupdate', () => {
                if (isDraggingSeek || isSeekingUI) return;
                const duration = activePlayer.duration();
                if (duration) {
                    seekBar.value = (activePlayer.currentTime() / duration) * 100;
                    timeDisplay.innerText = `${formatTime(activePlayer.currentTime())} / ${formatTime(duration)}`;
                }
            });
            
            activePlayer.on('loadedmetadata', () => {
                timeDisplay.innerText = `${formatTime(0)} / ${formatTime(activePlayer.duration())}`;
                loadingIndicator.style.display = 'none';
            });

            let errorRetryCount = 0;
            activePlayer.on('error', async () => {
                if (errorRetryCount < 3) {
                    errorRetryCount++;
                    const currentTime = activePlayer.currentTime() || 0;
                    console.log(`Lỗi tải video, thử lấy link mới lần ${errorRetryCount}...`);
                    showToast(`Đang thử lại link mới lần ${errorRetryCount}/3...`, "warning");
                    loadingIndicator.style.display = 'block';
                    try {
                        const newData = await apiFetch(`/api/video_url?id=${encodeURIComponent(video.id)}&refresh=true`);
                        if (renderId !== currentRenderId) return;
                        if (newData.success && newData.url) {
                            let cleanNewUrl = newData.url.split('#')[0];
                            let newUrl = `/api/proxy?url=${encodeURIComponent(cleanNewUrl)}`;
                            let newVideoType = 'video/mp4';
                            if (cleanNewUrl.includes('.m3u8') || cleanNewUrl.includes('.vl')) {
                                newVideoType = 'application/x-mpegURL';
                            }
                            
                            activePlayer.error(null);
                            activePlayer.src({ src: newUrl, type: newVideoType });
                            
                            activePlayer.one('loadedmetadata', () => {
                                if (currentTime > 0) activePlayer.currentTime(currentTime);
                            });
                            
                            let playPromise = activePlayer.play();
                            if (playPromise !== undefined) {
                                playPromise.catch(e => {
                                    activePlayer.muted(true);
                                    activePlayer.play();
                                });
                            }
                        } else {
                            loadingIndicator.style.display = 'none';
                            showToast("Lỗi lấy link mới", "error");
                        }
                    } catch (err) {
                        console.error(err);
                        loadingIndicator.style.display = 'none';
                        showToast("Lỗi kết nối khi lấy link", "error");
                    }
                } else {
                    loadingIndicator.style.display = 'none';
                    showToast("Lỗi video, không thể phát sau 3 lần thử.", "error");
                }
            });

            seekBar.onmousedown = () => { isSeekingUI = true; };
            seekBar.ontouchstart = () => { isSeekingUI = true; };
            
            seekBar.oninput = (e) => {
                isSeekingUI = true;
                if (activePlayer && activePlayer.duration()) {
                    const newTime = (e.target.value / 100) * activePlayer.duration();
                    throttledSeek(newTime);
                    fastSeekIndicator.innerHTML = formatTime(newTime);
                    fastSeekIndicator.style.display = 'block';
                }
            };

            seekBar.onchange = (e) => {
                isSeekingUI = false;
                if (activePlayer && activePlayer.duration()) {
                    const newTime = (e.target.value / 100) * activePlayer.duration();
                    if (pendingSeekTime !== null) {
                        activePlayer.currentTime(newTime);
                        pendingSeekTime = null;
                    }
                    fastSeekIndicator.style.display = 'none';
                }
            };

            progressContainer.style.display = 'flex';
            
            activePlayer.ready(() => {
                let playPromise = activePlayer.play();
                if (playPromise !== undefined) {
                    playPromise.catch(e => {
                        console.log("Autoplay bị chặn, thử mute video", e);
                        activePlayer.muted(true);
                        activePlayer.play();
                    });
                }
                apiFetch('/api/history/record', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ video_id: video.id })
                }).catch(() => {});
            });
        } else {
            loadingIndicator.style.display = 'none';
            titleEl.innerText = "Lỗi không lấy được link video";
        }
    } catch (err) {
        loadingIndicator.style.display = 'none';
        console.error(err);
    }

    if (currentVideoIndex >= videos.length - 4) {
        if (typeof fetchVideos === 'function') fetchVideos();
    }
}

function nextVideo() {
    if (videos.length === 0) return;
    if (currentVideoIndex < videos.length - 1) {
        const nextVid = videos[currentVideoIndex + 1];
        const p = getBaseUrlParams(); p.set('watch', nextVid.id);
        history.replaceState(null, '', `/?${p.toString()}`);
        handleNavigation();
    } else {
        if (typeof fetchVideos === 'function') {
            fetchVideos().then(() => {
                if (currentVideoIndex < videos.length - 1) {
                    const nextVid = videos[currentVideoIndex + 1];
                    const p = getBaseUrlParams(); p.set('watch', nextVid.id);
                    history.replaceState(null, '', `/?${p.toString()}`);
                    handleNavigation();
                }
            });
        }
    }
}

function prevVideo() {
    if (currentVideoIndex > 0) {
        const prevVid = videos[currentVideoIndex - 1];
        const p = getBaseUrlParams(); p.set('watch', prevVid.id);
        history.replaceState(null, '', `/?${p.toString()}`);
        handleNavigation();
    }
}

document.getElementById('btn-next')?.addEventListener('click', nextVideo);
document.getElementById('btn-prev')?.addEventListener('click', prevVideo);

btnPlayPause.addEventListener('click', () => {
    if (activePlayer) {
        if (activePlayer.paused()) {
            activePlayer.play();
        } else {
            activePlayer.pause();
        }
    }
});

document.getElementById('btn-fullscreen').addEventListener('click', () => {
    if (!document.fullscreenElement && !document.webkitFullscreenElement && !document.msFullscreenElement) {
        let promise;
        if (document.documentElement.requestFullscreen) {
            promise = document.documentElement.requestFullscreen();
        } else if (document.documentElement.webkitRequestFullscreen) {
            promise = document.documentElement.webkitRequestFullscreen();
        } else if (document.documentElement.msRequestFullscreen) {
            promise = document.documentElement.msRequestFullscreen();
        }
        
        const lockLandscape = () => {
            const isPortrait = window.innerHeight > window.innerWidth;
            if (isPortrait && screen.orientation && typeof screen.orientation.lock === 'function') {
                screen.orientation.lock('landscape').catch(err => {
                    console.warn("Orientation lock failed: ", err);
                });
            }
        };

        try {
            history.pushState({ fullscreen: true }, '');
        } catch(e) {}

        if (promise && typeof promise.then === 'function') {
            promise.then(lockLandscape).catch(err => {
                console.warn("Fullscreen request failed: ", err);
                if (history.state && history.state.fullscreen) {
                    history.back();
                }
            });
        } else {
            setTimeout(lockLandscape, 200);
        }
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
        } else if (document.msExitFullscreen) {
            document.msExitFullscreen();
        }
    }
});

const handleFullscreenChange = () => {
    if (!document.fullscreenElement && !document.webkitFullscreenElement && !document.msFullscreenElement) {
        if (screen.orientation && typeof screen.orientation.unlock === 'function') {
            try {
                screen.orientation.unlock();
            } catch(err) {
                console.warn("Orientation unlock failed on exit: ", err);
            }
        }
        if (history.state && history.state.fullscreen) {
            history.back();
        }
    }
};
document.addEventListener('fullscreenchange', handleFullscreenChange);
document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
document.addEventListener('msfullscreenchange', handleFullscreenChange);

window.addEventListener('popstate', (e) => {
    if (!history.state || !history.state.fullscreen) {
        if (document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement) {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            } else if (document.webkitExitFullscreen) {
                document.webkitExitFullscreen();
            } else if (document.msExitFullscreen) {
                document.msExitFullscreen();
            }
        }
    }
});

document.getElementById('btn-sync').addEventListener('click', () => {
    apiFetch('/api/sync').then(data => {
        if(data.success) {
            if (typeof resetAndFetch === 'function') resetAndFetch();
        }
    });
});

let wasHolding = false;
let holdResetTimeout;
let fastSeekInterval = null;
let originalPlaybackRate = 1;
let originalWasPlaying = false;
let isFastSeekingActive = false;

function startFastSeek(player, speed) {
    if (isFastSeekingActive) {
        if (fastSeekInterval) {
            clearInterval(fastSeekInterval);
            fastSeekInterval = null;
        }
    } else {
        originalPlaybackRate = player.playbackRate();
        originalWasPlaying = !player.paused();
        isFastSeekingActive = true;
    }
    
    if (speed > 0) {
        player.playbackRate(speed);
        if (!originalWasPlaying) player.play();
    } else {
        player.pause();
        fastSeekInterval = setInterval(() => {
            let newTime = player.currentTime() + (speed * 0.1);
            if (newTime < 0) newTime = 0;
            player.currentTime(newTime);
            if (newTime === 0) stopFastSeek();
        }, 100);
    }
}

function stopFastSeek() {
    if (!isFastSeekingActive) return;
    isFastSeekingActive = false;
    
    if (!activePlayer) return;
    const player = activePlayer;
    
    if (fastSeekInterval) {
        clearInterval(fastSeekInterval);
        fastSeekInterval = null;
        if (originalWasPlaying) player.play();
    } else {
        player.playbackRate(originalPlaybackRate);
        if (!originalWasPlaying) player.pause();
    }
}

function handleHold(clientX) {
    wasHolding = true;
    if (!activePlayer) return;
    
    const isLeftHalf = clientX < window.innerWidth / 2;
    const player = activePlayer;
    
    if (isLeftHalf) {
        startFastSeek(player, -4);
    } else {
        startFastSeek(player, 4);
    }
}

function clearHoldState() {
    if (wasHolding) {
        stopFastSeek();
        clearTimeout(holdResetTimeout);
        holdResetTimeout = setTimeout(() => { wasHolding = false; }, 300);
    }
}

document.getElementById('btn-favorite').addEventListener('click', (e) => {
    if (currentPlayingVideo) toggleFavorite(currentPlayingVideo.id, undefined, undefined, 'toggle');
});

function toggleFavorite(vidId, x, y, action = 'toggle') {
    if (x !== undefined && y !== undefined) {
        const heartEl = document.getElementById('heart-animation');
        if (heartEl) {
            heartEl.style.left = (x - 40) + 'px';
            heartEl.style.top = (y - 40) + 'px';
            heartEl.style.display = 'block';
            heartEl.classList.remove('animate-heart');
            void heartEl.offsetWidth; 
            heartEl.classList.add('animate-heart');
            setTimeout(() => { heartEl.style.display = 'none'; }, 800);
        }
    }
    apiFetch('/api/favorites/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ video_id: vidId, action: action })
    }).then(res => {
        if (res.success) {
            if (action === 'toggle') {
                if (res.added) showToast('Đã thêm vào yêu thích', 'success');
                else showToast('Đã xoá khỏi yêu thích', 'info');
            }
            
            if (currentPlayingVideo && currentPlayingVideo.id === vidId) {
                updateFavoriteIcon(res.added);
            }
            
            const galleryItems = document.querySelectorAll(`.item-fav-btn[data-id="${vidId}"]`);
            galleryItems.forEach(btn => {
                btn.classList.toggle('favorited', res.added);
                const icon = btn.querySelector('.material-symbols-outlined');
                if (icon) {
                    icon.innerText = res.added ? 'favorite' : 'favorite_border';
                }
            });
        }
    }).catch(() => {});
}

let lastTapTime = 0;
let singleClickTimeout;

overlay.addEventListener('click', (e) => {
    if (wasHolding) return;
    if (galleryPage.classList.contains('active')) {
        if (typeof closeGalleryPage === 'function') closeGalleryPage();
        return;
    }
    if (profilePage.classList.contains('active')) {
        const now = Date.now();
        if (now - lastNavTime < 500) return;
        lastNavTime = now;
        if (window.location.hash === '#profile') history.back();
        else profilePage.classList.remove('active');
        return;
    }
    if (detailsPage.classList.contains('active')) {
        const now = Date.now();
        if (now - lastNavTime < 500) return;
        lastNavTime = now;
        if (window.location.hash === '#details') history.back();
        else detailsPage.classList.remove('active');
        return;
    }
    const now = Date.now();
    if (now - lastTapTime < 300) {
        clearTimeout(singleClickTimeout);
        if (currentPlayingVideo) toggleFavorite(currentPlayingVideo.id, e.clientX, e.clientY, 'add');
        lastTapTime = 0;
    } else {
        lastTapTime = now;
        singleClickTimeout = setTimeout(() => {
            document.body.classList.toggle('hide-ui');
        }, 300);
    }
});

let touchStartX = 0, touchStartY = 0;
let touchEndX = 0, touchEndY = 0;
let isSwiping = false;
let isMouseDown = false;
let initialVideoTime = 0;
let holdTimer = null;
let isDraggingSeek = false;

overlay.addEventListener('touchstart', e => {
    touchStartX = e.changedTouches[0].clientX;
    touchStartY = e.changedTouches[0].clientY;
    isSwiping = true;
    isDraggingSeek = false;
    if (activePlayer) {
        initialVideoTime = activePlayer.currentTime();
    }
    
    clearTimeout(holdTimer);
    holdTimer = setTimeout(() => {
        if (isSwiping && !isDraggingSeek) {
            handleHold(touchStartX);
        }
    }, 300);
}, {passive: true});

overlay.addEventListener('touchmove', e => {
    if (!isSwiping) return;

    const currentX = e.changedTouches[0].clientX;
    const currentY = e.changedTouches[0].clientY;
    const dx = currentX - touchStartX;
    const dy = currentY - touchStartY;
    
    if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
        clearTimeout(holdTimer);
    }

    const isTopHalf = touchStartY < window.innerHeight / 2;
    
    if (!isTopHalf && Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 10) {
        clearHoldState();
        isDraggingSeek = true;
        if (activePlayer) {
            const duration = activePlayer.duration();
            if (duration) {
                const seekAmount = (dx / window.innerWidth) * duration;
                let newTime = initialVideoTime + seekAmount;
                newTime = Math.max(0, Math.min(duration, newTime));
                
                fastSeekIndicator.innerHTML = formatTime(newTime);
                fastSeekIndicator.style.display = 'block';
                throttledSeek(newTime);
            }
        }
    }
}, {passive: true});

overlay.addEventListener('touchend', e => {
    clearTimeout(holdTimer);
    isSwiping = false;
    clearHoldState();
    touchEndX = e.changedTouches[0].clientX;
    touchEndY = e.changedTouches[0].clientY;
    if (isDraggingSeek) {
        if (pendingSeekTime !== null && activePlayer) {
            activePlayer.currentTime(pendingSeekTime);
            pendingSeekTime = null;
        }
        fastSeekIndicator.style.display = 'none';
        isDraggingSeek = false;
    } else {
        handleSwipe();
    }
}, {passive: true});

overlay.addEventListener('mousedown', e => {
    if (e.button !== 0) return;
    touchStartX = e.clientX;
    touchStartY = e.clientY;
    isMouseDown = true;
    isDraggingSeek = false;
    if (activePlayer) {
        initialVideoTime = activePlayer.currentTime();
    }

    clearTimeout(holdTimer);
    holdTimer = setTimeout(() => {
        if (isMouseDown && !isDraggingSeek) {
            handleHold(touchStartX);
        }
    }, 300);
});

overlay.addEventListener('mousemove', e => {
    if (!isMouseDown) return;
    const currentX = e.clientX;
    const currentY = e.clientY;
    const dx = currentX - touchStartX;
    const dy = currentY - touchStartY;
    
    if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
        clearTimeout(holdTimer);
    }

    const isTopHalf = touchStartY < window.innerHeight / 2;
    
    if (!isTopHalf && Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 10) {
        clearHoldState();
        isDraggingSeek = true;
        if (activePlayer) {
            const duration = activePlayer.duration();
            if (duration) {
                const seekAmount = (dx / window.innerWidth) * duration;
                let newTime = initialVideoTime + seekAmount;
                newTime = Math.max(0, Math.min(duration, newTime));
                
                fastSeekIndicator.innerHTML = formatTime(newTime);
                fastSeekIndicator.style.display = 'block';
                throttledSeek(newTime);
            }
        }
    }
});

overlay.addEventListener('mouseup', e => {
    if (e.button !== 0) return;
    clearTimeout(holdTimer);
    isMouseDown = false;
    clearHoldState();
    touchEndX = e.clientX;
    touchEndY = e.clientY;
    if (isDraggingSeek) {
        if (pendingSeekTime !== null && activePlayer) {
            activePlayer.currentTime(pendingSeekTime);
            pendingSeekTime = null;
        }
        fastSeekIndicator.style.display = 'none';
        isDraggingSeek = false;
    } else {
        handleSwipe();
    }
});

overlay.addEventListener('mouseleave', e => {
    clearTimeout(holdTimer);
    isMouseDown = false;
    clearHoldState();
});

document.addEventListener('contextmenu', e => {
    if (e.target.tagName !== 'INPUT') {
        e.preventDefault();
    }
});

function handleSwipe() {
    if (wasHolding) return;
    const dx = touchEndX - touchStartX;
    const dy = touchEndY - touchStartY;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    if (Math.max(absDx, absDy) < 40) return;

    const isTopHalf = touchStartY < window.innerHeight / 2;

    if (absDx > absDy) { 
        if (isTopHalf) {
            if (dx < -40) { 
                if (typeof openGalleryPage === 'function') openGalleryPage();
            }
        } else {
            if (isDraggingSeek) {
                return;
            }
        }
    } else {
        if (dy < 0) {
            nextVideo();
        } else {
            prevVideo();
        }
    }
}

document.addEventListener('keydown', e => {
    if (videoSearchInput === document.activeElement) return;

    switch (e.key) {
        case 'ArrowDown':
        case 's':
            e.preventDefault();
            nextVideo();
            break;
        case 'ArrowUp':
        case 'w':
            e.preventDefault();
            prevVideo();
            break;
        case ' ':
            e.preventDefault();
            if (activePlayer) {
                if (activePlayer.paused()) activePlayer.play();
                else activePlayer.pause();
            }
            break;
        case 'l':
            e.preventDefault();
            if (typeof openGalleryPage === 'function') openGalleryPage();
            break;
        case 'Escape':
            e.preventDefault();
            const nowEsc = Date.now();
            if (nowEsc - lastNavTime < 500) return;
            lastNavTime = nowEsc;

            const urlParams = new URLSearchParams(window.location.search);
            if (window.location.hash === '#profile') {
                history.back();
            } else if (urlParams.has('video')) {
                history.back();
            } else if (!urlParams.has('watch')) {
                if (currentPlayingVideo) {
                    const p = getBaseUrlParams();
                    p.set('watch', currentPlayingVideo.id);
                    history.pushState(null, '', `/?${p.toString()}`);
                    handleNavigation();
                }
            }
            break;
    }
});

let wheelTimeout;
document.addEventListener('wheel', e => {
    if (galleryPage.classList.contains('active') || profilePage.classList.contains('active') || detailsPage.classList.contains('active')) return;
    e.preventDefault();
    clearTimeout(wheelTimeout);
    wheelTimeout = setTimeout(() => {
        if (e.deltaY > 0) {
            nextVideo();
        } else {
            prevVideo();
        }
    }, 50);
}, { passive: false });
