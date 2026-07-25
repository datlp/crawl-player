async function initSessionId() {
    let now = Date.now();
    if (!sessionId || !sessionExpire || now > parseInt(sessionExpire)) {
        try {
            const res = await fetch('/api/session/init').then(r => r.json());
            if (res.success && res.session_id) {
                sessionId = res.session_id;
            } else {
                sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            }
        } catch (e) {
            sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        }
        localStorage.setItem(SESSION_KEY, sessionId);
        localStorage.setItem(EXPIRE_KEY, (now + THIRTY_DAYS_MS).toString());
    } else {
        let timeLeft = parseInt(sessionExpire) - now;
        if (timeLeft < TEN_DAYS_MS) {
            localStorage.setItem(EXPIRE_KEY, (now + THIRTY_DAYS_MS).toString());
        }
    }
}

function logout(showMsg = true) {
    localStorage.removeItem('missav_jwt');
    localStorage.removeItem('missav_username');
    missavJwt = null;
    missavUsername = null;
    if (typeof updateIdentityDisplay === 'function') {
        updateIdentityDisplay();
    }
    if (showMsg) showToast('Đã đăng xuất', 'info');
}

async function apiFetch(url, options = {}) {
    options.headers = options.headers || {};
    if (missavJwt) {
        options.headers['Authorization'] = `Bearer ${missavJwt}`;
    }
    if (sessionId) {
        options.headers['Session-Id'] = sessionId;
    }
    const response = await fetch(url, options);
    if (response.status === 401) {
        if (missavJwt) {
            logout(false);
        }
        showToast('Vui lòng định danh lại', 'warning');
        const identifyForm = document.getElementById('identifyForm');
        if (identifyForm) show(identifyForm, 'flex');
        throw new Error('Unauthorized');
    }
    return response.json();
}
