/**
 * shared-header.js
 * โหลด header.html แล้ว inject + โหลด index.js
 */
(function () {
    const API_BASE = 'http://localhost:5000/api';

    function loadCSS(href) {
        if (document.querySelector(`link[href="${href}"]`)) return;
        const l = document.createElement('link');
        l.rel = 'stylesheet'; l.href = href;
        document.head.appendChild(l);
    }

    function loadJS(src, cb) {
        if (document.querySelector(`script[src="${src}"]`)) { if (cb) cb(); return; }
        const s = document.createElement('script');
        s.src = src;
        if (cb) s.onload = cb;
        document.body.appendChild(s);
    }

    function isIndexPage() {
        const p = window.location.pathname;
        return p.endsWith('index.html') || p === '/' || p.endsWith('/');
    }

    // ════════════════════════════════════════════════════════════
    // AUTH MODAL HELPERS — พร้อมใช้งานทันทีทุกหน้า
    // ════════════════════════════════════════════════════════════

    window.closeAuthModal = function () {
        const modal = document.getElementById('authModal');
        if (modal) modal.style.display = 'none';
    };

    window.switchAuthTab = function (tabId) {
        const loginTab    = document.getElementById('loginTab');
        const registerTab = document.getElementById('registerTab');
        const btnLogin    = document.getElementById('btn-login');
        const btnRegister = document.getElementById('btn-register');
        if (!loginTab) return;
        if (tabId === 'loginTab') {
            loginTab.style.display    = 'block';
            registerTab.style.display = 'none';
            if (btnLogin)    btnLogin.classList.add('active');
            if (btnRegister) btnRegister.classList.remove('active');
        } else {
            loginTab.style.display    = 'none';
            registerTab.style.display = 'block';
            if (btnRegister) btnRegister.classList.add('active');
            if (btnLogin)    btnLogin.classList.remove('active');
        }
    };

    window.togglePassword = function (inputId) {
        const el = document.getElementById(inputId);
        if (!el) return;
        el.type = el.type === 'password' ? 'text' : 'password';
    };

    window.openLogin = function () {
        const modal = document.getElementById('authModal');
        if (modal) {
            modal.style.display = 'flex';
            window.switchAuthTab('loginTab');
        }
    };

    window.openRegister = function () {
        const modal = document.getElementById('authModal');
        if (modal) {
            modal.style.display = 'flex';
            window.switchAuthTab('registerTab');
        }
    };

    // ════════════════════════════════════════════════════════════
    // POPUP HELPERS
    // ════════════════════════════════════════════════════════════

    function shPopup(icon, title, message, buttons) {
        return new Promise(resolve => {
            const popup = document.getElementById('customPopup');
            if (!popup) { resolve(null); return; }
            document.getElementById('popupIcon').innerText    = icon;
            document.getElementById('popupTitle').innerText   = title;
            document.getElementById('popupMessage').innerText = message;
            const btnContainer = document.getElementById('popupButtons');
            btnContainer.innerHTML = '';
            buttons.forEach(({ label, className, value }) => {
                const btn = document.createElement('button');
                btn.className = `btn-popup ${className}`;
                btn.innerText = label;
                btn.onclick = () => { popup.style.display = 'none'; resolve(value); };
                btnContainer.appendChild(btn);
            });
            popup.style.display = 'flex';
        });
    }

    window.shAlert = function (title, message, icon = 'ℹ️') {
        if (typeof customAlert === 'function') return customAlert(title, message, icon);
        return shPopup(icon, title, message, [
            { label: 'ตกลง', className: 'btn-popup-primary', value: true }
        ]);
    };

    window.shConfirm = function (title, message, icon = '❓') {
        if (typeof customConfirm === 'function') return customConfirm(title, message, icon);
        return shPopup(icon, title, message, [
            { label: 'ยกเลิก', className: 'btn-popup-cancel', value: false },
            { label: 'ยืนยัน', className: 'btn-popup-danger', value: true  }
        ]);
    };

    // ════════════════════════════════════════════════════════════
    // LOGIN / REGISTER — ทำงานได้ทุกหน้า ไม่รอ index.js
    // ════════════════════════════════════════════════════════════

    window.loginUser = window._shLoginUser = async function (event) {
        if (event) event.preventDefault();
        const email = (document.getElementById('loginEmail')?.value || '').trim();
        const pass  =  document.getElementById('loginPass')?.value  || '';
        if (!email || !pass) {
            return window.shAlert('ข้อผิดพลาด', 'กรุณากรอกอีเมลและรหัสผ่าน', '⚠️');
        }
        try {
            const res    = await fetch(`${API_BASE}/auth/login`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password: pass })
            });
            const result = await res.json();
            if (result.success) {
                const user = result.user;
                localStorage.setItem('activeUser', user.email);
                localStorage.setItem('userProfile_' + user.email, JSON.stringify({
                    email: user.email, fullName: user.fullName,
                    firstName: user.firstName, lastName: user.lastName,
                    phone: user.phone, role: user.role, profileImage: user.profileImage
                }));
                await window.shAlert('สำเร็จ', `ยินดีต้อนรับ คุณ${user.fullName}!`, '✅');
                window.closeAuthModal();
                // re-render header ทันทีโดยใช้ updateHeaderState (อ่าน localStorage ที่บันทึกไปแล้ว)
                updateHeaderState();
            } else if (result.banned) {
                // บัญชีถูกระงับ → แสดง appeal modal แทน alert ธรรมดา
                showBannedAppealModal(email, result.banReason || result.message || 'ไม่ระบุเหตุผล');
            } else {
                await window.shAlert('ข้อผิดพลาด', result.message || 'เข้าสู่ระบบไม่สำเร็จ', '❌');
            }
        } catch (err) {
            await window.shAlert('ข้อผิดพลาด', 'ไม่สามารถเชื่อมต่อ Backend ได้', '❌');
        }
    };

    window.registerUser = window._shRegisterUser = async function (event) {
        if (event) event.preventDefault();
        const firstName   = (document.getElementById('regFirstName')?.value || '').trim();
        const lastName    = (document.getElementById('regLastName')?.value  || '').trim();
        const email       = (document.getElementById('regEmail')?.value     || '').trim();
        const pass        =  document.getElementById('regPass')?.value       || '';
        const confirmPass =  document.getElementById('regConfirmPass')?.value || '';
        const phone       = (document.getElementById('regPhone')?.value     || '').trim();
        const terms       =  document.getElementById('regTerms')?.checked;
        if (!firstName || !lastName || !email || !pass) {
            return window.shAlert('ข้อผิดพลาด', 'กรุณากรอกข้อมูลที่มีเครื่องหมาย * ให้ครบ', '⚠️');
        }
        if (pass !== confirmPass) {
            return window.shAlert('ข้อผิดพลาด', 'รหัสผ่านไม่ตรงกัน!', '❌');
        }
        if (phone && !/^[0-9]+$/.test(phone)) {
            return window.shAlert('ข้อผิดพลาด', 'เบอร์โทรศัพท์ต้องเป็นตัวเลขเท่านั้น (0–9)', '⚠️');
        }
        if (!terms) {
            return window.shAlert('ข้อผิดพลาด', 'กรุณายอมรับเงื่อนไขก่อน', '⚠️');
        }
        try {
            const res    = await fetch(`${API_BASE}/auth/register`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ firstName, lastName, email, password: pass, phone })
            });
            const result = await res.json();
            if (result.success) {
                await window.shAlert('สำเร็จ', 'สมัครสมาชิกสำเร็จ! กรุณาเข้าสู่ระบบ', '✅');
                const emailEl = document.getElementById('loginEmail');
                if (emailEl) emailEl.value = email;
                window.switchAuthTab('loginTab');
            } else {
                await window.shAlert('ข้อผิดพลาด', result.message || 'ไม่สามารถสมัครสมาชิกได้', '❌');
            }
        } catch (err) {
            await window.shAlert('ข้อผิดพลาด', 'ไม่สามารถเชื่อมต่อ Backend ได้', '❌');
        }
    };

    window.quickLogin = function (email, pass) {
        const emailEl = document.getElementById('loginEmail');
        const passEl  = document.getElementById('loginPass');
        if (emailEl) emailEl.value = email;
        if (passEl)  passEl.value  = pass;
        window.loginUser(null);
    };

    // ════════════════════════════════════════════════════════════
    // BANNED USER APPEAL — แสดง modal เมื่อผู้ใช้ที่ถูกระงับพยายาม login
    // ════════════════════════════════════════════════════════════

    function showBannedAppealModal(email, banReason) {
        let modal = document.getElementById('bannedAppealModal');

        // ถ้า modal ยังไม่มีใน DOM → สร้างแบบ dynamic ทันที (ไม่ต้องพึ่งแคช auth-modals.html)
        if (!modal) {
            const wrapper = document.createElement('div');
            wrapper.innerHTML = `
<div class="modal-overlay" id="bannedAppealModal">
  <div class="modal-content" style="max-width:480px;">
    <div class="modal-header">
      <h2 class="modal-title" style="color:#dc3545;">🚫 บัญชีถูกระงับการใช้งาน</h2>
      <span class="close-modal-btn" onclick="closeBannedAppealModal()">&times;</span>
    </div>
    <input type="hidden" id="bannedEmail">
    <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:14px 16px;margin-bottom:16px;">
      <div style="font-size:15px;color:#991b1b;font-weight:600;margin-bottom:8px;">⚠️ บัญชีของคุณถูกระงับการใช้งาน</div>
      <div style="font-size:13px;color:#666;margin-bottom:6px;">เหตุผลที่ถูกระงับ:</div>
      <div id="bannedReasonDisplay" style="font-size:14px;color:#333;background:#fff;border:1px solid #e0d6d0;border-radius:6px;padding:10px 12px;line-height:1.5;"></div>
    </div>
    <div style="margin-bottom:16px;">
      <label style="font-weight:600;font-size:14px;color:#333;margin-bottom:8px;display:block;">
        📝 ยื่นคำร้องขอปลดแบน
        <span style="font-weight:400;font-size:12px;color:#888;display:block;margin-top:2px;">หากคุณคิดว่าเป็นการเข้าใจผิดหรือถูกระงับผิดบัญชี สามารถส่งข้อความแจ้ง Admin เพื่อพิจารณาได้</span>
      </label>
      <textarea id="appealReason" rows="5" placeholder="ระบุเหตุผลหรือแจ้งว่าอาจมีการเข้าใจผิด..."
        style="width:100%;padding:10px;border:1px solid #ccc;border-radius:6px;font-family:inherit;font-size:14px;box-sizing:border-box;resize:vertical;line-height:1.6;"></textarea>
    </div>
    <div style="display:flex;gap:10px;">
      <button onclick="closeBannedAppealModal()" style="flex:1;padding:10px;border:1px solid #ccc;border-radius:6px;background:#f3f4f6;color:#374151;font-weight:600;cursor:pointer;font-size:14px;">ตกลง</button>
      <button onclick="submitAppealForm()" style="flex:1;padding:10px;border:none;border-radius:6px;background:#2b7bb9;color:#fff;font-weight:600;cursor:pointer;font-size:14px;">📤 ส่งคำร้องขอปลดแบน</button>
    </div>
  </div>
</div>`;
            document.body.appendChild(wrapper);
            modal = document.getElementById('bannedAppealModal');
        }

        // ปิด auth modal ก่อน
        window.closeAuthModal();
        document.getElementById('bannedEmail').value = email;
        document.getElementById('bannedReasonDisplay').innerText = banReason;
        document.getElementById('appealReason').value = '';
        modal.style.display = 'flex';
    }

    // expose เป็น window function เพื่อให้ index.js เรียกได้
    window.showBannedAppealModal = showBannedAppealModal;

    window.closeBannedAppealModal = function () {
        const modal = document.getElementById('bannedAppealModal');
        if (modal) modal.style.display = 'none';
    };

    window.submitAppealForm = async function () {
        const email   = document.getElementById('bannedEmail').value;
        const message = (document.getElementById('appealReason').value || '').trim();

        if (!message) {
            return window.shAlert('ข้อมูลไม่ครบ', 'กรุณากรอกข้อความคำร้อง', '⚠️');
        }

        try {
            const res = await fetch(`${API_BASE}/auth/appeal`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, appealMessage: message })
            });
            const result = await res.json();
            if (result.success) {
                window.closeBannedAppealModal();
                await window.shAlert('ส่งคำร้องสำเร็จ', 'ส่งคำร้องสำเร็จ กรุณารอการตรวจสอบจาก Admin', '✅');
            } else {
                await window.shAlert('เกิดข้อผิดพลาด', result.message || 'ไม่สามารถส่งคำร้องได้', '❌');
            }
        } catch (err) {
            await window.shAlert('เกิดข้อผิดพลาด', 'ไม่สามารถเชื่อมต่อ Backend ได้', '❌');
        }
    };

    // ════════════════════════════════════════════════════════════
    // NAVIGATION HELPERS
    // ════════════════════════════════════════════════════════════

    window.shToggleMenu = function (id) {
        document.querySelectorAll('.dropdown-menu').forEach(m => {
            m.style.display = (m.id === id && m.style.display !== 'block') ? 'block' : 'none';
        });
    };

    window.toggleDropdown = function (id) {
        document.querySelectorAll('.dropdown-menu').forEach(m => {
            m.style.display = (m.id === id && m.style.display !== 'block') ? 'block' : 'none';
        });
    };

    window.logoutUser = window._shLogoutUser = async function () {
        const ok = await window.shConfirm('ออกจากระบบ', 'ต้องการออกจากระบบใช่หรือไม่?', '🚪');
        if (!ok) return;
        localStorage.removeItem('activeUser');
        // update header ทันที
        const guestMenu = document.getElementById('guestMenu');
        const userMenu  = document.getElementById('userMenu');
        if (guestMenu) guestMenu.style.display = 'flex';
        if (userMenu)  userMenu.style.display  = 'none';
        // ถ้าอยู่หน้า protected ให้ redirect ไป index
        const protectedPages = ['profile.html', 'edit-property.html', 'add-property.html', 'admin.html', 'edit-profile.html'];
        const currentPage = window.location.pathname.split('/').pop();
        if (protectedPages.includes(currentPage)) {
            window.location.href = 'index.html';
        } else {
            // หน้าอื่น reload เพื่อ reset state
            window.location.reload();
        }
    };

    window.checkLoginBeforePost = function () {
        if (localStorage.getItem('activeUser')) {
            window.location.href = 'add-property.html';
        } else {
            window.shAlert('แจ้งเตือน', 'กรุณาเข้าสู่ระบบก่อนลงประกาศ', '🔒')
                .then(() => window.openLogin());
        }
    };

    window.shAdvSearch = function () {
        // เปิด dropdown ที่ inject อยู่ใน DOM ได้เลยทุกหน้า
        const dropdown = document.getElementById('advancedSearchDropdown');
        if (dropdown) {
            // เรียก toggleAdvancedSearch ถ้ามี (index.js define ไว้)
            // ไม่งั้น toggle เองตรงๆ
            if (typeof toggleAdvancedSearch === 'function') {
                toggleAdvancedSearch();
            } else {
                const isOpen = dropdown.style.display === 'flex';
                dropdown.style.display = isOpen ? 'none' : 'flex';
                if (!isOpen && typeof loadIndexGeoData === 'function') {
                    loadIndexGeoData();
                }
            }
        } else {
            // ไม่มี dropdown ใน DOM (หน้าที่ไม่ได้ inject header) → redirect
            window.location.href = 'index.html';
        }
    };

    // ค้นหาจากแผนที่ — เปิด modal ในหน้าปัจจุบันได้เลย
    window.openMapModal = function () {
        const modal = document.getElementById('mapSearchModal');
        if (!modal) return;
        modal.style.display = 'flex';

        const iframe = document.getElementById('mapViewIframe');
        if (!iframe) return;

        // ตั้ง allow="geolocation" ให้ iframe เสมอ
        iframe.setAttribute('allow', 'geolocation');

        if (!iframe.getAttribute('data-loaded')) {
            // โหลดครั้งแรก — รอ 1 frame ให้ modal layout เสร็จก่อน
            requestAnimationFrame(() => {
                iframe.setAttribute('data-loaded', '1');
                iframe.src = 'map-view.html';
            });
        } else {
            // เปิดซ้ำ — รอ layout เสร็จก่อนส่ง reopen
            requestAnimationFrame(() => {
                setTimeout(() => {
                    try {
                        iframe.contentWindow?.postMessage({ type: 'reopen' }, '*');
                    } catch(e) {}
                }, 50);
            });
        }
    };

    window.closeMapModal = function () {
        const modal = document.getElementById('mapSearchModal');
        if (modal) modal.style.display = 'none';
    };

    // รับ message จาก iframe (จำนวนที่พัก)
    window.addEventListener('message', function(e) {
        if (e.data?.type === 'mapCount') {
            const el = document.getElementById('mapResultCount');
            if (el) el.innerText = `${e.data.count} ที่พัก`;
        }
    });

    // เรียกจากปุ่ม "ค้นหาที่พัก" ใน advanced search dropdown
    // หน้า index.js จะ override function นี้ทับเอง ที่นี่ทำแค่ fallback redirect สำหรับหน้าอื่น
    window._shApplyAdvancedFilter = function () {
        const params = new URLSearchParams();
        const keyword = document.getElementById('advKeyword')?.value.trim();
        if (keyword) params.set('keyword', keyword);
        const type = document.querySelector('input[name="advTypeR"]:checked')?.value;
        if (type) params.set('type', type);
        const province = document.getElementById('advProvince')?.value;
        if (province) params.set('province', province);
        const district = document.getElementById('advDistrict')?.value;
        if (district) params.set('district', district);
        const subdistrict = document.getElementById('advSubdistrict')?.value;
        if (subdistrict) params.set('subdistrict', subdistrict);
        const minPrice = document.getElementById('advMinPrice')?.value;
        if (minPrice) params.set('minPrice', minPrice);
        const maxPrice = document.getElementById('advMaxPrice')?.value;
        if (maxPrice) params.set('maxPrice', maxPrice);
        const rentType = document.getElementById('advRentType')?.value;
        if (rentType) params.set('rentType', rentType);
        const roomFacs = [...document.querySelectorAll('.adv-room-amenity:checked')].map(cb => cb.value);
        if (roomFacs.length) params.set('roomFacs', roomFacs.join(','));
        const bldgFacs = [...document.querySelectorAll('.adv-bldg-amenity:checked')].map(cb => cb.value);
        if (bldgFacs.length) params.set('bldgFacs', bldgFacs.join(','));
        window.location.href = 'index.html?' + params.toString();
    };

    // ตอนแรก applyAdvancedFilter ชี้ไป _shApplyAdvancedFilter
    // เมื่อ index.js โหลดเสร็จจะ override ทับเอง
    window.applyAdvancedFilter = window._shApplyAdvancedFilter;

    window.resetAdvancedFilter = function () {
        const fields = ['advKeyword', 'advMinPrice', 'advMaxPrice'];
        fields.forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
        const typeAll = document.querySelector('input[name="advTypeR"][value=""]');
        if (typeAll) typeAll.checked = true;
        const rentSel = document.getElementById('advRentType');
        if (rentSel) rentSel.value = '';
        document.querySelectorAll('.adv-room-amenity, .adv-bldg-amenity').forEach(cb => cb.checked = true);
        const provSel = document.getElementById('advProvince');
        const distSel = document.getElementById('advDistrict');
        const subSel  = document.getElementById('advSubdistrict');
        if (provSel) provSel.value = '';
        if (distSel) { distSel.innerHTML = '<option value="">ทุกอำเภอ/เขต</option>'; distSel.disabled = true; }
        if (subSel)  { subSel.innerHTML  = '<option value="">ทุกตำบล/แขวง</option>';  subSel.disabled  = true; }
    };

    window.shFavClick = function (e) {
        e.preventDefault();
        if (isIndexPage() && typeof showFavorites === 'function') {
            showFavorites();
        } else {
            window.location.href = 'index.html';
        }
    };

    window.shDoLogout = async function () {
        await window.logoutUser();
    };

    // ════════════════════════════════════════════════════════════
    // HAMBURGER BINDING (เรียกหลัง header inject เสร็จ)
    // ════════════════════════════════════════════════════════════
    function bindHamburger() {
        const btn = document.getElementById('hamburgerBtn');
        const nav = document.getElementById('mobileNav');
        if (!btn || !nav || btn._bound) return;
        btn._bound = true;

        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            const isOpen = nav.classList.contains('active');
            nav.classList.toggle('active');
            btn.classList.toggle('is-open');
            // sync user state ทุกครั้งที่เปิด
            if (!isOpen) syncMobileNav();
        });

        // ปิดเมื่อคลิกนอก
        document.addEventListener('click', function(e) {
            if (!nav.contains(e.target) && !btn.contains(e.target)) {
                nav.classList.remove('active');
                btn.classList.remove('is-open');
            }
        });

        // ปิดเมื่อ resize กลับ desktop
        window.addEventListener('resize', function() {
            if (window.innerWidth > 768) {
                nav.classList.remove('active');
                btn.classList.remove('is-open');
            }
        });
    }

    // sync ชื่อ user และแสดง/ซ่อน section ใน mobile nav
    function syncMobileNav() {
        const activeUser = localStorage.getItem('activeUser');
        const guestSec   = document.getElementById('mobGuestSection');
        const userSec    = document.getElementById('mobUserSection');
        const logoutSec  = document.getElementById('mobLogoutSection');
        const nameEl     = document.getElementById('mobUserName');

        if (!guestSec) return;

        if (activeUser) {
            guestSec.style.display  = 'none';
            userSec.style.display   = 'block';
            logoutSec.style.display = 'block';

            const profile = JSON.parse(localStorage.getItem('userProfile_' + activeUser) || 'null');
            const isAdmin = activeUser === 'admin' || profile?.role === 'ADMIN';

            if (nameEl) {
                const name = isAdmin ? 'ผู้ดูแลระบบ' : (profile?.fullName || activeUser);
                nameEl.textContent = name;
            }

            // เพิ่ม/ลบปุ่ม Admin Panel ใน mobile drawer
            const existingAdminBtn = document.getElementById('mobAdminBtn');
            if (isAdmin && !existingAdminBtn) {
                // สร้างปุ่ม Admin Panel ใน mobUserSection ก่อน mob-divider
                const adminBtn = document.createElement('button');
                adminBtn.id        = 'mobAdminBtn';
                adminBtn.className = 'mob-item mob-item-admin';
                adminBtn.innerHTML = '<span class="mob-icon">⚙️</span> จัดการระบบ (Admin Panel)';
                adminBtn.onclick   = function() {
                    window.closeMobileNav();
                    window.location.href = 'admin.html';
                };
                // insert ก่อน mob-divider ใน userSec
                const divider = userSec.querySelector('.mob-divider');
                if (divider) userSec.insertBefore(adminBtn, divider);
                else         userSec.appendChild(adminBtn);
            } else if (!isAdmin && existingAdminBtn) {
                existingAdminBtn.remove();
            }
        } else {
            guestSec.style.display  = 'block';
            userSec.style.display   = 'none';
            logoutSec.style.display = 'none';
            // ลบปุ่ม admin ถ้า logout
            document.getElementById('mobAdminBtn')?.remove();
        }
    }

    window.closeMobileNav = function() {
        document.getElementById('mobileNav')?.classList.remove('active');
        document.getElementById('hamburgerBtn')?.classList.remove('is-open');
    };

    // ════════════════════════════════════════════════════════════
    // INIT HEADER
    // ════════════════════════════════════════════════════════════

    async function initHeader() {
        const el = document.getElementById('shared-header');
        if (!el) return;

        if (!document.querySelector('meta[name="viewport"]')) {
            const meta = document.createElement('meta');
            meta.name = 'viewport';
            meta.content = 'width=device-width, initial-scale=1.0';
            document.head.insertBefore(meta, document.head.firstChild);
        }

        loadCSS('https://fonts.googleapis.com/css2?family=Prompt:wght@300;400;500;600;700&display=swap');
        loadCSS('css/index.css');
        loadCSS('css/responsive.css');

        try {
            const res  = await fetch('header.html?v=' + Date.now(), { cache: 'no-store' });
            const html = await res.text();
            el.innerHTML = html;
        } catch (e) {
            console.error('shared-header: cannot load header.html', e);
            return;
        }

        if (!document.getElementById('authModal')) {
            const modalsRes  = await fetch('auth-modals.html?v=' + Date.now(), { cache: 'no-store' });
            const modalsHtml = await modalsRes.text();
            const modalsDiv  = document.createElement('div');
            modalsDiv.innerHTML = modalsHtml;
            document.body.insertBefore(modalsDiv, document.body.firstChild);
        }

        // inject map search modal ถ้ายังไม่มี
        if (!document.getElementById('mapSearchModal')) {
            try {
                const mapRes  = await fetch('map-search-modal.html?v=' + Date.now(), { cache: 'no-store' });
                const mapHtml = await mapRes.text();
                const mapDiv  = document.createElement('div');
                mapDiv.innerHTML = mapHtml;
                document.body.appendChild(mapDiv);
                loadCSS('https://unpkg.com/leaflet@1.9.4/dist/leaflet.css');
                if (!document.querySelector('script[src*="map-utils"]')) {
                    loadJS('js/map-utils.js');
                }
            } catch(e) { console.warn('map-search-modal inject failed:', e); }
        }

        // โหลด index.js เพื่อให้ฟีเจอร์ index page ทำงาน (แต่ skip window.onload)
        // ถ้าอยู่หน้า index.html แล้ว — index.js โหลดโดยตรงอยู่แล้ว ไม่ต้องโหลดซ้ำ
        if (!window._shIndexJsLoaded) {
            window._shIndexJsLoaded = true;
            if (isIndexPage()) {
                // หน้า index.html โหลด index.js ตรงๆ แล้ว
                // รอ _indexPageInit function พร้อม แล้ว sync header state + trigger init ถ้ายังไม่ได้ทำ
                const waitForIndexJs = setInterval(() => {
                    if (typeof _indexPageInit === 'function') {
                        clearInterval(waitForIndexJs);
                        updateHeaderState();
                        if (typeof loadIndexGeoData === 'function') loadIndexGeoData();
                        if (typeof updateFavBadge   === 'function') updateFavBadge();
                        bindHamburger();
                        // เรียก _indexPageInit โดยตรงเพื่อกัน window.onload ไม่ fire
                        _indexPageInit();
                    }
                }, 50);
                // timeout 3 วินาที กัน loop ค้าง
                setTimeout(() => {
                    clearInterval(waitForIndexJs);
                    updateHeaderState();
                    bindHamburger();
                    // last resort — ลองเรียกโดยตรงอีกครั้ง
                    if (typeof _indexPageInit === 'function') _indexPageInit();
                }, 3000);
            } else {
                window.__isSharedHeader = true;
                loadJS('js/index.js', () => {
                    updateHeaderState();
                    if (typeof loadIndexGeoData === 'function') loadIndexGeoData();
                    if (typeof updateFavBadge    === 'function') updateFavBadge();
                    bindHamburger();
                });
            }
        } else {
            updateHeaderState();
            bindHamburger();
        }

        document.addEventListener('click', e => {
            if (!e.target.closest('.dropdown')) {
                document.querySelectorAll('.dropdown-menu').forEach(m => m.style.display = 'none');
            }
            if (!e.target.closest('.top-search-container')) {
                const s = document.getElementById('topSearchSuggestions');
                if (s) s.style.display = 'none';
            }
            if (!e.target.closest('#advSearchBtn') && !e.target.closest('#advancedSearchDropdown') && !e.target.closest('#mobileNav')) {
                if (typeof _closeAdvancedSearch === 'function') _closeAdvancedSearch();
            }
        });
    }

    // expose เป็น window เพื่อให้ admin.js เรียก re-render header ได้โดยตรง
    window.updateHeaderState = function updateHeaderState() {
        const activeUser = localStorage.getItem('activeUser');

        const guestMenu = document.getElementById('guestMenu');
        const userMenu  = document.getElementById('userMenu');

        if (!activeUser) {
            if (guestMenu) guestMenu.style.display = 'flex';
            if (userMenu)  userMenu.style.display  = 'none';
            return;
        }

        if (guestMenu) guestMenu.style.display = 'none';
        if (userMenu)  userMenu.style.display  = 'flex';

        // ตรวจสิทธิ์ admin: email === 'admin' (system) หรือ role === 'ADMIN' (promoted user)
        const profile     = JSON.parse(localStorage.getItem('userProfile_' + activeUser) || 'null');
        const isAdmin     = activeUser === 'admin' || profile?.role === 'ADMIN';
        const displayName = isAdmin && activeUser === 'admin'
            ? 'ผู้ดูแลระบบ'
            : (profile?.fullName || activeUser);

        // ── Desktop dropdown ────────────────────────────────────
        const nameEl = document.getElementById('displayUserEmail');
        if (nameEl) nameEl.innerText = displayName;

        const ddName = document.getElementById('dropdownUserName');
        if (ddName) ddName.innerText = displayName;

        // แสดง/ซ่อน admin section และ user section ใน dropdown
        const ddAdminSection = document.getElementById('ddAdminSection');
        const ddUserSection  = document.getElementById('ddUserSection');

        if (isAdmin) {
            // แสดง admin section, ซ่อน user section ปกติ
            if (ddAdminSection) ddAdminSection.style.display = 'block';
            if (ddUserSection)  ddUserSection.style.display  = 'none';

            // ซ่อน fav/chat icon บน admin
            const favLink  = document.querySelector('#userMenu a[onclick*="shFavClick"], #userMenu a[onclick*="favClick"], #userMenu a[onclick*="showFavorites"]');
            const chatLink = document.querySelector('#userMenu a[href="chat.html"]');
            if (favLink)  favLink.style.display  = 'none';
            if (chatLink) chatLink.style.display = 'none';
        } else {
            // user ปกติ
            if (ddAdminSection) ddAdminSection.style.display = 'none';
            if (ddUserSection)  ddUserSection.style.display  = 'block';

            // ── อัปเดต badge chat + fav ──
            fetch(`${API_BASE}/chat/unread?email=${encodeURIComponent(activeUser)}`)
                .then(r => r.json()).then(d => {
                    const count = (d.success && d.count > 0) ? d.count : 0;
                    const b  = document.getElementById('unreadBadge');
                    const db = document.getElementById('ddChatBadge');
                    if (b)  { b.innerText  = count; b.style.display  = count > 0 ? 'block'  : 'none'; }
                    if (db) { db.innerText = count; db.style.display = count > 0 ? 'inline' : 'none'; }
                }).catch(() => {});

            fetch(`${API_BASE}/favorites?email=${encodeURIComponent(activeUser)}`)
                .then(r => r.json()).then(d => {
                    const count = (d.success && d.data?.length > 0) ? d.data.length : 0;
                    const b  = document.getElementById('favCountBadge');
                    const db = document.getElementById('ddFavBadge');
                    if (b)  { b.innerText  = count; b.style.display  = count > 0 ? 'block'  : 'none'; }
                    if (db) { db.innerText = count; db.style.display = count > 0 ? 'inline' : 'none'; }
                }).catch(() => {});
        }

        // ── Mobile drawer ────────────────────────────────────────
        syncMobileNav();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initHeader);
    } else {
        initHeader();
    }
})();
