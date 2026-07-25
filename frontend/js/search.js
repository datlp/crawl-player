function showSearchInput() {
    const inputWrapper = document.getElementById('search-input-wrapper');
    const navSearchBtn = document.getElementById('gallery-nav-search');
    const spacer = document.getElementById('search-spacer');
    if (inputWrapper) inputWrapper.style.display = 'block';
    if (navSearchBtn) navSearchBtn.style.display = 'none';
    if (spacer) spacer.style.display = 'none';
}

function hideSearchInput() {
    if (searchKey || (videoSearchInput && videoSearchInput.value.trim() !== '')) return;
    const inputWrapper = document.getElementById('search-input-wrapper');
    const navSearchBtn = document.getElementById('gallery-nav-search');
    const spacer = document.getElementById('search-spacer');
    if (inputWrapper) inputWrapper.style.display = 'none';
    if (navSearchBtn) navSearchBtn.style.display = 'inline-block';
    if (spacer) spacer.style.display = 'block';
    const sug = document.getElementById('search-suggestions');
    if (sug) sug.style.display = 'none';
}

document.getElementById('gallery-nav-search')?.addEventListener('click', () => {
    showSearchInput();
    videoSearchInput?.focus();
});

function updateSuggestionHeight() {
    const sug = document.getElementById('search-suggestions');
    const searchContainer = document.getElementById('search-container');
    if (sug && sug.style.display !== 'none' && searchContainer) {
        const rect = searchContainer.getBoundingClientRect();
        const viewportHeight = window.visualViewport ? window.visualViewport.height : window.innerHeight;
        sug.style.top = rect.bottom + 'px';
        sug.style.height = (viewportHeight - rect.bottom) + 'px';
    }
}

if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', updateSuggestionHeight);
    window.visualViewport.addEventListener('scroll', updateSuggestionHeight);
} else {
    window.addEventListener('resize', updateSuggestionHeight);
}

function updateSearchVisuals() {
    const val = videoSearchInput.value;
    if (val.trim() || searchKey) {
        showSearchInput();
    }
    const isFocused = document.activeElement === videoSearchInput;
    const display = document.getElementById('search-chip-display');
    if (!display) return;
    
    let hasChips = false;
    let formattedChips = [];
    const regex = /(actress|genre|maker|title|dvd)\s*:\s*(?:"([^"]+)"|([^\s]+))/gi;
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(val)) !== null) {
        hasChips = true;
        if (match.index > lastIndex) {
            const preText = val.substring(lastIndex, match.index);
            if (preText.trim()) formattedChips.push(`<span style="color: rgba(255,255,255,0.87); font-size: 14px;">${preText.replace(/</g, '&lt;')}</span>`);
        }
        const typeClass = match[1].toLowerCase();
        const value = match[2] || match[3];
        let typeIcon = 'label';
        if (typeClass === 'actress') typeIcon = 'person';
        else if (typeClass === 'maker') typeIcon = 'business';
        else if (typeClass === 'title') typeIcon = 'movie';
        else if (typeClass === 'dvd') typeIcon = 'album';
        
        formattedChips.push(`<span class="detail-chip chip-${typeClass}" style="display: inline-flex; align-items: center; padding: 2px 8px; font-size: 12px; margin: 0; background: rgba(255,255,255,0.12);"><span class="material-symbols-outlined" style="font-size: 14px; margin-right: 4px;">${typeIcon}</span>${value}</span>`);
        lastIndex = regex.lastIndex;
    }
    
    if (lastIndex < val.length) {
        const postText = val.substring(lastIndex);
        if (postText.trim()) formattedChips.push(`<span style="color: rgba(255,255,255,0.87); font-size: 14px;">${postText.replace(/</g, '&lt;')}</span>`);
    }

    if (!isFocused && hasChips) {
        display.innerHTML = formattedChips.join(' ');
        videoSearchInput.classList.add('hide-text');
        display.style.display = 'flex';
    } else {
        videoSearchInput.classList.remove('hide-text');
        display.style.display = 'none';
    }
}

function saveSearchHistory(keyword) {
    if (!keyword) return;
    apiFetch('/api/search_history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword: keyword })
    }).catch(e => console.error(e));
}

function performSearch() {
    const val = videoSearchInput.value.trim();
    if (val !== searchKey) {
        const p = getBaseUrlParams();
        if (val) {
            p.set('searchKey', val);
            saveSearchHistory(val);
        } else {
            p.delete('searchKey');
        }
        p.delete('watch');
        p.delete('video');
        p.delete('id');
        history.pushState(null, '', `/?${p.toString()}`);
        handleNavigation();
    }
    videoSearchInput.blur();
    updateSearchVisuals();
    const sug = document.getElementById('search-suggestions');
    if(sug) sug.style.display = 'none';
}

submitSearchBtn.addEventListener('click', performSearch);

let currentSugTab = 'all';
let currentSuggestions = [];
let currentSugQuery = '';
let currentSugPage = 1;
let isSugLoading = false;
let sugHasMore = true;

function switchSugTab(tab) {
    if (currentSugTab === tab) return;
    currentSugTab = tab;
    const tabMappingSug = { 'all': 'sugTabAll', 'actress': 'sugTabActress', 'genre': 'sugTabGenre', 'maker': 'sugTabMaker' };
    Object.keys(tabMappingSug).forEach(key => {
        const btn = document.getElementById(tabMappingSug[key]);
        if (btn) btn.classList.toggle('active', key === tab);
    });
    currentSugPage = 1;
    sugHasMore = true;
    currentSuggestions = [];
    const content = document.getElementById('suggestion-content');
    if (content) {
        content.innerHTML = '';
        content.scrollTop = 0;
    }
    handleSuggestionFetch(true);
}

setTimeout(() => {
    document.getElementById('sugTabAll')?.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); switchSugTab('all'); });
    document.getElementById('sugTabActress')?.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); switchSugTab('actress'); });
    document.getElementById('sugTabGenre')?.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); switchSugTab('genre'); });
    document.getElementById('sugTabMaker')?.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); switchSugTab('maker'); });
    
    const sugContent = document.getElementById('suggestion-content');
    if (sugContent) {
        sugContent.addEventListener('scroll', () => {
            if (currentSugTab !== 'all' && sugHasMore && !isSugLoading) {
                if (sugContent.scrollTop + sugContent.clientHeight >= sugContent.scrollHeight - 100) {
                    handleSuggestionFetch(true);
                }
            }
        });
    }
}, 100);

function renderSuggestions(newSuggestions, query, append = false) {
    const container = document.getElementById('search-suggestions');
    if (!append) {
        currentSuggestions = newSuggestions;
        currentSugQuery = query;
        if (newSuggestions.length === 0) {
            container.style.display = 'none';
            return;
        }
        container.style.display = 'flex';
        updateSuggestionHeight();
        renderSuggestionsContent(newSuggestions, false);
    } else {
        if (newSuggestions.length === 0) return;
        currentSuggestions = currentSuggestions.concat(newSuggestions);
        renderSuggestionsContent(newSuggestions, true);
    }
}

function renderSuggestionsContent(items, append = false) {
    const container = document.getElementById('search-suggestions');
    const content = document.getElementById('suggestion-content');
    if (!content) return;
    
    if (!append) {
        content.innerHTML = '';
    }
    
    const historyItems = items.filter(s => s.type === 'history');
    const actresses = items.filter(s => s.type === 'actress');
    const genres = items.filter(s => ['genre', 'trend_month_genre'].includes(s.type));
    const makers = items.filter(s => ['maker', 'studio'].includes(s.type));
    const dates = items.filter(s => s.type === 'releasedate');
    const watchHistory = items.filter(s => s.type === 'watch_history');
    const titles = items.filter(s => !['history', 'actress', 'genre', 'trend_month_genre', 'maker', 'studio', 'releasedate', 'watch_history'].includes(s.type));

    const renderListItem = (s) => {
        const item = document.createElement('div');
        item.className = 'suggestion-item';
        
        let icon = 'search';
        if (s.type === 'history') icon = 'history';
        else if (s.type === 'trend' || s.type === 'trend_day_title') icon = 'trending_up';
        else if (s.type === 'title') icon = 'movie';
        else if (s.type === 'actress') icon = 'person';
        else if (s.type === 'genre' || s.type === 'trend_month_genre') icon = 'label';
        else if (s.type === 'maker' || s.type === 'studio') icon = 'business';
        
        let typeText = s.type;
        if (s.type === 'history') typeText = 'Lịch sử';
        else if (s.type === 'trend' || s.type === 'trend_day_title') typeText = 'Xu hướng';
        else if (s.type === 'title') typeText = 'Video';
        else if (s.type === 'actress') typeText = 'Diễn viên';
        else if (s.type === 'genre' || s.type === 'trend_month_genre') typeText = 'Thể loại';
        else if (s.type === 'maker' || s.type === 'studio') typeText = 'Nhà SX';

        let deleteBtnHtml = '';
        if (s.type === 'history') {
            deleteBtnHtml = `<div class="delete-history-btn" title="Xóa" style="color: #aaa; cursor: pointer; padding: 0 5px; display: flex; align-items: center;"><span class="material-symbols-outlined" style="font-size: 20px;">close</span></div>`;
        }

        let displayText = s.text;
        let formattedChips = [];
        const regex = /(actress|genre|maker|title|dvd)\s*:\s*(?:"([^"]+)"|([^\s]+))/gi;
        let lastIndex = 0;
        let match;
        while ((match = regex.exec(s.text)) !== null) {
            if (match.index > lastIndex) {
                formattedChips.push(`<span>${s.text.substring(lastIndex, match.index)}</span>`);
            }
            const typeClass = match[1].toLowerCase();
            const value = match[2] || match[3];
            let typeIcon = 'label';
            if (typeClass === 'actress') typeIcon = 'person';
            else if (typeClass === 'maker') typeIcon = 'business';
            else if (typeClass === 'title') typeIcon = 'movie';
            else if (typeClass === 'dvd') typeIcon = 'album';
            
            formattedChips.push(`<span class="detail-chip chip-${typeClass}" style="display: inline-flex; align-items: center; padding: 2px 8px; font-size: 12px; margin: 0;"><span class="material-symbols-outlined" style="font-size: 14px; margin-right: 4px;">${typeIcon}</span>${value}</span>`);
            lastIndex = regex.lastIndex;
        }
        if (lastIndex < s.text.length) {
            formattedChips.push(`<span>${s.text.substring(lastIndex)}</span>`);
        }
        if (formattedChips.length > 0) {
            displayText = formattedChips.join('');
        }
        
        item.innerHTML = `
            <div class="suggestion-icon"><span class="material-symbols-outlined" style="font-size: 20px;">${icon}</span></div>
            <div class="suggestion-text" style="display: flex; align-items: center; gap: 4px; overflow: hidden; white-space: nowrap;">${displayText}</div>
            <div class="suggestion-type">${typeText}</div>
            ${deleteBtnHtml}
        `;
        
        const delBtn = item.querySelector('.delete-history-btn');
        if (delBtn) {
            delBtn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                delBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size: 20px;">hourglass_empty</span>';
                
                setTimeout(async () => {
                    try {
                        const res = await apiFetch('/api/search_history', {
                            method: 'DELETE',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ keyword: s.text })
                        });
                        if (res.success) {
                            delBtn.innerHTML = '<span class="material-symbols-outlined" style="color: #4caf50; font-size: 20px;">check</span>';
                            setTimeout(() => {
                                item.remove();
                                if (content.children.length === 0) container.style.display = 'none';
                            }, 300);
                        } else {
                            throw new Error(res.error || 'Error');
                        }
                    } catch (err) {
                        delBtn.innerHTML = '<span class="material-symbols-outlined" style="color: #e53935; font-size: 20px;">close</span>';
                        setTimeout(() => {
                            delBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size: 20px;">close</span>';
                        }, 1000);
                    }
                }, 400);
            };
        }
        
        item.onclick = (e) => {
            if (e.target.closest('.delete-history-btn')) return;
            e.preventDefault();
            
            if (s.type === 'history') {
                videoSearchInput.value = s.text;
                clearSearchBtn.style.display = 'block';
                container.style.display = 'none';
                updateSearchVisuals();
                performSearch();
            } else if (s.type === 'title' || s.type === 'trend_day_title') {
                if (s.id) {
                    container.style.display = 'none';
                    videoSearchInput.blur();
                    updateSearchVisuals();
                    const p = getBaseUrlParams();
                    p.set('watch', s.id);
                    history.pushState(null, '', `/?${p.toString()}`);
                    handleNavigation();
                } else {
                    videoSearchInput.value = s.text;
                    clearSearchBtn.style.display = 'block';
                    container.style.display = 'none';
                    updateSearchVisuals();
                    performSearch();
                }
            } else if (['actress', 'genre', 'maker', 'studio', 'releasedate'].includes(s.type)) {
                let typeClass = s.type === 'studio' ? 'maker' : s.type;
                videoSearchInput.value = `${typeClass}:"${s.text}"`;
                clearSearchBtn.style.display = 'block';
                container.style.display = 'none';
                updateSearchVisuals();
                performSearch();
            } else {
                videoSearchInput.value = s.text;
                clearSearchBtn.style.display = 'block';
                container.style.display = 'none';
                updateSearchVisuals();
                performSearch();
            }
        };
        
        return item;
    };

    const renderChipGroup = (title, items, typeClass, icon) => {
        if (items.length === 0) return null;
        
        const group = document.createElement('div');
        group.style.padding = '12px 16px';
        group.style.borderBottom = '1px solid rgba(255,255,255,0.05)';
        
        const titleEl = document.createElement('div');
        titleEl.innerText = title;
        titleEl.style.fontSize = '12px';
        titleEl.style.color = '#888';
        titleEl.style.marginBottom = '8px';
        group.appendChild(titleEl);
        
        const chipsDiv = document.createElement('div');
        chipsDiv.style.display = 'flex';
        chipsDiv.style.flexWrap = 'wrap';
        chipsDiv.style.gap = '8px';
        
        items.forEach(s => {
            const chip = document.createElement('span');
            chip.className = `detail-chip chip-${typeClass}`;
            chip.innerHTML = `<span class="material-symbols-outlined" style="font-size: 14px; vertical-align: text-bottom; margin-right: 4px;">${icon}</span>${s.text}`;
            
            chip.onclick = (e) => {
                e.preventDefault();
                videoSearchInput.value = `${typeClass}:"${s.text}"`;
                clearSearchBtn.style.display = 'block';
                container.style.display = 'none';
                performSearch();
            };
            chipsDiv.appendChild(chip);
        });
        
        group.appendChild(chipsDiv);
        return group;
    };

    const renderVideoGrid = (headerText, videoItems) => {
        if (videoItems.length === 0) return null;

        const titleGrp = document.createElement('div');
        titleGrp.style.padding = '15px';
        titleGrp.style.borderTop = '1px solid rgba(255,255,255,0.05)';
        
        const titleHeader = document.createElement('div');
        titleHeader.innerText = headerText;
        titleHeader.style.fontSize = '14px';
        titleHeader.style.fontWeight = 'bold';
        titleHeader.style.color = '#ff4081';
        titleHeader.style.marginBottom = '15px';
        titleGrp.appendChild(titleHeader);

        const grid = document.createElement('div');
        grid.style.display = 'grid';
        grid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(140px, 1fr))';
        grid.style.gap = '15px';
        
        videoItems.forEach(s => {
            const item = document.createElement('div');
            item.className = 'gallery-item';
            
            item.innerHTML = `
                <div class="gallery-item-thumb" style="background-image: url('${s.cover || ''}')"></div>
                <div class="item-info">
                    <div class="item-title" style="font-size: 13px;">${s.text}</div>
                </div>
            `;
            
            item.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                videoSearchInput.value = s.text;
                clearSearchBtn.style.display = 'block';
                container.style.display = 'none';
                videoSearchInput.blur();
                const p = getBaseUrlParams();
                p.set('searchKey', s.text);
                p.set('video', s.id);
                history.pushState(null, '', `/?${p.toString()}`);
                handleNavigation();
            };
            grid.appendChild(item);
        });
        titleGrp.appendChild(grid);
        return titleGrp;
    };

    if (currentSugTab === 'all') {
        if (historyItems.length > 0) {
            const grp = document.createElement('div');
            if (actresses.length > 0 || genres.length > 0 || makers.length > 0 || dates.length > 0 || titles.length > 0) {
                grp.style.borderBottom = '1px solid rgba(255,255,255,0.05)';
            }
            historyItems.forEach(s => grp.appendChild(renderListItem(s)));
            content.appendChild(grp);
        }

        const actressGroup = renderChipGroup('Diễn viên', actresses, 'actress', 'person');
        if (actressGroup) content.appendChild(actressGroup);

        const genreGroup = renderChipGroup('Thể loại', genres, 'genre', 'label');
        if (genreGroup) content.appendChild(genreGroup);

        const makerGroup = renderChipGroup('Nhà sản xuất', makers, 'maker', 'business');
        if (makerGroup) content.appendChild(makerGroup);

        const dateGroup = renderChipGroup('Ngày phát hành', dates, 'releasedate', 'calendar_month');
        if (dateGroup) content.appendChild(dateGroup);

        const watchHistoryGrid = renderVideoGrid('Từ Lịch sử xem', watchHistory);
        if (watchHistoryGrid) content.appendChild(watchHistoryGrid);

        const titlesGrid = renderVideoGrid('Phim đề xuất', titles);
        if (titlesGrid) content.appendChild(titlesGrid);

        if (content.lastChild && content.lastChild.style) {
            content.lastChild.style.borderBottom = 'none';
        }
    } else if (currentSugTab === 'actress') {
        if (items.length > 0) {
            items.forEach(s => content.appendChild(renderListItem(s)));
        } else if (!append) {
            content.innerHTML = '<div style="padding: 20px; text-align: center; color: #888;">Không có dữ liệu diễn viên</div>';
        }
    } else if (currentSugTab === 'genre') {
        if (items.length > 0) {
            items.forEach(s => content.appendChild(renderListItem(s)));
        } else if (!append) {
            content.innerHTML = '<div style="padding: 20px; text-align: center; color: #888;">Không có dữ liệu thể loại</div>';
        }
    } else if (currentSugTab === 'maker') {
        if (items.length > 0) {
            items.forEach(s => content.appendChild(renderListItem(s)));
        } else if (!append) {
            content.innerHTML = '<div style="padding: 20px; text-align: center; color: #888;">Không có dữ liệu nhà sản xuất</div>';
        }
    }
}

let suggestionTimeout = null;
let currentSugFetchId = 0;

function handleSuggestionFetch(force = false) {
    const q = videoSearchInput.value.trim();
    if (!force && q === currentSugQuery && currentSugPage === 1 && currentSuggestions.length > 0) return;
    
    clearTimeout(suggestionTimeout);
    suggestionTimeout = setTimeout(async () => {
        if (currentSugPage === 1) {
            sugHasMore = true;
        }
        if (isSugLoading || !sugHasMore) return;
        isSugLoading = true;
        
        const fetchId = ++currentSugFetchId;
        
        try {
            const res = await apiFetch(`/api/search_suggestions?q=${encodeURIComponent(q)}&tab=${currentSugTab}&page=${currentSugPage}`);
            if (fetchId !== currentSugFetchId) return;
            
            if (res.success && res.suggestions) {
                if (res.suggestions.length === 0) {
                    sugHasMore = false;
                } else {
                    const uniqueSuggestions = [];
                    const seen = new Set(currentSuggestions.map(s => s.text.toLowerCase()));
                    for (const s of res.suggestions) {
                        if (!seen.has(s.text.toLowerCase())) {
                            seen.add(s.text.toLowerCase());
                            uniqueSuggestions.push(s);
                        }
                    }
                    renderSuggestions(uniqueSuggestions, q, currentSugPage > 1);
                    currentSugPage++;
                }
            } else {
                sugHasMore = false;
            }
        } catch (e) {
            console.error(e);
        } finally {
            if (fetchId === currentSugFetchId) {
                isSugLoading = false;
            }
        }
    }, 150);
}

videoSearchInput.addEventListener('focus', function() {
    showSearchInput();
    this.select();
    currentSugPage = 1;
    sugHasMore = true;
    const content = document.getElementById('suggestion-content');
    if (content) content.scrollTop = 0;
    handleSuggestionFetch();
    updateSearchVisuals();
});

let isInteractingWithSuggestions = false;
const searchSuggestionsContainer = document.getElementById('search-suggestions');

const setInteracting = () => { isInteractingWithSuggestions = true; };
const clearInteracting = () => { setTimeout(() => { isInteractingWithSuggestions = false; }, 300); };

searchSuggestionsContainer.addEventListener('touchstart', setInteracting, { passive: true });
searchSuggestionsContainer.addEventListener('mousedown', setInteracting, { passive: true });
searchSuggestionsContainer.addEventListener('touchend', clearInteracting, { passive: true });
searchSuggestionsContainer.addEventListener('mouseup', clearInteracting, { passive: true });

searchSuggestionsContainer.addEventListener('touchmove', () => {
    if (document.activeElement === videoSearchInput) {
        videoSearchInput.blur();
    }
}, { passive: true });

let sugStartX = 0;
let sugStartY = 0;
const sugTabsOrder = ['all', 'actress', 'genre', 'maker'];

searchSuggestionsContainer.addEventListener('touchstart', e => {
    sugStartX = e.changedTouches[0].clientX;
    sugStartY = e.changedTouches[0].clientY;
}, {passive: true});

searchSuggestionsContainer.addEventListener('touchend', e => {
    if (e.target.closest('#suggestion-tabs') || Math.abs(e.changedTouches[0].clientX - sugStartX) < 10) return; 
    const dx = e.changedTouches[0].clientX - sugStartX;
    const dy = e.changedTouches[0].clientY - sugStartY;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 50) {
        const currentIndex = sugTabsOrder.indexOf(currentSugTab || 'all');
        const tabMappingSug = { 'all': 'sugTabAll', 'actress': 'sugTabActress', 'genre': 'sugTabGenre', 'maker': 'sugTabMaker' };
        if (dx > 0 && currentIndex > 0) {
            switchSugTab(sugTabsOrder[currentIndex - 1]);
            document.getElementById(tabMappingSug[sugTabsOrder[currentIndex - 1]])?.scrollIntoView({behavior: 'smooth', block: 'nearest', inline: 'center'});
        } else if (dx < 0 && currentIndex < sugTabsOrder.length - 1) {
            switchSugTab(sugTabsOrder[currentIndex + 1]);
            document.getElementById(tabMappingSug[sugTabsOrder[currentIndex + 1]])?.scrollIntoView({behavior: 'smooth', block: 'nearest', inline: 'center'});
        }
    }
}, {passive: true});

videoSearchInput.addEventListener('blur', () => {
    updateSearchVisuals();
    setTimeout(() => {
        if (!isInteractingWithSuggestions) {
            const sug = document.getElementById('search-suggestions');
            if(sug) sug.style.display = 'none';
            hideSearchInput();
        }
    }, 200);
});

videoSearchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        performSearch();
    }
});

const hideSuggestionsOutside = (e) => {
    if (!e.target.closest('#video-search') && !e.target.closest('#suggestion-tabs') && !e.target.closest('.suggestion-item') && !e.target.closest('.detail-chip')) {
        const sug = document.getElementById('search-suggestions');
        if (sug) sug.style.display = 'none';
    }
};
document.addEventListener('touchstart', hideSuggestionsOutside, { passive: true });
document.addEventListener('mousedown', hideSuggestionsOutside, { passive: true });

clearSearchBtn.addEventListener('click', () => {
    videoSearchInput.value = '';
    clearSearchBtn.style.display = 'none';
    updateSearchVisuals();
    if (searchKey !== '') {
        const p = getBaseUrlParams();
        p.delete('searchKey');
        p.delete('watch');
        p.delete('video');
        p.delete('id');
        history.pushState(null, '', `/?${p.toString()}`);
        handleNavigation();
    } else {
        const sug = document.getElementById('search-suggestions');
        if(sug) sug.style.display = 'none';
        hideSearchInput();
    }
});

videoSearchInput.addEventListener('input', (e) => {
    clearSearchBtn.style.display = e.target.value ? 'block' : 'none';
    currentSugPage = 1;
    sugHasMore = true;
    const content = document.getElementById('suggestion-content');
    if (content) content.scrollTop = 0;
    handleSuggestionFetch();
    updateSearchVisuals();
});
