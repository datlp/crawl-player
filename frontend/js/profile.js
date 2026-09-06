const el = {
    sessionDisplay: document.getElementById('sessionDisplay'),
    identifyBtn: document.getElementById('identifyBtn'),
    logoutBtn: document.getElementById('logoutBtn'),
    identifyForm: document.getElementById('identifyForm'),
    identifyUsername: document.getElementById('identifyUsername'),
    usernameStatus: document.getElementById('usernameStatus'),
    identifyPassword: document.getElementById('identifyPassword'),
    identifyRetypePassword: document.getElementById('identifyRetypePassword'),
    otpGroup: document.getElementById('otpGroup'),
    identifyOtp: document.getElementById('identifyOtp'),
    sendOtpBtn: document.getElementById('sendOtpBtn'),
    submitIdentityBtn: document.getElementById('submitIdentityBtn'),
    toggleOtpLoginBtn: document.getElementById('toggleOtpLoginBtn'),
    forgotPasswordBtn: document.getElementById('forgotPasswordBtn'),
    profileSection: document.getElementById('profileSection'),
    verifyEmailGroup: document.getElementById('verifyEmailGroup'),
    verifyOtpInput: document.getElementById('verifyOtpInput'),
    btnSendVerifyOtp: document.getElementById('btnSendVerifyOtp'),
    btnSubmitVerifyOtp: document.getElementById('btnSubmitVerifyOtp'),
    editPassword: document.getElementById('editPassword'),
    profileEmail: document.getElementById('profileEmail'),
    btnSaveEmail: document.getElementById('btnSaveEmail'),
    emailVerifiedBadge: document.getElementById('emailVerifiedBadge'),
    emailUnverifiedBadge: document.getElementById('emailUnverifiedBadge'),
    emailCallToAction: document.getElementById('emailCallToAction'),
    btnUpdatePassword: document.getElementById('btnUpdatePassword'),
};

async function updateIdentityDisplay() {
    if (!el.sessionDisplay) return;
    if (missavUsername) {
        el.sessionDisplay.innerText = missavUsername;
        el.sessionDisplay.style.color = '#4caf50';
        hide(el.identifyBtn);
        show(el.logoutBtn);
        hide(el.identifyForm);
        show(el.profileSection, 'flex');
        
        try {
            const res = await apiFetch('/api/identity/me');
            if (res.success) {
                el.profileEmail.value = res.email || '';
                if (res.email) {
                    if (res.verified) {
                        show(el.emailVerifiedBadge, 'inline-block');
                        hide(el.emailUnverifiedBadge);
                        hide(el.emailCallToAction);
                        hide(el.verifyEmailGroup);
                        el.btnUpdatePassword.disabled = false;
                        el.profileEmail.disabled = true;
                        el.profileEmail.style.color = 'rgba(255,255,255,0.5)';
                        el.btnSaveEmail.innerText = 'Sửa';
                    } else {
                        hide(el.emailVerifiedBadge);
                        show(el.emailUnverifiedBadge, 'inline-block');
                        show(el.emailCallToAction);
                        show(el.verifyEmailGroup, 'flex');
                        el.btnUpdatePassword.disabled = true;
                        el.profileEmail.disabled = false;
                        el.profileEmail.style.color = 'white';
                        el.btnSaveEmail.innerText = 'Lưu';
                    }
                } else {
                    hide(el.emailVerifiedBadge);
                    hide(el.emailUnverifiedBadge);
                    show(el.emailCallToAction);
                    hide(el.verifyEmailGroup);
                    el.btnUpdatePassword.disabled = true;
                    el.profileEmail.disabled = false;
                    el.profileEmail.style.color = 'white';
                    el.btnSaveEmail.innerText = 'Lưu';
                }
            }
        } catch(e) {}
    } else {
        el.sessionDisplay.innerText = sessionId;
        el.sessionDisplay.style.color = '#aaa';
        show(el.identifyBtn);
        hide(el.logoutBtn);
        hide(el.profileSection);
    }
}

if (el.logoutBtn) {
    el.logoutBtn.onclick = () => {
        logout();
    };
}

if (el.identifyBtn) {
    el.identifyBtn.onclick = () => {
        if(el.identifyForm.style.display === 'none') {
            show(el.identifyForm, 'flex');
        } else {
            hide(el.identifyForm);
        }
    };
}

let identityState = 'check';

function resetIdentifyForm() {
    identityState = 'check';
    hide(el.usernameStatus);
    hide(el.identifyPassword);
    hide(el.identifyRetypePassword);
    hide(el.otpGroup);
    hide(el.submitIdentityBtn);
    hide(el.toggleOtpLoginBtn);
    hide(el.forgotPasswordBtn);
    if (el.identifyPassword) el.identifyPassword.placeholder = "Password";
    if (el.identifyPassword) el.identifyPassword.value = "";
    if (el.identifyRetypePassword) el.identifyRetypePassword.value = "";
}

if (el.identifyUsername) {
    el.identifyUsername.addEventListener('input', debounce(async (e) => {
        const val = e.target.value.trim();
        if (!val) {
            resetIdentifyForm();
            return;
        }
        show(el.usernameStatus);
        el.usernameStatus.innerText = 'Đang kiểm tra...';
        el.usernameStatus.style.color = '#aaa';

        try {
            const res = await fetch('/api/identity/check', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: val })
            }).then(r => r.json());

            if (res.exists) {
                el.usernameStatus.innerText = 'Tài khoản đã tồn tại.';
                identityState = 'login';
                show(el.identifyPassword);
                hide(el.identifyRetypePassword);
                el.identifyPassword.placeholder = "Password";
                el.submitIdentityBtn.innerText = 'Đăng nhập';
                show(el.submitIdentityBtn);
                show(el.toggleOtpLoginBtn, 'inline');
                show(el.forgotPasswordBtn, 'inline');
                el.submitIdentityBtn.disabled = false;
            } else {
                el.usernameStatus.innerText = 'Tài khoản mới.';
                el.usernameStatus.style.color = '#4caf50';
                identityState = 'register';
                show(el.identifyPassword);
                show(el.identifyRetypePassword);
                el.submitIdentityBtn.innerText = 'Đăng ký';
                show(el.submitIdentityBtn);
                hide(el.toggleOtpLoginBtn);
                hide(el.otpGroup);
                el.submitIdentityBtn.disabled = false;
            }
        } catch (err) {
            el.usernameStatus.innerText = 'Lỗi kiểm tra';
        }
    }, 500));
}

if (el.forgotPasswordBtn) {
    el.forgotPasswordBtn.onclick = () => {
        identityState = 'forgot_password';
        show(el.identifyPassword);
        el.identifyPassword.placeholder = "Mật khẩu mới";
        hide(el.identifyRetypePassword);
        show(el.otpGroup, 'flex');
        el.submitIdentityBtn.innerText = 'Đổi mật khẩu';
        el.toggleOtpLoginBtn.innerText = 'Đăng nhập bằng Mật khẩu?';
        hide(el.forgotPasswordBtn);
    };
}

if (el.toggleOtpLoginBtn) {
    el.toggleOtpLoginBtn.onclick = () => {
        if (identityState === 'login') {
            identityState = 'login_otp';
            hide(el.identifyPassword);
            hide(el.identifyRetypePassword);
            show(el.otpGroup, 'flex');
            el.toggleOtpLoginBtn.innerText = 'Đăng nhập bằng Mật khẩu?';
            show(el.forgotPasswordBtn, 'inline');
        } else {
            identityState = 'login';
            show(el.identifyPassword);
            hide(el.identifyRetypePassword);
            el.identifyPassword.placeholder = "Password";
            hide(el.otpGroup);
            el.toggleOtpLoginBtn.innerText = 'Đăng nhập bằng OTP?';
            show(el.forgotPasswordBtn, 'inline');
            el.submitIdentityBtn.innerText = 'Đăng nhập';
        }
    };
}

if (el.sendOtpBtn) {
    el.sendOtpBtn.onclick = async () => {
        const val = el.identifyUsername.value.trim();
        el.sendOtpBtn.disabled = true;
        el.sendOtpBtn.innerText = 'Đang gửi...';
        try {
            const res = await fetch('/api/identity/send_otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: val })
            }).then(r => r.json());
            if (res.success) {
                showToast('OTP đã được gửi đến email của bạn', 'success');
                let countdown = 60;
                const timer = setInterval(() => {
                    countdown--;
                    el.sendOtpBtn.innerText = `Chờ ${countdown}s`;
                    if (countdown <= 0) {
                        clearInterval(timer);
                        el.sendOtpBtn.innerText = 'Gửi lại';
                        el.sendOtpBtn.disabled = false;
                    }
                }, 1000);
            } else {
                showToast(res.error || 'Lỗi gửi OTP', 'error');
                el.sendOtpBtn.innerText = 'Gửi OTP';
                el.sendOtpBtn.disabled = false;
            }
        } catch (err) {
            showToast('Lỗi kết nối', 'error');
            el.sendOtpBtn.innerText = 'Gửi OTP';
            el.sendOtpBtn.disabled = false;
        }
    };
}

if (el.submitIdentityBtn) {
    el.submitIdentityBtn.onclick = async () => {
        const user = el.identifyUsername.value.trim();
        const pass = el.identifyPassword.value;
        const retypePass = el.identifyRetypePassword.value;
        const otp = el.identifyOtp.value.trim();

        if (identityState === 'register') {
            if (!user || !pass || !retypePass) return showToast('Vui lòng nhập đủ thông tin', 'warning');
            if (pass !== retypePass) return showToast('Mật khẩu nhập lại không khớp', 'warning');
            const res = await fetch('/api/identity/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: user, password: pass, session_id: sessionId })
            }).then(r => r.json());
            if (res.success) {
                showToast('Đăng ký thành công', 'success');
                missavUsername = res.username;
                missavJwt = res.token;
                localStorage.setItem('missav_username', missavUsername);
                localStorage.setItem('missav_jwt', missavJwt);
                updateIdentityDisplay();
            } else {
                showToast(res.error || 'Lỗi đăng ký', 'error');
            }
        } else if (identityState === 'login') {
            if (!user || !pass) return showToast('Vui lòng nhập đủ thông tin', 'warning');
            const res = await fetch('/api/identity/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: user, password: pass, session_id: sessionId })
            }).then(r => r.json());
            if (res.success) {
                showToast('Đăng nhập thành công', 'success');
                missavUsername = res.username;
                missavJwt = res.token;
                localStorage.setItem('missav_username', missavUsername);
                localStorage.setItem('missav_jwt', missavJwt);
                updateIdentityDisplay();
            } else {
                showToast(res.error || 'Sai thông tin đăng nhập', 'error');
            }
        } else if (identityState === 'login_otp') {
            if (!user || !otp) return showToast('Vui lòng nhập đủ Username/Email và OTP', 'warning');
            const res = await fetch('/api/identity/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: user, otp: otp, session_id: sessionId })
            }).then(r => r.json());
            if (res.success) {
                showToast('Đăng nhập thành công', 'success');
                missavUsername = res.username;
                missavJwt = res.token;
                localStorage.setItem('missav_username', missavUsername);
                localStorage.setItem('missav_jwt', missavJwt);
                updateIdentityDisplay();
            } else {
                showToast(res.error || 'OTP không hợp lệ hoặc hết hạn', 'error');
            }
        } else if (identityState === 'forgot_password') {
            if (!user || !pass || !otp) return showToast('Vui lòng nhập đủ thông tin và OTP', 'warning');
            const res = await fetch('/api/identity/reset_password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: user, otp: otp, new_password: pass })
            }).then(r => r.json());
            if (res.success) {
                showToast('Đổi mật khẩu thành công, vui lòng đăng nhập lại', 'success');
                identityState = 'login';
                el.identifyPassword.placeholder = "Password";
                el.identifyPassword.value = "";
                el.identifyOtp.value = "";
                hide(el.otpGroup);
                el.submitIdentityBtn.innerText = 'Đăng nhập';
                el.toggleOtpLoginBtn.innerText = 'Đăng nhập bằng OTP?';
                show(el.forgotPasswordBtn, 'inline');
            } else {
                showToast(res.error || 'Lỗi đổi mật khẩu', 'error');
            }
        }
    };
}

if (el.verifyOtpInput) {
    el.verifyOtpInput.addEventListener('input', (e) => {
        if (e.target.value.trim().length > 0) {
            show(el.btnSubmitVerifyOtp);
        } else {
            hide(el.btnSubmitVerifyOtp);
        }
    });
}

if (el.btnSendVerifyOtp) {
    el.btnSendVerifyOtp.onclick = async () => {
        el.btnSendVerifyOtp.disabled = true;
        el.btnSendVerifyOtp.innerText = 'Đang gửi...';
        try {
            const res = await fetch('/api/identity/send_otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: missavUsername })
            }).then(r => r.json());
            if (res.success) {
                showToast('OTP đã được gửi đến email của bạn', 'success');
                let countdown = 60;
                const timer = setInterval(() => {
                    countdown--;
                    el.btnSendVerifyOtp.innerText = `Chờ ${countdown}s`;
                    if (countdown <= 0) {
                        clearInterval(timer);
                        el.btnSendVerifyOtp.innerText = 'Gửi lại';
                        el.btnSendVerifyOtp.disabled = false;
                    }
                }, 1000);
            } else {
                showToast(res.error || 'Lỗi gửi OTP', 'error');
                el.btnSendVerifyOtp.innerText = 'Gửi OTP';
                el.btnSendVerifyOtp.disabled = false;
            }
        } catch (err) {
            showToast('Lỗi kết nối', 'error');
            el.btnSendVerifyOtp.innerText = 'Gửi OTP';
            el.btnSendVerifyOtp.disabled = false;
        }
    };
}

if (el.btnSubmitVerifyOtp) {
    el.btnSubmitVerifyOtp.onclick = async () => {
        const otp = el.verifyOtpInput.value.trim();
        if (!otp) return;
        try {
            const res = await apiFetch('/api/identity/verify_email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ otp: otp })
            });
            if (res.success) {
                showToast('Xác thực email thành công', 'success');
                hide(el.verifyEmailGroup);
            } else {
                showToast(res.error || 'Lỗi xác thực', 'error');
            }
        } catch (err) {
            showToast('Lỗi kết nối', 'error');
        }
    };
}

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

if (el.btnSaveEmail) {
    el.btnSaveEmail.onclick = async () => {
        if (el.btnSaveEmail.innerText === 'Sửa') {
            el.profileEmail.disabled = false;
            el.profileEmail.style.color = 'white';
            el.btnSaveEmail.innerText = 'Lưu';
            el.profileEmail.focus();
            return;
        }

        const email = el.profileEmail.value.trim();
        if (!email) return showToast('Vui lòng nhập email', 'warning');
        if (!isValidEmail(email)) return showToast('Email không hợp lệ', 'warning');
        
        try {
            const res = await apiFetch('/api/identity/update_profile', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email })
            });
            if (res.success) {
                showToast('Đã lưu email', 'success');
                updateIdentityDisplay();
            } else {
                showToast(res.error || 'Lỗi lưu email', 'error');
            }
        } catch (err) {
            showToast('Lỗi kết nối', 'error');
        }
    };
}

if (el.btnUpdatePassword) {
    el.btnUpdatePassword.onclick = async () => {
        const pass = el.editPassword.value;
        if (!pass) return showToast('Vui lòng nhập mật khẩu mới', 'warning');
        
        try {
            const res = await apiFetch('/api/identity/update_profile', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password: pass })
            });
            if (res.success) {
                showToast('Đã cập nhật mật khẩu', 'success');
                el.editPassword.value = '';
            } else {
                showToast(res.error || 'Lỗi cập nhật mật khẩu', 'error');
            }
        } catch (err) {
            showToast('Lỗi kết nối', 'error');
        }
    };
}

let profileStartX = 0;
let profileStartY = 0;
const profileTabsOrder = ['you', 'recent', 'favorites', 'frequent'];
profilePage.addEventListener('touchstart', e => {
    profileStartX = e.changedTouches[0].clientX;
    profileStartY = e.changedTouches[0].clientY;
}, {passive: true});
profilePage.addEventListener('touchend', e => {
    if (e.target.closest('#profile-tabs') || Math.abs(e.changedTouches[0].clientX - profileStartX) < 10) return; 
    const dx = e.changedTouches[0].clientX - profileStartX;
    const dy = e.changedTouches[0].clientY - profileStartY;

    // Vuốt xuống (Swipe down) trên header hoặc khi đang ở đỉnh trang để đóng trang Cá nhân
    if (dy > 60 && Math.abs(dy) > Math.abs(dx)) {
        const isHeader = e.target.closest('.page-header');
        const contentYou = document.getElementById('profile-content-you');
        const gridEl = document.getElementById('profile-gallery-grid');
        const isAtTop = (currentTab === 'you' ? (!contentYou || contentYou.scrollTop <= 0) : (!gridEl || gridEl.scrollTop <= 0));
        if (isHeader || isAtTop) {
            if (typeof closeProfilePage === 'function') {
                closeProfilePage();
                return;
            }
        }
    }

    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 50) {
        const currentIndex = profileTabsOrder.indexOf(currentTab || 'you');
        if (dx > 0) {
            if (currentIndex > 0) {
                if (typeof switchGalleryTab === 'function') {
                    switchGalleryTab(profileTabsOrder[currentIndex - 1]);
                    document.getElementById(tabMapping[profileTabsOrder[currentIndex - 1]])?.scrollIntoView({behavior: 'smooth', block: 'nearest', inline: 'center'});
                }
            } else {
                if (typeof closeProfilePage === 'function') closeProfilePage();
            }
        } else {
            if (currentIndex < profileTabsOrder.length - 1) {
                if (typeof switchGalleryTab === 'function') {
                    switchGalleryTab(profileTabsOrder[currentIndex + 1]);
                    document.getElementById(tabMapping[profileTabsOrder[currentIndex + 1]])?.scrollIntoView({behavior: 'smooth', block: 'nearest', inline: 'center'});
                }
            }
        }
    }
}, {passive: true});
