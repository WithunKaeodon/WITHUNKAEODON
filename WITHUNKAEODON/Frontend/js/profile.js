    var API_BASE = 'http://localhost:5000/api';
    const TYPE_LABELS = { DORMITORY: 'หอพัก/ห้องเช่า', APARTMENT: 'อพาร์ตเมนต์', HOUSE: 'บ้านเช่า', CONDO: 'คอนโด' };

    let activeUser = '';

    // ── ช่วงราคากลุ่ม ────────────────────────────────────
    let _profileGroupMap = {};  // propertyId → priceRange object

    async function buildProfileGroupMap(props) {
        _profileGroupMap = {};
        try {
            const res    = await fetch(`${API_BASE}/groups/owner/${encodeURIComponent(activeUser)}`);
            const result = await res.json();
            if (!result.success) return;

            result.data.forEach(g => {
                const members = g.members || [];
                if (members.length < 2) return;

                const types = [
                    { key: 'monthly',  field: 'priceMonthly',  unit: '/เดือน' },
                    { key: 'daily',    field: 'priceDaily',    unit: '/วัน'   },
                    { key: 'semester', field: 'priceSemester', unit: '/เทอม'  },
                    { key: 'yearly',   field: 'priceYearly',   unit: '/ปี'    },
                ];

                const memberProps = members.map(m => props.find(p => p.propertyId == m.propertyId)).filter(Boolean);
                if (memberProps.length < 2) return;

                const range = {};
                types.forEach(({ key, field, unit }) => {
                    const vals = memberProps.map(p => parseFloat(p[field]) || 0).filter(v => v > 0);
                    if (vals.length > 0)
                        range[key] = { min: Math.min(...vals), max: Math.max(...vals), unit };
                });

                memberProps.forEach(p => { _profileGroupMap[p.propertyId] = range; });
            });
        } catch (_) {}
    }

    function _fmtRange(range) {
        if (!range) return null;
        const { min, max, unit } = range;
        if (!min) return null;
        return min === max
            ? `฿${Number(min).toLocaleString()}${unit}`
            : `฿${Number(min).toLocaleString()} – ${Number(max).toLocaleString()}${unit}`;
    }

    function getPriceDisplay(prop) {
        const r = _profileGroupMap[prop.propertyId];
        return _fmtRange(r?.monthly || r?.daily || r?.semester || r?.yearly)
            || (prop.priceMonthly  > 0 ? `${Number(prop.priceMonthly).toLocaleString()} บาท/เดือน`  : null)
            || (prop.priceDaily    > 0 ? `${Number(prop.priceDaily).toLocaleString()} บาท/วัน`      : null)
            || (prop.priceSemester > 0 ? `${Number(prop.priceSemester).toLocaleString()} บาท/เทอม`  : null)
            || (prop.priceYearly   > 0 ? `${Number(prop.priceYearly).toLocaleString()} บาท/ปี`      : null)
            || 'ไม่ระบุราคา';
    }

    // =========================================
    // Custom Popup
    // =========================================
    function customAlert(title, message, icon = 'ℹ️') {
        return new Promise(resolve => {
            const overlay = document.getElementById('customPopup');
            document.getElementById('popupIcon').innerText = icon;
            document.getElementById('popupTitle').innerText = title;
            document.getElementById('popupMessage').innerText = message;
            document.getElementById('popupButtons').innerHTML =
                `<button class="btn-popup btn-popup-primary" id="popupOkBtn">ตกลง</button>`;
            overlay.style.display = 'flex';
            document.getElementById('popupOkBtn').onclick = () => { overlay.style.display = 'none'; resolve(); };
        });
    }

    function customConfirm(title, message, icon = '❓') {
        return new Promise(resolve => {
            const overlay = document.getElementById('customPopup');
            document.getElementById('popupIcon').innerText = icon;
            document.getElementById('popupTitle').innerText = title;
            document.getElementById('popupMessage').innerText = message;
            document.getElementById('popupButtons').innerHTML = `
                <button class="btn-popup" style="background:#e2e8f0;color:#4a5568" id="popupCancelBtn">ยกเลิก</button>
                <button class="btn-popup" style="background:#dc3545;color:white" id="popupConfirmBtn">ยืนยัน</button>`;
            overlay.style.display = 'flex';
            document.getElementById('popupCancelBtn').onclick = () => { overlay.style.display = 'none'; resolve(false); };
            document.getElementById('popupConfirmBtn').onclick = () => { overlay.style.display = 'none'; resolve(true); };
        });
    }

    // =========================================
    // Init
    // =========================================
    window.onload = async function () {
        activeUser = localStorage.getItem('activeUser');
        if (!activeUser) {
            alert('กรุณาเข้าสู่ระบบก่อนครับ');
            window.location.href = 'index.html';
            return;
        }
        await loadUserProfile();
        await renderProperties();
        await loadReportBadge();

        // รองรับ ?tab=xxx หรือ #favorites จาก dropdown header
        const params  = new URLSearchParams(window.location.search);
        const tabParam = params.get('tab') || (window.location.hash === '#favorites' ? 'favorites' : null);
        if (tabParam) {
            const navEl = document.querySelector(`.nav-item[onclick*="'${tabParam}'"]`);
            switchTab(tabParam, navEl);
        }
    };

    function switchTab(tabId, element) {
        document.querySelectorAll('.content-section').forEach(el => el.classList.remove('active'));
        document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
        document.getElementById('tab-' + tabId).classList.add('active');
        if (element) element.classList.add('active');
        if (tabId === 'settings')  loadSettingsTab();
        if (tabId === 'favorites') renderFavorites();
        if (tabId === 'reports')   renderReports();
    }

    // =========================================
    // โหลดข้อมูลผู้ใช้
    // =========================================
    async function loadUserProfile() {
        try {
            const res = await fetch(`${API_BASE}/users/me?email=${encodeURIComponent(activeUser)}`);
            const result = await res.json();
            if (!result.success) return;

            const u = result.data;
            const fullName = `${u.firstName || ''} ${u.lastName || ''}`.trim() || activeUser;
            const imgSrc = u.profileImage || 'https://via.placeholder.com/150?text=User';

            // อัปเดต localStorage ให้ sync
            localStorage.setItem('userProfile_' + activeUser, JSON.stringify({
                email: u.email, fullName, firstName: u.firstName,
                lastName: u.lastName, phone: u.phone, role: u.role,
                profileImage: u.profileImage
            }));

            document.getElementById('sideProfilePic').src  = imgSrc;
            document.getElementById('sideProfileName').innerText = fullName;
            document.getElementById('mainProfilePic').src  = imgSrc;
            document.getElementById('mainProfileName').innerText  = fullName;
            document.getElementById('mainProfileEmail').innerText = u.email;

            // inline edit display values
            const dispName = document.getElementById('disp-name');
            const dispPhone = document.getElementById('disp-phone');
            const dispLine = document.getElementById('disp-line');
            const dispFb   = document.getElementById('disp-facebook');
            if (dispName)  dispName.innerText  = fullName || '-';
            if (dispPhone) dispPhone.innerText = u.phone    || 'ยังไม่ได้ระบุ';
            if (dispLine)  dispLine.innerText  = u.lineId   || 'ยังไม่ได้ระบุ';
            if (dispFb)    dispFb.innerText    = u.facebook || 'ยังไม่ได้ระบุ';

            // pre-fill inputs
            const inpFN = document.getElementById('inp-firstName');
            const inpLN = document.getElementById('inp-lastName');
            const inpPh = document.getElementById('inp-phone');
            const inpLi = document.getElementById('inp-line');
            const inpFb = document.getElementById('inp-facebook');
            if (inpFN) inpFN.value = u.firstName || '';
            if (inpLN) inpLN.value = u.lastName  || '';
            if (inpPh) inpPh.value = u.phone     || '';
            if (inpLi) inpLi.value = u.lineId    || '';
            if (inpFb) inpFb.value = u.facebook  || '';

        } catch (err) {
            console.error('loadUserProfile error:', err);
        }
    }

    // =========================================
    // โหลดประกาศที่พัก
    // =========================================
    async function renderProperties() {
        const container = document.getElementById('propertyList');
        container.innerHTML = '<p style="color:#888;padding:20px">กำลังโหลด...</p>';

        try {
            const res = await fetch(`${API_BASE}/users/me/properties?email=${encodeURIComponent(activeUser)}`);
            const result = await res.json();

            if (!result.success) {
                container.innerHTML = `<div class="empty-state"><h3>เกิดข้อผิดพลาด</h3><p>${result.message}</p></div>`;
                return;
            }

            const properties = result.data;
            container.innerHTML = '';

            if (properties.length === 0) {
                container.innerHTML = `
                    <div class="empty-state">
                        <div style="font-size:40px;margin-bottom:10px">🏠</div>
                        <h3>คุณยังไม่มีประกาศที่พัก</h3>
                        <p>คลิก "สร้างประกาศ" ด้านบนเพื่อเริ่มต้น</p>
                    </div>`;
                return;
            }

            // โหลด price range จากกลุ่ม
            await buildProfileGroupMap(properties);

            properties.forEach(prop => {
                const fallback = 'https://placehold.co/300x200/e6f0ff/2b7bb9?text=No+Photo';
                const coverImg = prop.coverImage || fallback;
                const typeName = TYPE_LABELS[prop.propertyType] || 'ไม่ระบุประเภท';
                const displayPrice = getPriceDisplay(prop);

                const locationText = prop.province ? `จ.${prop.province}` : 'ไม่ระบุตำแหน่ง';
                const isPublished = prop.isPublished == 1;

                const card = document.createElement('div');
                card.className = 'property-card';
                card.innerHTML = `
                    <img src="${coverImg}" class="card-image" alt="property"
                         onerror="this.onerror=null;this.src='${fallback}'">
                    <div class="card-content">
                        <h3 class="card-title">${prop.title || 'ไม่มีชื่อที่พัก'}</h3>
                        <div class="card-info">🏷️ ${typeName}</div>
                        <div class="card-info">📍 ${locationText}</div>
                        <div class="card-price">${displayPrice}</div>
                    </div>
                    <div class="status-toggle">
                        <span style="font-size:14px;font-weight:bold;color:${isPublished ? '#4CAF50' : '#888'}">
                            ${isPublished ? '👀 เปิดเผยแพร่' : '🙈 ปิดการมองเห็น'}
                        </span>
                        <label class="switch">
                            <input type="checkbox" ${isPublished ? 'checked' : ''}
                                   onchange="togglePublish(${prop.propertyId}, this.checked, this)">
                            <span class="slider"></span>
                        </label>
                    </div>
                    <div class="card-actions">
                        <a href="view-property.html?id=${prop.propertyId}" class="action-btn btn-view">👁️ ดู</a>
                        <a href="edit-property.html?id=${prop.propertyId}" class="action-btn btn-edit">✏️ แก้ไข</a>
                        <button onclick="deleteProperty(${prop.propertyId})" class="action-btn btn-delete">🗑️ ลบ</button>
                    </div>`;
                container.appendChild(card);
            });

        } catch (err) {
            console.error('renderProperties error:', err);
            container.innerHTML = `<div class="empty-state"><h3>ไม่สามารถเชื่อมต่อ Backend ได้</h3><p>กรุณาตรวจสอบว่ารัน node server.js อยู่</p></div>`;
        }
    }

    // =========================================
    // โหลดที่พักโปรด (Favorites)
    // =========================================
    async function renderFavorites() {
        const container = document.getElementById('favoritesList');
        container.innerHTML = '<p style="color:#888;padding:20px">กำลังโหลด...</p>';

        try {
            const res = await fetch(`${API_BASE}/favorites?email=${encodeURIComponent(activeUser)}`);
            const result = await res.json();

            if (!result.success) {
                container.innerHTML = `<div class="empty-state"><h3>เกิดข้อผิดพลาด</h3><p>${result.message}</p></div>`;
                return;
            }

            const favorites = result.data;
            container.innerHTML = '';

            if (favorites.length === 0) {
                container.innerHTML = `
                    <div class="empty-state">
                        <div style="font-size:40px;margin-bottom:10px">💔</div>
                        <h3>ยังไม่มีที่พักโปรด</h3>
                        <p>กดหัวใจ ❤️ ที่การ์ดที่พักเพื่อบันทึกไว้ที่นี่</p>
                    </div>`;
                return;
            }

            favorites.forEach(fav => {
                const fallback = 'https://placehold.co/300x200/e6f0ff/2b7bb9?text=No+Photo';
                const coverImg = fav.coverImage || fallback;
                const typeName = TYPE_LABELS[fav.propertyType] || 'ไม่ระบุประเภท';

                let displayPrice = 'ไม่ระบุราคา';
                if (fav.priceMonthly > 0) displayPrice = `${Number(fav.priceMonthly).toLocaleString()} บาท/เดือน`;
                else if (fav.priceDaily > 0) displayPrice = `${Number(fav.priceDaily).toLocaleString()} บาท/วัน`;

                const locationText = fav.province ? `จ.${fav.province}` : 'ไม่ระบุตำแหน่ง';

                const card = document.createElement('div');
                card.className = 'property-card fav-card';
                card.style.cursor = 'pointer';
                card.innerHTML = `
                    <div style="position:relative;">
                        <img src="${coverImg}" class="card-image" alt="property"
                             onerror="this.onerror=null;this.src='${fallback}'"
                             onclick="window.location.href='view-property.html?id=${fav.propertyId}'">
                        <button class="fav-remove-btn" onclick="event.stopPropagation(); removeFavorite(${fav.propertyId}, this)"
                            title="นำออกจากรายการโปรด">❤️</button>
                    </div>
                    <div class="card-content" onclick="window.location.href='view-property.html?id=${fav.propertyId}'">
                        <h3 class="card-title">${fav.title || 'ไม่มีชื่อที่พัก'}</h3>
                        <div class="card-info">🏷️ ${typeName}</div>
                        <div class="card-info">📍 ${locationText}</div>
                        <div class="card-price">${displayPrice}</div>
                    </div>`;
                container.appendChild(card);
            });

        } catch (err) {
            console.error('renderFavorites error:', err);
            container.innerHTML = `<div class="empty-state"><h3>ไม่สามารถเชื่อมต่อ Backend ได้</h3></div>`;
        }
    }

    async function removeFavorite(propertyId, btn) {
        const confirmed = await customConfirm('นำออกจากโปรด', 'ต้องการนำที่พักนี้ออกจากรายการโปรดใช่หรือไม่?', '💔');
        if (!confirmed) return;
        try {
            const res = await fetch(`${API_BASE}/favorites`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: activeUser, propertyId })
            });
            const result = await res.json();
            if (result.success) {
                // ลบ card ออกจาก DOM ทันที
                btn.closest('.fav-card').remove();
                // ถ้าไม่เหลือการ์ด แสดง empty state
                const container = document.getElementById('favoritesList');
                if (!container.querySelector('.fav-card')) {
                    container.innerHTML = `
                        <div class="empty-state">
                            <div style="font-size:40px;margin-bottom:10px">💔</div>
                            <h3>ยังไม่มีที่พักโปรด</h3>
                            <p>กดหัวใจ ❤️ ที่การ์ดที่พักเพื่อบันทึกไว้ที่นี่</p>
                        </div>`;
                }
            } else {
                await customAlert('ข้อผิดพลาด', result.message, '❌');
            }
        } catch (err) {
            await customAlert('ข้อผิดพลาด', 'ไม่สามารถเชื่อมต่อ Backend ได้', '❌');
        }
    }

    // =========================================
    // รายงานที่พัก (Reports for Owner)
    // =========================================
    const REPORT_TYPE_LABEL = {
        SCAM:                  '🚫 ข้อมูลหลอกลวง/ไม่ถูกต้อง',
        INAPPROPRIATE_CONTENT: '⚠️ เนื้อหาไม่เหมาะสม',
        SPAM:                  '📵 ติดต่อไม่ได้/สแปม',
        OTHER:                 '📝 อื่นๆ'
    };
    const REPORT_STATUS_LABEL = {
        PENDING:     { text: '⏳ รอดำเนินการ',  cls: 'rpt-status-pending' },
        IN_PROGRESS: { text: '🔍 กำลังตรวจสอบ', cls: 'rpt-status-inprogress' },
        RESOLVED:    { text: '✅ แก้ไขแล้ว',     cls: 'rpt-status-resolved' },
        DISMISSED:   { text: '🗂️ ยกเลิกรายงาน', cls: 'rpt-status-dismissed' }
    };

    async function loadReportBadge() {
        try {
            const res = await fetch(`${API_BASE}/reports/owner?email=${encodeURIComponent(activeUser)}`);
            const result = await res.json();
            if (!result.success) return;
            const pending = result.data.reduce((sum, g) => sum + g.pendingCount, 0);
            const badge = document.getElementById('reportBadge');
            if (badge) {
                badge.innerText  = pending;
                badge.style.display = pending > 0 ? 'inline' : 'none';
            }
        } catch (e) { /* silent */ }
    }

    async function renderReports() {
        const container = document.getElementById('reportsList');
        container.innerHTML = '<p style="color:#888;padding:20px">กำลังโหลด...</p>';

        try {
            const res = await fetch(`${API_BASE}/reports/owner?email=${encodeURIComponent(activeUser)}`);
            const result = await res.json();

            if (!result.success) {
                container.innerHTML = `<div class="empty-state"><h3>เกิดข้อผิดพลาด</h3><p>${result.message}</p></div>`;
                return;
            }

            const groups = result.data;
            container.innerHTML = '';

            if (groups.length === 0) {
                container.innerHTML = `
                    <div class="empty-state">
                        <div style="font-size:48px;margin-bottom:12px">✅</div>
                        <h3>ไม่มีรายงานที่พักของคุณ</h3>
                        <p>ยังไม่มีผู้ใช้รายงานที่พักของคุณในขณะนี้</p>
                    </div>`;
                return;
            }

            // summary bar
            const totalPending = groups.reduce((s, g) => s + g.pendingCount, 0);
            const summaryEl = document.createElement('div');
            summaryEl.className = 'report-summary-bar';
            summaryEl.innerHTML = totalPending > 0
                ? `<span class="rpt-summary-warn">⚠️ มีรายงานที่ยังรอดำเนินการ <strong>${totalPending}</strong> รายการ — กรุณาตรวจสอบและแก้ไขโพสที่มีปัญหา</span>`
                : `<span class="rpt-summary-ok">✅ รายงานทั้งหมดได้รับการจัดการแล้ว</span>`;
            container.appendChild(summaryEl);

            groups.forEach(group => {
                const fallback = 'https://placehold.co/80x60/f5f0e6/8b7355?text=No+Photo';
                const imgSrc   = group.coverImage || fallback;
                const hasPending = group.pendingCount > 0;

                // wrapper card
                const card = document.createElement('div');
                card.className = `report-group-card${hasPending ? ' report-group-card--warn' : ''}`;

                // รายการ report rows
                const TYPE_TO_SECTION = {
                    INAPPROPRIATE_CONTENT: 'images',
                    SCAM:                  'general',
                    SPAM:                  'profile',
                    INACCURATE_INFO:       'price',
                    OTHER:                 'general'
                };

                const rowsHtml = group.reports.map(r => {
                    const typeLabel  = REPORT_TYPE_LABEL[r.reportType] || r.reportType;
                    const statusInfo = REPORT_STATUS_LABEL[r.status] || { text: r.status, cls: '' };
                    const dateStr    = new Date(r.reportedAt).toLocaleDateString('th-TH', { year:'numeric', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' });
                    const section    = TYPE_TO_SECTION[r.reportType] || 'general';
                    const isPending  = r.status === 'PENDING' || r.status === 'IN_PROGRESS';

                    // ซ่อน row ที่แก้ไขแล้ว (RESOLVED/DISMISSED)
                    if (!isPending) return '';

                    const fixBtn = `<button class="rpt-inline-fix-btn"
                               onclick="markFixingAndGoSection(${group.propertyId}, '${section}')"
                               title="แก้ไขส่วนนี้">✏️ แก้ไข</button>`;
                    return `
                        <div class="report-row">
                            <div class="report-row-left">
                                <span class="rpt-type">${typeLabel}</span>
                                ${r.description ? `<span class="rpt-desc">${r.description.replace(/\s*\[✅[^\]]*\]/g, '').trim()}</span>` : ''}
                            </div>
                            <div class="report-row-right">
                                ${fixBtn}
                                <span class="rpt-status ${statusInfo.cls}">${statusInfo.text}</span>
                                <span class="rpt-date">${dateStr}</span>
                            </div>
                        </div>`;
                }).join('');

                card.innerHTML = `
                    <div class="report-group-header">
                        <img src="${imgSrc}" class="report-cover"
                             onerror="this.onerror=null;this.src='${fallback}'">
                        <div class="report-group-info">
                            <div class="report-group-title">${group.propTitle}</div>
                            <div class="report-group-meta">
                                ได้รับรายงาน <strong>${group.reports.length}</strong> รายการ
                                ${hasPending ? `<span class="rpt-badge-pending">รอแก้ไข ${group.pendingCount} รายการ</span>` : '<span class="rpt-badge-ok">จัดการแล้ว</span>'}
                            </div>
                        </div>
                        <div class="report-group-actions">
                            <button class="rpt-btn-edit" onclick="markFixingAndGo(${group.propertyId}, ${JSON.stringify(group.reports.map(r=>r.reportType))})">🔧 แก้ไขโพสนี้</button>
                            <a href="view-property.html?id=${group.propertyId}" class="rpt-btn-view" target="_blank">👁️ ดูโพส</a>
                        </div>
                    </div>
                    <div class="report-rows-list">${rowsHtml}</div>`;

                container.appendChild(card);
            });

        } catch (err) {
            console.error('renderReports error:', err);
            container.innerHTML = `<div class="empty-state"><h3>ไม่สามารถเชื่อมต่อ Backend ได้</h3></div>`;
        }
    }

    async function markFixingAndGo(propertyId, reportTypes) {
        const SECTION_MAP = {
            INAPPROPRIATE_CONTENT: 'images',
            SCAM:                  'general',
            SPAM:                  'profile',
            INACCURATE_INFO:       'price',
            INACCURATE_INFO2:      'room-amenities',
            OTHER:                 'general'
        };
        let section = 'general';
        for (const t of reportTypes) {
            if (SECTION_MAP[t]) { section = SECTION_MAP[t]; break; }
        }
        await markFixingAndGoSection(propertyId, section);
    }

    async function markFixingAndGoSection(propertyId, section) {
        fetch(`${API_BASE}/reports/mark-fixing`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: activeUser, propertyId })
        }).catch(() => {});

        if (section === 'profile') {
            window.location.href = `profile.html?tab=profile`;
            return;
        }
        window.location.href = `edit-property.html?id=${propertyId}&section=${section}`;
    }

    // =========================================
    // Toggle เปิด/ปิดการเผยแพร่
    // =========================================
    async function togglePublish(propertyId, isPublished, checkbox) {
        try {
            const res = await fetch(`${API_BASE}/properties/${propertyId}/publish`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isPublished, ownerEmail: activeUser })
            });
            const result = await res.json();
            if (result.success) {
                // อัปเดต label ใกล้ๆ checkbox ทันที
                const statusLabel = checkbox.closest('.status-toggle').querySelector('span');
                statusLabel.style.color = isPublished ? '#4CAF50' : '#888';
                statusLabel.innerText = isPublished ? '👀 เปิดเผยแพร่' : '🙈 ปิดการมองเห็น';
            } else {
                await customAlert('ข้อผิดพลาด', result.message, '❌');
                checkbox.checked = !isPublished; // คืนค่าเดิม
            }
        } catch (err) {
            await customAlert('ข้อผิดพลาด', 'ไม่สามารถเชื่อมต่อ Backend ได้', '❌');
            checkbox.checked = !isPublished;
        }
    }

    // =========================================
    // ลบที่พัก
    // =========================================
    async function deleteProperty(propertyId) {
        const confirmed = await customConfirm('ยืนยันการลบ', 'คุณแน่ใจหรือไม่? ข้อมูลและรูปภาพทั้งหมดจะถูกลบถาวร', '🗑️');
        if (!confirmed) return;

        try {
            const res = await fetch(`${API_BASE}/properties/${propertyId}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ownerEmail: activeUser })
            });
            const result = await res.json();
            if (result.success) {
                await customAlert('สำเร็จ', 'ลบประกาศเรียบร้อยแล้ว', '✅');
                await renderProperties(); // reload list
            } else {
                await customAlert('ข้อผิดพลาด', result.message, '❌');
            }
        } catch (err) {
            await customAlert('ข้อผิดพลาด', 'ไม่สามารถเชื่อมต่อ Backend ได้', '❌');
        }
    }

    // =========================================
    // Inline Edit: openField / closeField / saveField / inlineChangePic
    // =========================================
    function openField(fieldName) {
        ['name', 'phone', 'line', 'facebook', 'password'].forEach(f => {
            if (f !== fieldName) closeField(f);
        });
        const editDiv = document.getElementById('edit-' + fieldName);
        const rowDiv  = document.getElementById('field-' + fieldName);
        if (!editDiv) return;
        editDiv.style.display = 'block';
        rowDiv.style.display  = 'none';
    }

    function closeField(fieldName) {
        const editDiv = document.getElementById('edit-' + fieldName);
        const rowDiv  = document.getElementById('field-' + fieldName);
        if (!editDiv) return;
        editDiv.style.display = 'none';
        rowDiv.style.display  = 'flex';
    }

    async function saveField(fieldName) {
        if (fieldName === 'name') {
            const firstName = (document.getElementById('inp-firstName').value || '').trim();
            const lastName  = (document.getElementById('inp-lastName').value  || '').trim();
            if (!firstName || !lastName) {
                await customAlert('ข้อมูลไม่ครบ', 'กรุณากรอกชื่อและนามสกุล', '⚠️');
                return;
            }
            try {
                const res = await fetch(`${API_BASE}/users/me`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: activeUser, firstName, lastName })
                });
                const result = await res.json();
                if (result.success) {
                    const fullName = `${firstName} ${lastName}`.trim();
                    document.getElementById('disp-name').innerText     = fullName;
                    document.getElementById('mainProfileName').innerText = fullName;
                    document.getElementById('sideProfileName').innerText = fullName;
                    // sync localStorage
                    const cached = JSON.parse(localStorage.getItem('userProfile_' + activeUser) || '{}');
                    cached.fullName = fullName; cached.firstName = firstName; cached.lastName = lastName;
                    localStorage.setItem('userProfile_' + activeUser, JSON.stringify(cached));
                    closeField('name');
                    await customAlert('สำเร็จ', 'บันทึกชื่อแล้ว', '✅');
                } else {
                    await customAlert('ข้อผิดพลาด', result.message, '❌');
                }
            } catch (err) {
                await customAlert('ข้อผิดพลาด', 'ไม่สามารถเชื่อมต่อ Backend ได้', '❌');
            }

        } else if (fieldName === 'phone') {
            const phone = (document.getElementById('inp-phone').value || '').trim();
            try {
                const res = await fetch(`${API_BASE}/users/me`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: activeUser, phone })
                });
                const result = await res.json();
                if (result.success) {
                    document.getElementById('disp-phone').innerText = phone || 'ยังไม่ได้ระบุ';
                    const cached = JSON.parse(localStorage.getItem('userProfile_' + activeUser) || '{}');
                    cached.phone = phone;
                    localStorage.setItem('userProfile_' + activeUser, JSON.stringify(cached));
                    closeField('phone');
                    await customAlert('สำเร็จ', 'บันทึกเบอร์โทรแล้ว', '✅');
                } else {
                    await customAlert('ข้อผิดพลาด', result.message, '❌');
                }
            } catch (err) {
                await customAlert('ข้อผิดพลาด', 'ไม่สามารถเชื่อมต่อ Backend ได้', '❌');
            }

        } else if (fieldName === 'line') {
            const lineId = (document.getElementById('inp-line').value || '').trim();
            try {
                const res = await fetch(`${API_BASE}/users/me`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: activeUser, lineId })
                });
                const result = await res.json();
                if (result.success) {
                    document.getElementById('disp-line').innerText = lineId || 'ยังไม่ได้ระบุ';
                    closeField('line');
                    await customAlert('สำเร็จ', 'บันทึก Line ID แล้ว', '✅');
                } else {
                    await customAlert('ข้อผิดพลาด', result.message, '❌');
                }
            } catch (err) {
                await customAlert('ข้อผิดพลาด', 'ไม่สามารถเชื่อมต่อ Backend ได้', '❌');
            }

        } else if (fieldName === 'facebook') {
            const facebook = (document.getElementById('inp-facebook').value || '').trim();
            try {
                const res = await fetch(`${API_BASE}/users/me`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: activeUser, facebook })
                });
                const result = await res.json();
                if (result.success) {
                    document.getElementById('disp-facebook').innerText = facebook || 'ยังไม่ได้ระบุ';
                    closeField('facebook');
                    await customAlert('สำเร็จ', 'บันทึก Facebook แล้ว', '✅');
                } else {
                    await customAlert('ข้อผิดพลาด', result.message, '❌');
                }
            } catch (err) {
                await customAlert('ข้อผิดพลาด', 'ไม่สามารถเชื่อมต่อ Backend ได้', '❌');
            }

        } else if (fieldName === 'password') {
            const oldPw     = document.getElementById('inp-oldPw').value;
            const newPw     = document.getElementById('inp-newPw').value;
            const confirmPw = document.getElementById('inp-confirmPw').value;
            if (!oldPw || !newPw || !confirmPw) {
                await customAlert('ข้อมูลไม่ครบ', 'กรุณากรอกรหัสผ่านให้ครบ', '⚠️');
                return;
            }
            if (newPw !== confirmPw) {
                await customAlert('ข้อผิดพลาด', 'รหัสผ่านใหม่ไม่ตรงกัน', '❌');
                return;
            }
            if (newPw.length < 6) {
                await customAlert('ข้อผิดพลาด', 'รหัสผ่านต้องมีอย่างน้อย 6 ตัว', '⚠️');
                return;
            }
            try {
                const res = await fetch(`${API_BASE}/users/me/password`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: activeUser, oldPassword: oldPw, newPassword: newPw })
                });
                const result = await res.json();
                if (result.success) {
                    document.getElementById('inp-oldPw').value     = '';
                    document.getElementById('inp-newPw').value     = '';
                    document.getElementById('inp-confirmPw').value = '';
                    closeField('password');
                    await customAlert('สำเร็จ', 'เปลี่ยนรหัสผ่านแล้ว', '✅');
                } else {
                    await customAlert('ข้อผิดพลาด', result.message, '❌');
                }
            } catch (err) {
                await customAlert('ข้อผิดพลาด', 'ไม่สามารถเชื่อมต่อ Backend ได้', '❌');
            }
        }
    }

    async function inlineChangePic(event) {
        const file = event.target.files[0];
        if (!file) return;
        if (file.size > 3 * 1024 * 1024) {
            await customAlert('ไฟล์ใหญ่เกินไป', 'ขนาดไฟล์ต้องไม่เกิน 3MB', '⚠️');
            return;
        }
        const reader = new FileReader();
        reader.onload = async (e) => {
            const base64 = e.target.result;
            // preview ทันที
            document.getElementById('mainProfilePic').src  = base64;
            document.getElementById('sideProfilePic').src  = base64;
            try {
                const res = await fetch(`${API_BASE}/users/me`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: activeUser, profileImage: base64 })
                });
                const result = await res.json();
                if (result.success) {
                    const cached = JSON.parse(localStorage.getItem('userProfile_' + activeUser) || '{}');
                    cached.profileImage = base64;
                    localStorage.setItem('userProfile_' + activeUser, JSON.stringify(cached));
                    await customAlert('สำเร็จ', 'เปลี่ยนรูปโปรไฟล์แล้ว', '✅');
                } else {
                    await customAlert('ข้อผิดพลาด', result.message, '❌');
                }
            } catch (err) {
                await customAlert('ข้อผิดพลาด', 'ไม่สามารถเชื่อมต่อ Backend ได้', '❌');
            }
        };
        reader.readAsDataURL(file);
        event.target.value = '';
    }

    // =========================================
    // Tab settings: โหลดข้อมูลและ functions (legacy — kept for compat)
    // =========================================
    async function loadSettingsTab() {
        try {
            const res = await fetch(`${API_BASE}/users/me?email=${encodeURIComponent(activeUser)}`);
            const result = await res.json();
            if (!result.success) return;
            const u = result.data;
            document.getElementById('settingFirstName').value = u.firstName || '';
            document.getElementById('settingLastName').value  = u.lastName  || '';
            document.getElementById('settingEmail').value     = u.email     || '';
            document.getElementById('settingPhone').value     = u.phone     || '';
            if (u.profileImage) {
                document.getElementById('settingProfilePic').src = u.profileImage;
            }
        } catch (e) { console.error('loadSettingsTab error:', e); }
    }

    let pendingSettingPic = null;
    function previewSettingPic(event) {
        const file = event.target.files[0];
        if (!file) return;
        if (file.size > 3 * 1024 * 1024) { customAlert('ไฟล์ใหญ่เกินไป', 'ไม่เกิน 3MB', '⚠️'); return; }
        const reader = new FileReader();
        reader.onload = e => {
            pendingSettingPic = e.target.result;
            document.getElementById('settingProfilePic').src = pendingSettingPic;
        };
        reader.readAsDataURL(file);
        event.target.value = '';
    }

    async function saveProfileInline(e) {
        e.preventDefault();
        const firstName = document.getElementById('settingFirstName').value.trim();
        const lastName  = document.getElementById('settingLastName').value.trim();
        const phone     = document.getElementById('settingPhone').value.trim();
        if (!firstName || !lastName) { await customAlert('ข้อมูลไม่ครบ', 'กรุณากรอกชื่อและนามสกุล', '⚠️'); return; }
        try {
            const payload = { email: activeUser, firstName, lastName, phone };
            if (pendingSettingPic) payload.profileImage = pendingSettingPic;
            const res = await fetch(`${API_BASE}/users/me`, {
                method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const result = await res.json();
            if (result.success) {
                pendingSettingPic = null;
                const fullName = `${firstName} ${lastName}`.trim();
                const cached = JSON.parse(localStorage.getItem('userProfile_' + activeUser) || '{}');
                cached.fullName = fullName; cached.firstName = firstName;
                cached.lastName = lastName; cached.phone = phone;
                if (payload.profileImage) cached.profileImage = payload.profileImage;
                localStorage.setItem('userProfile_' + activeUser, JSON.stringify(cached));
                await loadUserProfile();
                await customAlert('สำเร็จ', 'บันทึกข้อมูลส่วนตัวแล้ว!', '✅');
            } else { await customAlert('ข้อผิดพลาด', result.message, '❌'); }
        } catch (err) { await customAlert('ข้อผิดพลาด', 'ไม่สามารถเชื่อมต่อ Backend ได้', '❌'); }
    }

    async function changePasswordInline(e) {
        e.preventDefault();
        const oldPw     = document.getElementById('settingOldPw').value;
        const newPw     = document.getElementById('settingNewPw').value;
        const confirmPw = document.getElementById('settingConfirmPw').value;
        if (newPw !== confirmPw) { await customAlert('ข้อผิดพลาด', 'รหัสผ่านใหม่ไม่ตรงกัน!', '❌'); return; }
        if (newPw.length < 6)    { await customAlert('ข้อผิดพลาด', 'รหัสผ่านต้องมีอย่างน้อย 6 ตัว', '⚠️'); return; }
        try {
            const res = await fetch(`${API_BASE}/users/me/password`, {
                method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: activeUser, oldPassword: oldPw, newPassword: newPw })
            });
            const result = await res.json();
            if (result.success) {
                document.getElementById('settingOldPw').value    = '';
                document.getElementById('settingNewPw').value    = '';
                document.getElementById('settingConfirmPw').value = '';
                await customAlert('สำเร็จ', 'เปลี่ยนรหัสผ่านแล้ว!', '✅');
            } else { await customAlert('ข้อผิดพลาด', result.message, '❌'); }
        } catch (err) { await customAlert('ข้อผิดพลาด', 'ไม่สามารถเชื่อมต่อ Backend ได้', '❌'); }
    }
    async function logout() {
        const confirmed = await customConfirm('ออกจากระบบ', 'ต้องการออกจากระบบใช่หรือไม่?', '🚪');
        if (confirmed) {
            localStorage.removeItem('activeUser');
            window.location.href = 'index.html';
        }
    }

// =========================================
// จัดกลุ่มประกาศ (Group Modal) — v2
// =========================================

let _gmAllProps  = [];   // ประกาศทั้งหมดของเจ้าของ
let _gmGroups    = [];   // กลุ่มที่มีอยู่ { groupId, groupName, members[] }
let _gmGroupedMap = {};  // propertyId → groupName ที่จองอยู่แล้ว (สำหรับ exclusive UI)

// ── เปิด modal ─────────────────────────────────────────
async function openGroupModal() {
    document.getElementById('groupModal').style.display = 'flex';
    // reset accordion ให้เปิดเสมอเมื่อ open modal
    const wrapper = document.getElementById('gmExistingWrapper');
    const arrow   = document.getElementById('gmToggleArrow');
    if (wrapper) { wrapper.classList.remove('collapsed'); }
    if (arrow)   { arrow.classList.remove('collapsed'); }
    await _gmLoad();
}

function toggleExistingGroups() {
    const wrapper = document.getElementById('gmExistingWrapper');
    const arrow   = document.getElementById('gmToggleArrow');
    if (!wrapper) return;
    wrapper.classList.toggle('collapsed');
    arrow.classList.toggle('collapsed');
}

async function _gmLoad() {
    document.getElementById('gmExistingGroups').innerHTML = '<p class="gm-empty-hint">กำลังโหลด...</p>';
    document.getElementById('gmPropList').innerHTML       = '<p class="gm-empty-hint">กำลังโหลด...</p>';
    cancelGmEdit();

    try {
        const [propsRes, groupsRes] = await Promise.all([
            fetch(`${API_BASE}/users/me/properties?email=${encodeURIComponent(activeUser)}`),
            fetch(`${API_BASE}/groups/owner/${encodeURIComponent(activeUser)}`),
        ]);
        const propsData  = await propsRes.json();
        const groupsData = await groupsRes.json();

        _gmAllProps = propsData.success  ? propsData.data  : [];
        _gmGroups   = groupsData.success ? groupsData.data : [];

        // สร้าง map: propertyId → groupName ของ group ที่จองอยู่แล้ว
        // ใช้สำหรับ mark disabled ใน checkbox list
        _gmGroupedMap = {};
        _gmGroups.forEach(g => {
            g.members.forEach(m => {
                _gmGroupedMap[m.propertyId] = g.groupName || `กลุ่ม #${g.groupId}`;
            });
        });

        _renderExistingGroups();
        _renderPropCheckboxes(null);
    } catch (err) {
        console.error('_gmLoad error:', err);
        document.getElementById('gmExistingGroups').innerHTML = '<p class="gm-empty-hint" style="color:#e74c3c;">โหลดไม่ได้ กรุณาตรวจสอบ Backend</p>';
    }
}

// ── ส่วนที่ 1: แสดงกลุ่มที่มีอยู่ ──────────────────────
function _renderExistingGroups() {
    const el = document.getElementById('gmExistingGroups');
    if (!_gmGroups.length) {
        el.innerHTML = '<p class="gm-empty-hint">ยังไม่มีกลุ่ม — สร้างกลุ่มแรกด้านล่างได้เลย</p>';
        return;
    }

    el.innerHTML = _gmGroups.map(g => {
        const memberNames = g.members.map(m =>
            `<span class="gm-chip">${m.title}</span>`
        ).join('');

        return `
        <div class="gm-group-card" id="gm-card-${g.groupId}">
            <div class="gm-group-card-top">
                <div class="gm-group-card-info">
                    <div class="gm-group-name">${g.groupName || '<span style="color:#bbb;font-style:italic;">ไม่มีชื่อกลุ่ม</span>'}</div>
                    <div class="gm-group-members">${memberNames || '<span style="color:#bbb;font-size:11px;">ไม่มีสมาชิก</span>'}</div>
                </div>
                <div class="gm-group-card-actions">
                    <button class="gm-btn-edit-grp" onclick="startEditGroup(${g.groupId})">✏️ แก้ไข</button>
                    <button class="gm-btn-del-grp"  onclick="deleteGroup(${g.groupId}, '${(g.groupName||'กลุ่มนี้').replace(/'/g,"\\'")}')">🗑️</button>
                </div>
            </div>
        </div>`;
    }).join('');
}

// ── ส่วนที่ 2: render checkbox ประกาศ ──────────────────
// selectedIds = propertyId ของ group ที่กำลัง edit (null = สร้างใหม่)
// editingGroupId = groupId ที่กำลัง edit (null = สร้างใหม่)
function _renderPropCheckboxes(selectedIds, editingGroupId = null) {
    const el = document.getElementById('gmPropList');

    if (!_gmAllProps.length) {
        el.innerHTML = '<p class="gm-empty-hint">ยังไม่มีประกาศ — กรุณาสร้างประกาศก่อน</p>';
        return;
    }

    const selected = new Set((selectedIds || []).map(Number));

    // หา groupId ของ group ที่กำลัง edit เพื่อ whitelist members ของ group นั้น
    const editingGroup  = editingGroupId ? _gmGroups.find(g => g.groupId === editingGroupId) : null;
    const editingMemberIds = new Set(editingGroup ? editingGroup.members.map(m => m.propertyId) : []);

    el.innerHTML = _gmAllProps.map(p => {
        const pid     = p.propertyId;
        const checked = selected.has(pid) ? 'checked' : '';

        // property อยู่ group อื่น (ไม่ใช่ group ที่กำลัง edit) → disabled
        const takenByGroupName = _gmGroupedMap[pid];
        const isTaken = takenByGroupName && !editingMemberIds.has(pid);

        const price = p.priceMonthly > 0
            ? `฿${Number(p.priceMonthly).toLocaleString()}/เดือน`
            : p.priceDaily > 0 ? `฿${Number(p.priceDaily).toLocaleString()}/วัน` : '';
        const thumb = p.coverImage
            ? `<img src="${p.coverImage}" class="gm-thumb" alt="" onerror="this.style.display='none'">`
            : `<div class="gm-thumb gm-thumb-empty">🏠</div>`;

        if (isTaken) {
            // แสดงแบบ disabled พร้อม badge บอกกลุ่มที่อยู่
            return `
            <div class="gm-prop-item gm-prop-item--taken" title="อยู่ใน ${takenByGroupName} แล้ว">
                <input type="checkbox" class="gm-cb" value="${pid}" disabled style="opacity:0.3;">
                ${thumb}
                <div class="gm-prop-info">
                    <div class="gm-prop-title" style="color:#bbb;">${p.title}</div>
                    <div style="font-size:11px;color:#e74c3c;margin-top:2px;">📌 อยู่ใน${takenByGroupName}แล้ว</div>
                </div>
                <span class="gm-taken-badge">จองแล้ว</span>
            </div>`;
        }

        return `
        <label class="gm-prop-item ${checked ? 'gm-prop-item--checked' : ''}">
            <input type="checkbox" class="gm-cb" value="${pid}" ${checked}
                   onchange="this.closest('.gm-prop-item').classList.toggle('gm-prop-item--checked', this.checked)">
            ${thumb}
            <div class="gm-prop-info">
                <div class="gm-prop-title">${p.title}</div>
                ${price ? `<div class="gm-prop-price">${price}</div>` : ''}
            </div>
            <span class="gm-check-icon">✓</span>
        </label>`;
    }).join('');
}

// ── แก้ไขกลุ่ม ──────────────────────────────────────────
function startEditGroup(groupId) {
    const group = _gmGroups.find(g => g.groupId === groupId);
    if (!group) return;

    document.getElementById('gmEditId').value       = groupId;
    document.getElementById('gmGroupName').value    = group.groupName || '';
    document.getElementById('gmFormLabel').textContent = '✏️ แก้ไขกลุ่ม';
    document.getElementById('gmCancelEdit').style.display = 'inline-block';

    const memberIds = group.members.map(m => m.propertyId);
    _renderPropCheckboxes(memberIds, groupId); // ส่ง editingGroupId เพื่อ whitelist members ของ group นี้

    // scroll ไปหา form
    document.getElementById('gmFormLabel').scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    // highlight card ที่กำลัง edit
    document.querySelectorAll('.gm-group-card').forEach(c => c.classList.remove('gm-group-card--editing'));
    const card = document.getElementById(`gm-card-${groupId}`);
    if (card) card.classList.add('gm-group-card--editing');
}

function cancelGmEdit() {
    document.getElementById('gmEditId').value       = '';
    document.getElementById('gmGroupName').value    = '';
    document.getElementById('gmFormLabel').textContent = '➕ สร้างกลุ่มใหม่';
    document.getElementById('gmCancelEdit').style.display = 'none';
    document.querySelectorAll('.gm-group-card').forEach(c => c.classList.remove('gm-group-card--editing'));
    _renderPropCheckboxes(null);
}

// ── บันทึก (สร้าง / แก้ไข) ─────────────────────────────
async function saveGroup() {
    const editId      = document.getElementById('gmEditId').value;
    const groupName   = document.getElementById('gmGroupName').value.trim();
    const checked     = [...document.querySelectorAll('.gm-cb:checked')].map(cb => parseInt(cb.value));

    if (checked.length < 2) {
        await customAlert('เลือกไม่ครบ', 'กรุณาเลือกประกาศอย่างน้อย 2 รายการ', '⚠️');
        return;
    }

    try {
        let res;
        if (editId) {
            res = await fetch(`${API_BASE}/groups/${editId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ownerEmail: activeUser, groupName, propertyIds: checked }),
            });
        } else {
            res = await fetch(`${API_BASE}/groups`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ownerEmail: activeUser, groupName, propertyIds: checked }),
            });
        }

        const result = await res.json();
        if (!result.success) { await customAlert('ข้อผิดพลาด', result.message, '❌'); return; }

        await _gmLoad(); // reload ทั้ง modal
        await customAlert('สำเร็จ', editId ? 'อัปเดตกลุ่มเรียบร้อยแล้ว' : 'สร้างกลุ่มเรียบร้อยแล้ว', '✅');
    } catch (err) {
        console.error('saveGroup error:', err);
        await customAlert('ข้อผิดพลาด', 'เกิดข้อผิดพลาด กรุณาลองใหม่', '❌');
    }
}

// ── ลบกลุ่ม ────────────────────────────────────────────
async function deleteGroup(groupId, groupName) {
    const ok = await customConfirm('ลบกลุ่ม', `ต้องการลบกลุ่ม "${groupName}" ใช่หรือไม่?\nปุ่มสลับใน view-property จะหายไป`, '🗑️');
    if (!ok) return;
    try {
        const res    = await fetch(`${API_BASE}/groups/${groupId}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ownerEmail: activeUser }),
        });
        const result = await res.json();
        if (!result.success) { await customAlert('ข้อผิดพลาด', result.message, '❌'); return; }
        await _gmLoad();
    } catch (err) {
        await customAlert('ข้อผิดพลาด', 'เกิดข้อผิดพลาด', '❌');
    }
}

function closeGroupModal() {
    document.getElementById('groupModal').style.display = 'none';
}

document.addEventListener('click', e => {
    const modal = document.getElementById('groupModal');
    if (modal && e.target === modal) closeGroupModal();
});
