var API_BASE = 'http://localhost:5000/api';
const ADMIN_HEADER = { 'Content-Type': 'application/json', 'x-admin-email': 'admin' };

function customAlert(title, message, icon = 'ℹ️') {
    return new Promise(resolve => {
        document.getElementById('popupIcon').innerText = icon;
        document.getElementById('popupTitle').innerText = title;
        document.getElementById('popupMessage').innerText = message;
        document.getElementById('popupButtons').innerHTML =
            `<button class="btn-popup btn-popup-primary" id="popupOkBtn">ตกลง</button>`;
        document.getElementById('customPopup').style.display = 'flex';
        document.getElementById('popupOkBtn').onclick = () => {
            document.getElementById('customPopup').style.display = 'none'; resolve();
        };
    });
}

function customConfirm(title, message, icon = '❓') {
    return new Promise(resolve => {
        document.getElementById('popupIcon').innerText = icon;
        document.getElementById('popupTitle').innerText = title;
        document.getElementById('popupMessage').innerText = message;
        document.getElementById('popupButtons').innerHTML = `
            <button class="btn-popup btn-popup-cancel" id="popupCancelBtn">ยกเลิก</button>
            <button class="btn-popup btn-popup-danger" id="popupConfirmBtn">ยืนยัน</button>`;
        document.getElementById('customPopup').style.display = 'flex';
        document.getElementById('popupCancelBtn').onclick = () => {
            document.getElementById('customPopup').style.display = 'none'; resolve(false);
        };
        document.getElementById('popupConfirmBtn').onclick = () => {
            document.getElementById('customPopup').style.display = 'none'; resolve(true);
        };
    });
}

window.onload = async function () {
    const activeUser = localStorage.getItem('activeUser');

    // ── ตรวจสิทธิ์ขั้นแรก: อ่านจาก localStorage ──────────────
    const cachedProfile = JSON.parse(localStorage.getItem('userProfile_' + activeUser) || 'null');
    const cachedIsAdmin = activeUser === 'admin' || cachedProfile?.role === 'ADMIN';

    if (!activeUser || !cachedIsAdmin) {
        await customAlert('ไม่มีสิทธิ์เข้าถึง', 'คุณไม่ได้เข้าสู่ระบบในฐานะ Admin', '🚫');
        window.location.href = 'index.html'; return;
    }

    // ── ตรวจสิทธิ์ขั้นที่สอง: verify กับ backend (กัน stale cache / role ถูก demote) ──
    // เฉพาะ promoted user (ไม่ใช่ system admin) เพราะ system admin ไม่มีใน users table ปกติ
    if (activeUser !== 'admin') {
        try {
            const res    = await fetch(`${API_BASE}/admin/users/${encodeURIComponent(activeUser)}`,
                                       { headers: ADMIN_HEADER });
            const result = await res.json();
            if (!result.success || result.data?.role !== 'ADMIN') {
                // role ถูกเปลี่ยนแล้ว — อัปเดต localStorage แล้วเตะออก
                if (result.success && cachedProfile) {
                    cachedProfile.role = result.data?.role || 'USER';
                    localStorage.setItem('userProfile_' + activeUser, JSON.stringify(cachedProfile));
                }
                await customAlert('ไม่มีสิทธิ์เข้าถึง', 'สิทธิ์ Admin ของคุณถูกเปลี่ยนแปลงแล้ว', '🚫');
                window.location.href = 'index.html'; return;
            }
            // อัปเดต role ใน localStorage ให้ตรงกับ backend เสมอ
            if (cachedProfile) {
                cachedProfile.role = 'ADMIN';
                localStorage.setItem('userProfile_' + activeUser, JSON.stringify(cachedProfile));
            }
        } catch (_) {
            // offline / backend error — ยอมรับ cached role ไปก่อน
            console.warn('[admin] Cannot verify role from backend, using cached role.');
        }
    }

    loadReports(); loadProperties(); loadUsers(); loadAppeals();
};

function switchTab(tabId, el) {
    document.querySelectorAll('.tab-content').forEach(t => t.style.display = 'none');
    document.querySelectorAll('.menu-item').forEach(m => m.classList.remove('active'));
    document.getElementById(tabId).style.display = 'block';
    el.classList.add('active');
    // ปิด hamburger menu หลังเลือก tab (บน mobile)
    const menuList = document.getElementById('adminMenuList');
    if (menuList) menuList.classList.remove('open');
}

// ── Hamburger toggle (mobile/tablet) ─────────────────────────
function toggleAdminMenu() {
    const menuList = document.getElementById('adminMenuList');
    if (!menuList) return;
    const isOpen = menuList.classList.contains('open');
    if (isOpen) {
        menuList.classList.remove('open');
    } else {
        menuList.classList.add('open');
    }
}

// ── ปิดเมนูเมื่อคลิกนอก sidebar บน mobile ─────────────────
document.addEventListener('click', function(e) {
    if (window.innerWidth > 992) return;
    const sidebar = document.querySelector('.sidebar');
    const menuList = document.getElementById('adminMenuList');
    if (!sidebar || !menuList) return;
    if (!sidebar.contains(e.target)) {
        menuList.classList.remove('open');
    }
});

async function adminLogout() {
    const ok = await customConfirm('ออกจากระบบ', 'คุณต้องการออกจากระบบ Admin ใช่หรือไม่?', '👋');
    if (ok) { localStorage.removeItem('activeUser'); window.location.href = 'index.html'; }
}

// ------------------------------------------------------------------
//  PAGINATION HELPER
// ------------------------------------------------------------------
const PAGE_SIZE = 10;

function renderPagination(containerId, totalItems, currentPage, onPageChange) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));

    let html = `<div class="pagination-info">แสดง ${totalItems > 0 ? Math.min((currentPage-1)*PAGE_SIZE+1, totalItems) : 0}–${Math.min(currentPage*PAGE_SIZE, totalItems)} จาก ${totalItems} รายการ</div><div class="pagination-btns">`;

    // ปุ่มก่อนหน้า
    html += `<button class="pg-btn" ${currentPage===1?'disabled':''} onclick="${onPageChange}(${currentPage-1})">« ก่อนหน้า</button>`;

    // ปุ่มเลขหน้า
    const delta = 2;
    for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= currentPage - delta && i <= currentPage + delta)) {
            html += `<button class="pg-btn ${i===currentPage?'active':''}" onclick="${onPageChange}(${i})">${i}</button>`;
        } else if (i === currentPage - delta - 1 || i === currentPage + delta + 1) {
            html += `<span class="pg-ellipsis">…</span>`;
        }
    }

    // ปุ่มถัดไป
    html += `<button class="pg-btn" ${currentPage===totalPages?'disabled':''} onclick="${onPageChange}(${currentPage+1})">ถัดไป »</button>`;
    html += '</div>';
    container.innerHTML = html;
}

// -- Reports ------------------------------------------------------
let groupedReportsData = {};
let reportsPage = 1;
let reportsAllData = [];
let reportsFiltered = [];

async function loadReports() {
    const tbody = document.querySelector('#table-reports tbody');
    tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;padding:20px;color:#888;">กำลังโหลด...</td></tr>';
    try {
        const res = await fetch(`${API_BASE}/admin/reports`, { headers: ADMIN_HEADER });
        const result = await res.json();
        tbody.innerHTML = ''; groupedReportsData = {};

        if (!result.success || result.data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;color:#888;padding:30px;">ไม่มีรายงานในขณะนี้ 👍</td></tr>';
            document.getElementById('pagination-reports').innerHTML = '';
            return;
        }
        reportsAllData = result.data.slice().sort((a, b) => {
            if (b.pendingCount !== a.pendingCount) return b.pendingCount - a.pendingCount;
            return b.count - a.count;
        });
        result.data.forEach(g => { groupedReportsData[g.propertyId] = g; });
        reportsFiltered = reportsAllData;
        reportsPage = 1;
        renderReportsTable();
    } catch (err) {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;color:red;padding:20px;">เกิดข้อผิดพลาด — ตรวจสอบ Backend ด้วย</td></tr>';
    }
}

function filterReports() {
    const kw = (document.getElementById('reportSearch')?.value || '').toLowerCase();
    const statusFilter = document.getElementById('reportStatusFilter')?.value || '';
    reportsFiltered = reportsAllData.filter(g => {
        const matchKw = !kw ||
            (g.propTitle || '').toLowerCase().includes(kw) ||
            (g.ownerEmail || '').toLowerCase().includes(kw);
        const matchStatus =
            !statusFilter ||
            (statusFilter === 'pending' && g.pendingCount > 0) ||
            (statusFilter === 'clear'   && g.pendingCount === 0);
        return matchKw && matchStatus;
    });
    reportsPage = 1;
    renderReportsTable();
}

function goReportsPage(page) {
    reportsPage = page;
    renderReportsTable();
    document.querySelector('#tab-reports').scrollTop = 0;
}

function renderReportsTable() {
    const tbody = document.querySelector('#table-reports tbody');
    tbody.innerHTML = '';

    if (!reportsFiltered.length) {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;color:#888;padding:30px;">ไม่พบรายงาน</td></tr>';
        document.getElementById('pagination-reports').innerHTML = '';
        return;
    }

    const start = (reportsPage - 1) * PAGE_SIZE;
    const slice = reportsFiltered.slice(start, start + PAGE_SIZE);

    slice.forEach(g => {
        // ── Count badge ──
        const countColor = g.count >= 5 ? '#991b1b' : g.count >= 3 ? '#c2410c' : '#92400e';
        const countBg    = g.count >= 5 ? '#fee2e2' : g.count >= 3 ? '#ffedd5' : '#fef3c7';
        const countBadge = `<span class="prop-badge" style="background:${countBg};color:${countColor};">🚩 ${g.count} ครั้ง</span>`;

        // ── Pending badge ──
        const pendingBadge = g.pendingCount > 0
            ? `<span class="prop-badge" style="background:#fee2e2;color:#991b1b;">⏳ ${g.pendingCount} รอ</span>`
            : `<span class="prop-badge" style="background:#d1fae5;color:#065f46;">✔ เรียบร้อย</span>`;

        // ── Owner-fixed badge ──
        const fixedBadge = (g.reasons && g.reasons.some(r => r.includes('OWNER_FIXED')))
            ? `<span class="prop-badge" style="background:#ede9fe;color:#5b21b6;">🔧 แก้แล้ว</span>`
            : '';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>
                <div style="font-weight:600;line-height:1.4;">${g.propTitle}</div>
                <div style="font-size:12px;color:#888;margin-top:2px;">👤 ${g.ownerEmail}</div>
            </td>
            <td>
                <div style="display:flex;flex-wrap:wrap;gap:5px;align-items:center;">
                    ${countBadge}${pendingBadge}${fixedBadge}
                </div>
            </td>
            <td class="prop-action-cell">
                <div class="prop-btn-group">
                    <button class="prop-btn prop-btn-view"
                        onclick="viewReportDetail(${g.propertyId},'${g.propTitle.replace(/'/g,"\\'")}','${g.ownerEmail}')">
                        📋 รายละเอียด</button>
                    <button class="prop-btn prop-btn-hide"
                        onclick="openWarningModal(${g.propertyId})">
                        📤 แจ้งเตือน</button>
                </div>
            </td>`;
        tbody.appendChild(tr);
    });
    renderPagination('pagination-reports', reportsFiltered.length, reportsPage, 'goReportsPage');
}

async function setReportStatus(propertyId, status) {
    const labels = { IN_PROGRESS: 'กำลังดำเนินการ', RESOLVED: 'แก้ไขแล้ว', DISMISSED: 'ยกเลิก' };
    const ok = await customConfirm('เปลี่ยนสถานะรายงาน', `เปลี่ยนสถานะเป็น "${labels[status]}" ใช่หรือไม่?`, '⚠️');
    if (!ok) return;
    const res = await fetch(`${API_BASE}/admin/reports/resolve`, {
        method: 'PATCH', headers: ADMIN_HEADER,
        body: JSON.stringify({ propertyId, status, adminEmail: 'admin' })
    });
    const result = await res.json();
    if (result.success) loadReports();
    else await customAlert('เกิดข้อผิดพลาด', result.message, '❌');
}

async function resolveReports(propertyId) {
    return setReportStatus(propertyId, 'RESOLVED');
}

async function viewReportDetail(propertyId, propTitle, ownerEmail) {
    document.getElementById('rdPropTitle').innerText = propTitle;
    document.getElementById('reportDetailModal').dataset.ownerEmail = ownerEmail || '';
    const container = document.getElementById('report-detail-list');
    container.innerHTML = '<div style="text-align:center;padding:30px;color:#888;">กำลังโหลด...</div>';
    document.getElementById('reportDetailModal').style.display = 'flex';

    try {
        const res = await fetch(`${API_BASE}/admin/reports/${propertyId}`, { headers: ADMIN_HEADER });
        const result = await res.json();

        if (!result.success || result.data.length === 0) {
            container.innerHTML = '<div style="text-align:center;padding:30px;color:#888;">ไม่มีรายงาน</div>';
            return;
        }

        const STATUS_CONFIG = {
            PENDING:      { label: 'รอดำเนินการ',    bg: '#fff3cd', color: '#856404', dot: '#f5c842', border: '#ffc107' },
            IN_PROGRESS:  { label: 'กำลังดำเนินการ', bg: '#dbeafe', color: '#1e40af', dot: '#3b82f6', border: '#3b82f6' },
            OWNER_FIXED:  { label: '🔧 แก้ไขแล้ว',   bg: '#ede9fe', color: '#6d28d9', dot: '#8b5cf6', border: '#8b5cf6' },
            RESOLVED:     { label: '✅ เสร็จสิ้น',    bg: '#d1fae5', color: '#065f46', dot: '#10b981', border: '#10b981' },
            DISMISSED:    { label: 'ยกเลิก',          bg: '#f3f4f6', color: '#6b7280', dot: '#9ca3af', border: '#d1d5db' }
        };
        const TYPE_ICON = {
            INAPPROPRIATE_CONTENT: { icon: '🔞', label: 'เนื้อหา/รูปภาพไม่เหมาะสม' },
            SPAM:                  { icon: '📢', label: 'สแปม/โฆษณาเกินจริง' },
            SCAM:                  { icon: '🚨', label: 'ข้อมูลหลอกลวง' },
            INACCURATE_INFO:       { icon: '📝', label: 'ข้อมูลไม่ตรงความจริง' },
            OTHER:                 { icon: '💬', label: 'อื่นๆ' }
        };

        container.innerHTML = '';
        result.data.forEach(r => {
            const sc   = STATUS_CONFIG[r.status] || { label: r.status, bg: '#eee', color: '#555', dot: '#ccc', border: '#ccc' };
            const ti   = TYPE_ICON[r.reportType] || { icon: '💬', label: r.reportType };
            const date = new Date(r.reportedAt).toLocaleString('th-TH', {
                year: 'numeric', month: 'short', day: 'numeric',
                hour: '2-digit', minute: '2-digit'
            });

            let actionBtns = '';
            if (r.status === 'OWNER_FIXED') {
                actionBtns = `
                    <a href="view-property.html?id=${propertyId}" target="_blank" class="rd-btn rd-btn-view">
                        👁 ดูที่พัก
                    </a>
                    <button class="rd-btn rd-btn-resolve" onclick="resolveOneReport(${r.reportId}, ${propertyId})">
                        ✅ เสร็จสิ้น
                    </button>`;
            } else if (r.status === 'PENDING' || r.status === 'IN_PROGRESS') {
                const spamBtn = r.reportType === 'SPAM'
                    ? `<button class="rd-btn" style="background:#e0f2fe;color:#0369a1;"
                           onclick="viewOwnerProfile('${ownerEmail || ''}')">
                           👤 ดูโปรไฟล์เจ้าของ
                       </button>`
                    : '';
                actionBtns = `
                    <a href="view-property.html?id=${propertyId}" target="_blank" class="rd-btn rd-btn-view">
                        👁 ดูที่พัก
                    </a>
                    ${spamBtn}
                    <button class="rd-btn rd-btn-resolve" onclick="resolveOneReport(${r.reportId}, ${propertyId})">
                        ✅ เสร็จสิ้น
                    </button>
                    <button class="rd-btn rd-btn-dismiss" onclick="dismissOneReport(${r.reportId}, ${propertyId})">
                        ❌ ยกเลิก
                    </button>`;
            }

            const card = document.createElement('div');
            card.className = 'rd-card';
            card.style.borderLeft = `4px solid ${sc.border}`;
            card.innerHTML = `
                <div class="rd-card-left">
                    <div class="rd-type-icon">${ti.icon}</div>
                    <div class="rd-card-info">
                        <div class="rd-type-label">${ti.label}</div>
                        ${r.description ? `<div class="rd-desc">💬 ${r.description.replace(/\s*\[?[^\]]*\]/g, '').trim()}</div>` : ''}
                        <div class="rd-meta">
                            <span>📧 ${r.reporterEmail}</span>
                            <span>🕐 ${date}</span>
                        </div>
                    </div>
                </div>
                <div class="rd-card-right">
                    <span class="rd-status-badge" style="background:${sc.bg};color:${sc.color};">
                        <span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${sc.dot};margin-right:5px;flex-shrink:0;"></span>
                        ${sc.label}
                    </span>
                    ${actionBtns ? `<div class="rd-actions">${actionBtns}</div>` : ''}
                </div>`;
            container.appendChild(card);
        });
    } catch (err) {
        container.innerHTML = '<div style="text-align:center;padding:30px;color:red;">เกิดข้อผิดพลาด</div>';
    }
}

async function viewOwnerProfile(email) {
    if (!email) { await customAlert('ไม่พบข้อมูล', 'ไม่มีอีเมลเจ้าของ', '❌'); return; }
    try {
        const res = await fetch(`${API_BASE}/users/me?email=${encodeURIComponent(email)}`, { headers: ADMIN_HEADER });
        const result = await res.json();
        if (!result.success) { await customAlert('เกิดข้อผิดพลาด', result.message, '❌'); return; }
        const u = result.data;
        const fullName = `${u.firstName || ''} ${u.lastName || ''}`.trim() || email;
        const phone    = u.phone || '-';
        const imgSrc   = u.profileImage || null;

        document.getElementById('popupIcon').innerHTML = imgSrc
            ? `<img src="${imgSrc}" style="width:64px;height:64px;border-radius:50%;object-fit:cover;border:2px solid #dcd3c6;">`
            : `<span style="font-size:48px;">👤</span>`;
        document.getElementById('popupTitle').innerText = fullName;
        document.getElementById('popupMessage').innerHTML = `
            <div style="text-align:left;font-size:14px;line-height:2;">
                <div>📧 <strong>อีเมล:</strong> ${email}</div>
                <div>📞 <strong>เบอร์โทร:</strong> <span style="color:${u.phone ? '#065f46' : '#aaa'};font-weight:600;">${phone}</span></div>
                <div>📅 <strong>วันที่สมัคร:</strong> ${u.createdAt ? new Date(u.createdAt).toLocaleDateString('th-TH') : '-'}</div>
            </div>`;
        document.getElementById('popupButtons').innerHTML =
            `<button class="btn-popup btn-popup-primary" id="popupOkBtn">ตกลง</button>`;
        document.getElementById('customPopup').style.display = 'flex';
        document.getElementById('popupOkBtn').onclick = () => {
            document.getElementById('customPopup').style.display = 'none';
        };
    } catch (err) {
        await customAlert('เกิดข้อผิดพลาด', 'ไม่สามารถโหลดข้อมูลได้', '❌');
    }
}

async function resolveOneReport(reportId, propertyId) {
    const ok = await customConfirm('ยืนยัน', 'เปลี่ยนสถานะเป็น "เสร็จสิ้น" ใช่หรือไม่?', '✅');
    if (!ok) return;
    try {
        const res = await fetch(`${API_BASE}/admin/reports/resolve-one`, {
            method: 'PATCH', headers: ADMIN_HEADER,
            body: JSON.stringify({ reportId, status: 'RESOLVED', adminEmail: 'admin' })
        });
        const result = await res.json();
        if (result.success) {
            await customAlert('สำเร็จ', 'อัปเดตสถานะแล้ว', '✅');
            const propTitle  = document.getElementById('rdPropTitle').innerText;
            const ownerEmail = document.getElementById('reportDetailModal').dataset.ownerEmail || '';
            viewReportDetail(propertyId, propTitle, ownerEmail);
            loadReports();
        } else { await customAlert('เกิดข้อผิดพลาด', result.message, '❌'); }
    } catch (err) { await customAlert('เกิดข้อผิดพลาด', 'ไม่สามารถเชื่อมต่อ Backend ได้', '❌'); }
}

async function dismissOneReport(reportId, propertyId) {
    const ok = await customConfirm('ยืนยัน', 'ต้องการยกเลิกรายงานนี้ใช่หรือไม่?', '❌');
    if (!ok) return;
    try {
        const res = await fetch(`${API_BASE}/admin/reports/resolve-one`, {
            method: 'PATCH', headers: ADMIN_HEADER,
            body: JSON.stringify({ reportId, status: 'DISMISSED', adminEmail: 'admin' })
        });
        const result = await res.json();
        if (result.success) {
            const propTitle = document.getElementById('rdPropTitle').innerText;
            viewReportDetail(propertyId, propTitle);
            loadReports();
        } else { await customAlert('เกิดข้อผิดพลาด', result.message, '❌'); }
    } catch (err) { await customAlert('เกิดข้อผิดพลาด', 'ไม่สามารถเชื่อมต่อ Backend ได้', '❌'); }
}

function openWarningModal(propertyId) {
    const g = groupedReportsData[propertyId];
    if (!g) return;

    document.getElementById('warnPropId').value              = g.propertyId;
    document.getElementById('warnPropName').value            = g.propTitle;
    document.getElementById('warnOwnerEmail').value          = g.ownerEmail;
    document.getElementById('warnPropNameDisplay').innerText = g.propTitle;
    document.getElementById('warnOwnerDisplay').innerText    = g.ownerEmail;

    const TYPE_LABEL = {
        INAPPROPRIATE_CONTENT: { text: '🔞 เนื้อหา/รูปภาพไม่เหมาะสม หรือ ลามกอนาจาร', color: '#e67e22' },
        SCAM:                  { text: '🚨 ข้อมูลหลอกลวง/โกงเงิน',               color: '#e53e3e' },
        SPAM:                  { text: '📢 สแปม/โฆษณาเกินความจริง',               color: '#718096' },
        INACCURATE_INFO:       { text: '📝 ข้อมูลไม่ตรงกับความเป็นจริง',          color: '#3182ce' },
        OTHER:                 { text: '💬 อื่นๆ',                                  color: '#888' }
    };
    const STATUS_LABEL = {
        PENDING:     { text: 'รอดำเนินการ', bg: '#fff3cd', color: '#856404' },
        IN_PROGRESS: { text: 'กำลังดำเนิน', bg: '#dbeafe', color: '#1e40af' },
        RESOLVED:    { text: 'แก้ไขแล้ว',    bg: '#d1fae5', color: '#065f46' },
        DISMISSED:   { text: 'ยกเลิกแล้ว',   bg: '#f3f4f6', color: '#6b7280' }
    };

    const list = document.getElementById('warnReasonsList');
    list.innerHTML = '';
    g.reasons.forEach(r => {
        const match = r.match(/^\[([^\]]+)\]\s*([^:]+)(?::\s*(.*))?$/);
        const status  = match ? match[1] : '';
        const type    = match ? match[2].trim() : r;
        const desc    = match ? (match[3] || '') : '';

        const typeInfo   = TYPE_LABEL[type]   || { text: type,   color: '#555' };
        const statusInfo = STATUS_LABEL[status] || { text: status, bg: '#eee', color: '#555' };

        const li = document.createElement('li');
        li.style.cssText = 'margin-bottom:8px; list-style:none; padding:0;';
        li.innerHTML = `
            <div style="display:flex; align-items:flex-start; gap:8px; background:#faf8f5; border:1px solid #ece8e1; border-radius:8px; padding:10px 12px;">
                <div style="flex:1;">
                    <span style="font-weight:600; color:${typeInfo.color}; font-size:13px;">${typeInfo.text}</span>
                    ${desc ? `<div style="font-size:12px; color:#666; margin-top:3px;">💬 ${desc}</div>` : ''}
                </div>
                <span style="background:${statusInfo.bg}; color:${statusInfo.color}; border-radius:20px; padding:2px 10px; font-size:11px; font-weight:600; white-space:nowrap;">${statusInfo.text}</span>
            </div>`;
        list.appendChild(li);
    });

    const reasonTypes = new Set(g.reasons.map(r => {
        const m = r.match(/^\[[^\]]+\]\s*([^:]+)/);
        return m ? m[1].trim() : '';
    }));

    const msgParts = [];
    if (reasonTypes.has('INAPPROPRIATE_CONTENT')) {
        msgParts.push('🔞 มีรายงานเนื้อหาหรือรูปภาพที่ไม่เหมาะสม กรุณาลบหรือแก้ไขเนื้อหาดังกล่าว\n→ หลังแก้ไขแล้ว กรุณาแจ้งกลับใน Chat นี้ [FIX:images]');
    }
    if (reasonTypes.has('SCAM')) {
        msgParts.push('🚨 มีรายงานว่าข้อมูลที่พักมีลักษณะหลอกลวงผู้เช่า\n→ กรุณาอัปเดตข้อมูลให้ถูกต้องและโปร่งใส [FIX:general]');
    }
    if (reasonTypes.has('SPAM')) {
        msgParts.push('📢 มีรายงานว่าประกาศมีลักษณะสแปม\n→ กรุณาแก้ไขคำอธิบายและรายละเอียดติดต่อให้เหมาะสม [FIX:contact]');
    }
    if (reasonTypes.has('INACCURATE_INFO')) {
        msgParts.push('📝 มีรายงานว่าข้อมูลไม่ตรงความจริง เช่น ราคา สิ่งอำนวยความสะดวก หรือรูปภาพ\n→ กรุณาอัปเดตข้อมูลให้ถูกต้อง [FIX:price]');
    }
    if (reasonTypes.has('OTHER')) {
        msgParts.push('💬 มีรายงานปัญหาอื่นๆ เกี่ยวกับที่พักของคุณ เช่น พฤติกรรมไม่เหมาะสม/ข้อพิพาท\n→ กรุณาตรวจสอบและแก้ไขปัญหาโดยเร็ว [FIX:general]');
    }
    if (msgParts.length === 0) {
        msgParts.push('⚠️ มีรายงานปัญหาเกี่ยวกับที่พักของคุณ กรุณาตรวจสอบและแก้ไข [FIX:general]');
    }

    const autoMsg = `เรียน เจ้าของที่พัก "${g.propTitle}" ขณะนี้มีรายงานปัญหาเข้ามาดังนี้:\n\n${msgParts.join('\n\n')}\n\nกรุณาดำเนินการแก้ไขภายในระยะเวลาที่กำหนด`;
    document.getElementById('warnMessage').value = autoMsg;

    document.getElementById('warningModal').style.display = 'flex';
}

function toggleDeadlineInput() {
    const action = document.getElementById('warnAction').value;
    document.getElementById('deadlineDaysGroup').style.display =
        action === 'auto_days' ? 'block' : 'none';
}

async function confirmWarning() {
    const ownerEmail = document.getElementById('warnOwnerEmail').value;
    const propTitle  = document.getElementById('warnPropName').value;
    const propertyId = document.getElementById('warnPropId').value;
    const message    = document.getElementById('warnMessage').value;
    const action     = document.getElementById('warnAction').value;
    const deadlineDays = action === 'auto_days'
        ? parseInt(document.getElementById('deadlineDays').value) || 3
        : null;

    if (action === 'auto_days' && (!deadlineDays || deadlineDays < 1)) {
        await customAlert('ข้อมูลไม่ครบ', 'กรุณาระบุจำนวนวันที่ให้เวลาแก้ไข', '⚠️');
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/admin/warn`, {
            method: 'POST', headers: ADMIN_HEADER,
            body: JSON.stringify({ ownerEmail, propTitle, message, action, deadlineDays, propertyId, adminEmail: 'admin' })
        });
        const result = await res.json();
        document.getElementById('warningModal').style.display = 'none';

        if (result.success) {
            const msg = {
                none:        'ส่งข้อความแจ้งเตือนแล้ว',
                auto_days:   `ส่งแจ้งเตือนแล้ว ให้เวลา ${deadlineDays} วัน ก่อนระงับบัญชี`,
                suspend_now: 'ระงับบัญชีเจ้าของที่พักเรียบร้อยแล้ว'
            }[action] || 'ดำเนินการเรียบร้อย';
            await customAlert('สำเร็จ', msg, '✅');
            loadReports(); loadUsers();
        } else {
            await customAlert('เกิดข้อผิดพลาด', result.message, '❌');
        }
    } catch (err) {
        document.getElementById('warningModal').style.display = 'none';
        await customAlert('เกิดข้อผิดพลาด', 'ไม่สามารถเชื่อมต่อ Backend ได้', '❌');
    }
}

async function togglePropertyPublish(propertyId, currentState) {
    const newState = !currentState;
    const label = newState ? 'เผยแพร่' : 'ซ่อน';
    const ok = await customConfirm(`${label}ที่พัก`, `ต้องการ${label}ที่พักนี้ใช่หรือไม่?`, '⚠️');
    if (!ok) return;
    const res = await fetch(`${API_BASE}/admin/properties/${propertyId}/publish`, {
        method: 'PATCH', headers: ADMIN_HEADER,
        body: JSON.stringify({ isPublished: newState, adminEmail: 'admin' })
    });
    const result = await res.json();
    if (result.success) loadProperties();
    else await customAlert('เกิดข้อผิดพลาด', result.message, '❌');
}

async function adminDeleteProperty(propertyId) {
    const ok = await customConfirm('ลบที่พัก', 'ต้องการลบที่พักนี้ถาวรใช่หรือไม่? ไม่สามารถกู้คืนได้', '🗑️');
    if (!ok) return;
    const res = await fetch(`${API_BASE}/admin/properties/${propertyId}`, {
        method: 'DELETE', headers: ADMIN_HEADER, body: JSON.stringify({ adminEmail: 'admin' })
    });
    const result = await res.json();
    if (result.success) { loadProperties(); loadReports(); }
    else await customAlert('เกิดข้อผิดพลาด', result.message, '❌');
}

async function toggleUserBan(email, currentStatus) {
    if (currentStatus === 'BANNED') {
        // ปลดล็อก — simple confirm
        const ok = await customConfirm('ปลดล็อกผู้ใช้', `ต้องการปลดล็อกผู้ใช้ ${email} ใช่หรือไม่?`, '🔓');
        if (!ok) return;
        const res = await fetch(`${API_BASE}/admin/users/${encodeURIComponent(email)}/status`, {
            method: 'PATCH', headers: ADMIN_HEADER,
            body: JSON.stringify({ status: 'ACTIVE', adminEmail: 'admin' })
        });
        const result = await res.json();
        if (result.success) { loadUsers(); loadAppeals(); }
        else await customAlert('เกิดข้อผิดพลาด', result.message, '❌');
    } else {
        // ระงับ — เปิด Ban Reason Modal
        openBanModal(email);
    }
}

async function adminDeleteUser(email) {
    const ok = await customConfirm('ลบสมาชิก',
        `ต้องการลบ ${email} ออก?\nข้อมูลทั้งหมดจะถูกลบและไม่สามารถกู้คืนได้`, '🗑️');
    if (!ok) return;
    const res = await fetch(`${API_BASE}/admin/users/${encodeURIComponent(email)}`, {
        method: 'DELETE', headers: ADMIN_HEADER, body: JSON.stringify({ adminEmail: 'admin' })
    });
    const result = await res.json();
    if (result.success) { loadUsers(); loadProperties(); }
    else await customAlert('เกิดข้อผิดพลาด', result.message, '❌');
}

// ── เปลี่ยน Role (promote → ADMIN / demote → USER) ────────────────────
function changeUserRole(email, currentRole, displayName) {
    const isAdmin  = currentRole === 'ADMIN';
    const newRole  = isAdmin ? 'USER' : 'ADMIN';
    const title    = isAdmin ? '👤 ถอดสิทธิ์ Admin' : '🛡️ ตั้งเป็น Admin';
    const label    = isAdmin ? 'ถอดสิทธิ์ผู้ดูแลระบบ' : 'ให้สิทธิ์ผู้ดูแลระบบ';
    const iconColor = isAdmin ? '#374151' : '#5b21b6';
    const btnColor  = isAdmin ? '#6b7280' : '#5b21b6';

    // populate modal
    document.getElementById('roleModalTitle').innerText        = title;
    document.getElementById('roleModalUserName').innerText     = displayName;
    document.getElementById('roleModalUserEmail').innerText    = email;
    document.getElementById('roleModalCurrentBadge').innerHTML = isAdmin
        ? '<span class="usr-badge usr-badge-admin">🛡️ ADMIN</span>'
        : `<span class="usr-badge" style="background:#f3f4f6;color:#374151;">👤 ${currentRole}</span>`;
    document.getElementById('roleModalNewBadge').innerHTML = isAdmin
        ? '<span class="usr-badge" style="background:#f3f4f6;color:#374151;">👤 USER</span>'
        : '<span class="usr-badge usr-badge-admin">🛡️ ADMIN</span>';
    document.getElementById('roleModalDesc').innerText = isAdmin
        ? 'สมาชิกคนนี้จะสูญเสียสิทธิ์เข้าถึง Admin Panel ทันที'
        : 'สมาชิกคนนี้จะได้รับสิทธิ์เข้าถึง Admin Panel ทันที ใช้ด้วยความระมัดระวัง';
    const confirmBtn = document.getElementById('roleModalConfirmBtn');
    confirmBtn.innerText        = `✔ ยืนยัน${label}`;
    confirmBtn.style.background = btnColor;
    // ผูก data ไว้ที่ modal เพื่อใช้ตอน confirm
    confirmBtn.dataset.email   = email;
    confirmBtn.dataset.newRole = newRole;
    confirmBtn.dataset.name    = displayName;

    document.getElementById('roleChangeModal').style.display = 'flex';
}

async function confirmRoleChange() {
    const btn      = document.getElementById('roleModalConfirmBtn');
    const email    = btn.dataset.email;
    const newRole  = btn.dataset.newRole;
    const name     = btn.dataset.name;

    // ต้องการ firstName/lastName/phone ด้วยเพื่อ PATCH updateUser
    // ดึงข้อมูลปัจจุบันก่อน แล้ว PATCH เฉพาะ role
    try {
        const getRes = await fetch(`${API_BASE}/admin/users/${encodeURIComponent(email)}`, { headers: ADMIN_HEADER });
        const getResult = await getRes.json();
        if (!getResult.success) throw new Error(getResult.message);
        const u = getResult.data;

        const patchRes = await fetch(`${API_BASE}/admin/users/${encodeURIComponent(email)}`, {
            method: 'PATCH',
            headers: ADMIN_HEADER,
            body: JSON.stringify({
                firstName: u.firstName || '',
                lastName:  u.lastName  || '',
                phone:     u.phone     || '',
                role:      newRole,
                adminEmail: 'admin'
            })
        });
        const patchResult = await patchRes.json();

        document.getElementById('roleChangeModal').style.display = 'none';

        if (patchResult.success) {
            // ── อัปเดต localStorage ทันที ──────────────────────────────
            // เพื่อให้ header / navbar แสดงสิทธิ์ใหม่โดยไม่ต้อง refresh
            const profileKey = 'userProfile_' + email;
            const cached = JSON.parse(localStorage.getItem(profileKey) || 'null');
            if (cached) {
                cached.role = newRole;
                localStorage.setItem(profileKey, JSON.stringify(cached));
            }

            // ถ้า user ที่ถูกเปลี่ยนสิทธิ์คือคนที่ login อยู่ในเบราว์เซอร์นี้
            // → เรียก updateHeaderState เพื่อ re-render navbar ทันที
            const activeUser = localStorage.getItem('activeUser');
            if (activeUser === email && typeof updateHeaderState === 'function') {
                updateHeaderState();
            }

            const actionLabel = newRole === 'ADMIN' ? 'ได้รับสิทธิ์ Admin แล้ว' : 'ถูกถอดสิทธิ์ Admin แล้ว';
            await customAlert('สำเร็จ', `${name} ${actionLabel}`, '✅');
            loadUsers();
        } else {
            await customAlert('เกิดข้อผิดพลาด', patchResult.message, '❌');
        }
    } catch(err) {
        document.getElementById('roleChangeModal').style.display = 'none';
        await customAlert('เกิดข้อผิดพลาด', 'ไม่สามารถเชื่อมต่อ Backend ได้: ' + err.message, '❌');
    }
}

function closeModal(id) { document.getElementById(id).style.display = 'none'; }

// ------------------------------------------------------------------
//  PROPERTIES: search/filter + detail modal
// ------------------------------------------------------------------
let allPropertiesData = [];
let propertiesPage = 1;
let propertiesFiltered = [];

async function loadProperties() {
    const tbody = document.querySelector('#table-properties tbody');
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:20px;color:#888;">กำลังโหลด...</td></tr>';
    try {
        const res = await fetch(`${API_BASE}/admin/properties`, { headers: ADMIN_HEADER });
        const result = await res.json();
        allPropertiesData = result.success ? result.data : [];
        propertiesPage = 1;
        propertiesFiltered = allPropertiesData;
        renderPropertiesTable(propertiesFiltered);
    } catch (err) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:red;padding:20px;">เกิดข้อผิดพลาด</td></tr>';
    }
}

function filterProperties() {
    const kw     = (document.getElementById('propSearch').value || '').toLowerCase();
    const type   = document.getElementById('propTypeFilter').value;
    const status = document.getElementById('propStatusFilter').value;
    propertiesFiltered = allPropertiesData.filter(p => {
        const matchKw     = !kw || (p.title||'').toLowerCase().includes(kw) || (p.ownerEmail||'').toLowerCase().includes(kw);
        const matchType   = !type   || p.propertyType === type;
        const matchStatus = status === '' || String(p.isPublished) === status;
        return matchKw && matchType && matchStatus;
    });
    propertiesPage = 1;
    renderPropertiesTable(propertiesFiltered);
}

function goPropertiesPage(page) {
    propertiesPage = page;
    renderPropertiesTable(propertiesFiltered);
    document.querySelector('#tab-properties').scrollTop = 0;
}

function renderPropertiesTable(data) {
    const tbody = document.querySelector('#table-properties tbody');
    tbody.innerHTML = '';
    if (!data.length) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:#888;padding:30px;">ไม่พบข้อมูลที่พัก</td></tr>';
        document.getElementById('pagination-properties').innerHTML = '';
        return;
    }
    const TYPE_LABEL = { DORMITORY:'หอพัก', APARTMENT:'อพาร์ตเมนต์', HOUSE:'บ้านเช่า', CONDO:'คอนโด' };
    const start = (propertiesPage - 1) * PAGE_SIZE;
    const slice = data.slice(start, start + PAGE_SIZE);
    slice.forEach(p => {
        const badge = p.isPublished
            ? '<span class="prop-badge prop-badge-pub">✔ เผยแพร่</span>'
            : '<span class="prop-badge prop-badge-hid">✖ ซ่อนไว้</span>';
        const toggleBtn = p.isPublished
            ? `<button class="prop-btn prop-btn-hide" onclick="togglePropertyPublish(${p.propertyId},${p.isPublished})">🙈 ซ่อน</button>`
            : `<button class="prop-btn prop-btn-pub"  onclick="togglePropertyPublish(${p.propertyId},${p.isPublished})">📢 เผยแพร่</button>`;
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="white-space:nowrap;color:#888;font-size:13px;">#${p.propertyId}</td>
            <td>
                <div style="font-weight:600;line-height:1.4;">${p.title||'ไม่มีชื่อ'}</div>
                <div style="font-size:12px;color:#888;margin-top:2px;">👤 ${p.ownerEmail}</div>
            </td>
            <td>
                <span style="font-size:13px;color:#555;">${TYPE_LABEL[p.propertyType]||p.propertyType}</span>
            </td>
            <td class="prop-action-cell">
                ${badge}
                <div class="prop-btn-group">
                    <button class="prop-btn prop-btn-edit" onclick="window.location.href='edit-property.html?id=${p.propertyId}&from=admin'">✏️ แก้ไข</button>
                    <a class="prop-btn prop-btn-view" href="view-property.html?id=${p.propertyId}" target="_blank">👁 ดู</a>
                    ${toggleBtn}
                    <button class="prop-btn prop-btn-del" onclick="adminDeleteProperty(${p.propertyId})">🗑 ลบ</button>
                </div>
            </td>`;
        tbody.appendChild(tr);
    });
    // แถวว่างเพื่อให้ตารางสูงคงที่
    renderPagination('pagination-properties', data.length, propertiesPage, 'goPropertiesPage');
}

let currentPropertyId = null;

async function openPropertyDetail(propertyId) {
    currentPropertyId = propertyId;
    document.getElementById('pdImageGrid').innerHTML = '<p style="color:#888;">กำลังโหลด...</p>';
    document.getElementById('propertyDetailModal').style.display = 'flex';

    try {
        const res = await fetch(`${API_BASE}/admin/properties/${propertyId}`, { headers: ADMIN_HEADER });
        const result = await res.json();
        if (!result.success) { await customAlert('เกิดข้อผิดพลาด', result.message, '❌'); return; }
        const p = result.data;

        document.getElementById('pdTitle').innerText    = `แก้ไขที่พัก: ${p.title||''}`;
        document.getElementById('pdEditTitle').value    = p.title||'';
        document.getElementById('pdEditPublish').value  = p.isPublished ? '1' : '0';
        document.getElementById('pdOwner').innerText    = p.ownerEmail||'-';
        document.getElementById('pdProvince').innerText = p.province||'-';
        document.getElementById('pdPrice').innerText    = p.priceMonthly > 0 ? `฿${Number(p.priceMonthly).toLocaleString()}` : '-';

        const grid = document.getElementById('pdImageGrid');
        grid.innerHTML = '';
        if (!p.images || p.images.length === 0) {
            grid.innerHTML = '<p style="color:#aaa;grid-column:1/-1;">ไม่มีรูปภาพ</p>';
        } else {
            p.images.forEach(img => {
                const cell = document.createElement('div');
                cell.className = 'img-cell';
                const image = document.createElement('img');
                image.src = img.imageUrl;
                image.onerror = () => { image.src = 'https://placehold.co/140x110/eee/999?text=Error'; };
                const delBtn = document.createElement('button');
                delBtn.className = 'img-del-btn';
                delBtn.innerText = '✕';
                delBtn.title = 'ลบรูปนี้';
                delBtn.onclick = () => adminDeleteImage(img.imageId, cell);
                cell.appendChild(image);
                cell.appendChild(delBtn);
                grid.appendChild(cell);
            });
        }
    } catch (err) {
        console.error(err);
        await customAlert('เกิดข้อผิดพลาด', 'ไม่สามารถโหลดข้อมูลได้', '❌');
    }
}

async function adminDeleteImage(imageId, cellEl) {
    const ok = await customConfirm('ลบรูปภาพ', 'ต้องการลบรูปภาพนี้ใช่หรือไม่?', '🗑️');
    if (!ok) return;
    const res = await fetch(`${API_BASE}/admin/images/${imageId}`, {
        method: 'DELETE', headers: ADMIN_HEADER, body: JSON.stringify({ adminEmail: 'admin' })
    });
    if ((await res.json()).success) cellEl.remove();
    else await customAlert('เกิดข้อผิดพลาด', 'ไม่สามารถลบรูปได้', '❌');
}

async function savePropertyAdmin() {
    const title      = document.getElementById('pdEditTitle').value.trim();
    const isPublished = document.getElementById('pdEditPublish').value === '1';
    if (!title) { await customAlert('ข้อมูลไม่ครบ', 'กรุณากรอกชื่อที่พัก', '⚠️'); return; }
    const res = await fetch(`${API_BASE}/admin/properties/${currentPropertyId}`, {
        method: 'PATCH', headers: ADMIN_HEADER,
        body: JSON.stringify({ title, isPublished, adminEmail: 'admin' })
    });
    const result = await res.json();
    if (result.success) {
        await customAlert('สำเร็จ', 'บันทึกการแก้ไขแล้ว', '✅');
        closeModal('propertyDetailModal');
        loadProperties();
    } else { await customAlert('เกิดข้อผิดพลาด', result.message, '❌'); }
}

// ------------------------------------------------------------------
//  USERS: search/filter + edit modal
// ------------------------------------------------------------------
let allUsersData = [];
let usersPage = 1;
let usersFiltered = [];

async function loadUsers() {
    const tbody = document.querySelector('#table-users tbody');
    tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;padding:20px;color:#888;">กำลังโหลด...</td></tr>';
    try {
        const res = await fetch(`${API_BASE}/admin/users`, { headers: ADMIN_HEADER });
        const result = await res.json();
        allUsersData = result.success ? result.data : [];
        usersPage = 1;
        usersFiltered = allUsersData;
        renderUsersTable(usersFiltered);
    } catch (err) {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;color:red;padding:20px;">เกิดข้อผิดพลาด</td></tr>';
    }
}

function filterUsers() {
    const kw = (document.getElementById('userSearch').value || '').toLowerCase();
    const roleFilter = document.getElementById('userRoleFilter').value;
    const statusFilter = document.getElementById('userStatusFilter').value;
    usersFiltered = allUsersData.filter(u => {
        const matchKw = !kw ||
            (u.firstName||'').toLowerCase().includes(kw) ||
            (u.lastName||'').toLowerCase().includes(kw)  ||
            (u.email||'').toLowerCase().includes(kw);
        const matchRole = !roleFilter || u.role === roleFilter;
        const matchStatus = !statusFilter || u.status === statusFilter;
        return matchKw && matchRole && matchStatus;
    });
    usersPage = 1;
    renderUsersTable(usersFiltered);
}

function goUsersPage(page) {
    usersPage = page;
    renderUsersTable(usersFiltered);
    document.querySelector('#tab-users').scrollTop = 0;
}

function renderUsersTable(data) {
    const tbody = document.querySelector('#table-users tbody');
    tbody.innerHTML = '';
    // กรองเฉพาะ system account 'admin' ออก (แต่แสดง ADMIN role users ที่เป็น real users)
    const filtered = data.filter(u => u.email !== 'admin');
    if (!filtered.length) {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;color:#888;padding:30px;">ไม่พบข้อมูลสมาชิก</td></tr>';
        document.getElementById('pagination-users').innerHTML = '';
        return;
    }
    const start = (usersPage - 1) * PAGE_SIZE;
    const slice = filtered.slice(start, start + PAGE_SIZE);
    slice.forEach(u => {
        const isBanned  = u.status === 'BANNED';
        const isAdmin   = u.role === 'ADMIN';
        const isOwner   = u.role === 'OWNER';
        const fullName  = `${u.firstName||''} ${u.lastName||''}`.trim() || 'ไม่ระบุ';

        // ── Role badge ──
        let roleBadge;
        if (isAdmin) {
            roleBadge = '<span class="usr-badge usr-badge-admin">🛡️ ADMIN</span>';
        } else if (isOwner) {
            roleBadge = '<span class="usr-badge" style="background:#fff7ed;color:#c2410c;">🏠 OWNER</span>';
        } else {
            roleBadge = '<span class="usr-badge" style="background:#f3f4f6;color:#374151;">👤 USER</span>';
        }

        // ── Status badge ──
        const statusBadge = isBanned
            ? `<span class="usr-badge" style="background:#fee2e2;color:#991b1b;cursor:help;" title="${(u.banReason||'').replace(/"/g,'&quot;')}">🚫 ระงับ</span>`
            : '<span class="usr-badge" style="background:#d1fae5;color:#065f46;">✔ ปกติ</span>';

        // ── Toggle ban ──
        const toggleBtn = isBanned
            ? `<button class="prop-btn prop-btn-pub"  onclick="toggleUserBan('${u.email}','${u.status}')">🔓 ปลดล็อก</button>`
            : `<button class="prop-btn prop-btn-hide" onclick="toggleUserBan('${u.email}','${u.status}')">🚫 ระงับ</button>`;

        // ── Role promotion/demotion ──
        const roleBtn = isAdmin
            ? `<button class="prop-btn prop-btn-demote" onclick="changeUserRole('${u.email}','${u.role}','${fullName.replace(/'/g,"\\'")}')">👤 ถอด Admin</button>`
            : `<button class="prop-btn prop-btn-promote" onclick="changeUserRole('${u.email}','${u.role}','${fullName.replace(/'/g,"\\'")}')">🛡️ ตั้ง Admin</button>`;

        const tr = document.createElement('tr');
        // เน้นแถว ADMIN ด้วยพื้นหลังอ่อน
        if (isAdmin) tr.style.background = '#f9f5ff';
        tr.innerHTML = `
            <td>
                <div style="font-weight:600;line-height:1.4;">${fullName}</div>
                <div style="font-size:12px;color:#888;margin-top:2px;">${u.email}</div>
            </td>
            <td>
                <div style="display:flex;flex-wrap:wrap;gap:5px;align-items:center;">
                    ${roleBadge}
                    ${statusBadge}
                </div>
            </td>
            <td class="prop-action-cell">
                <div class="prop-btn-group">
                    <button class="prop-btn prop-btn-view"
                        onclick="window.open('owner-profile.html?email=${encodeURIComponent(u.email)}','_blank')">👁 เรียกดู</button>
                    <button class="prop-btn prop-btn-edit"
                        onclick="window.location.href='admin-edit-user.html?email=${encodeURIComponent(u.email)}'">✏️ แก้ไข</button>
                    ${roleBtn}
                    ${toggleBtn}
                    <button class="prop-btn prop-btn-del"
                        onclick="adminDeleteUser('${u.email}')">🗑 ลบ</button>
                </div>
            </td>`;
        tbody.appendChild(tr);
    });
    renderPagination('pagination-users', filtered.length, usersPage, 'goUsersPage');
}

async function viewUserDetail(email) {
    document.getElementById('userDetailModal').style.display = 'flex';
    document.getElementById('udBody').innerHTML = '<div style="text-align:center;padding:40px;color:#888;">กำลังโหลด...</div>';

    try {
        const res = await fetch(`${API_BASE}/admin/users/${encodeURIComponent(email)}`, { headers: ADMIN_HEADER });
        const result = await res.json();
        if (!result.success) {
            document.getElementById('udBody').innerHTML = `<div style="text-align:center;color:red;padding:30px;">เกิดข้อผิดพลาด: ${result.message}</div>`;
            return;
        }
        const u = result.data;
        const fullName  = `${u.firstName||''} ${u.lastName||''}`.trim() || 'ไม่ระบุ';
        const createdAt = u.createdAt ? new Date(u.createdAt).toLocaleDateString('th-TH', { year:'numeric', month:'long', day:'numeric' }) : '-';
        const suspendAt = u.suspendAt ? new Date(u.suspendAt).toLocaleDateString('th-TH', { year:'numeric', month:'long', day:'numeric' }) : null;

        const statusBadge = u.status === 'BANNED'
            ? '<span style="background:#e53e3e;color:#fff;padding:3px 12px;border-radius:20px;font-size:12px;font-weight:700;">ถูกระงับ</span>'
            : u.status === 'INACTIVE'
                ? '<span style="background:#a0aec0;color:#fff;padding:3px 12px;border-radius:20px;font-size:12px;font-weight:700;">ไม่ใช้งาน</span>'
                : '<span style="background:#48bb78;color:#fff;padding:3px 12px;border-radius:20px;font-size:12px;font-weight:700;">ปกติ</span>';
        const roleBadge = u.role === 'OWNER'
            ? '<span style="background:#ed8936;color:#fff;padding:3px 12px;border-radius:20px;font-size:12px;font-weight:700;">OWNER</span>'
            : '<span style="background:#718096;color:#fff;padding:3px 12px;border-radius:20px;font-size:12px;font-weight:700;">USER</span>';

        const avatarHtml = u.profileImage
            ? `<img src="${u.profileImage}" alt="profile" style="width:80px;height:80px;border-radius:50%;object-fit:cover;border:3px solid #dcd3c6;">`
            : `<div style="width:80px;height:80px;border-radius:50%;background:#e8e4df;display:flex;align-items:center;justify-content:center;font-size:36px;border:3px solid #dcd3c6;">👤</div>`;

        document.getElementById('udBody').innerHTML = `
            <div style="display:flex;gap:20px;align-items:flex-start;flex-wrap:wrap;">
                <!-- Avatar -->
                <div style="display:flex;flex-direction:column;align-items:center;gap:8px;min-width:100px;">
                    ${avatarHtml}
                    <div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:center;">
                        ${roleBadge}
                        ${statusBadge}
                    </div>
                </div>

                <!-- ข้อมูลหลัก -->
                <div style="flex:1;min-width:220px;">
                    <div style="font-size:20px;font-weight:700;color:#2d2d2d;margin-bottom:12px;">${fullName}</div>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px 20px;font-size:14px;">
                        <div>
                            <div style="color:#888;font-size:11px;margin-bottom:2px;">📧 อีเมล</div>
                            <div style="font-weight:600;word-break:break-all;">${u.email}</div>
                        </div>
                        <div>
                            <div style="color:#888;font-size:11px;margin-bottom:2px;">📞 เบอร์โทร</div>
                            <div style="font-weight:600;${u.phone ? '' : 'color:#aaa;'}">${u.phone || 'ไม่ได้ระบุ'}</div>
                        </div>
                        <div>
                            <div style="color:#888;font-size:11px;margin-bottom:2px;">💬 LINE ID</div>
                            <div style="font-weight:600;${u.lineId ? '' : 'color:#aaa;'}">${u.lineId || 'ไม่ได้ระบุ'}</div>
                        </div>
                        <div>
                            <div style="color:#888;font-size:11px;margin-bottom:2px;">📘 Facebook</div>
                            <div style="font-weight:600;${u.facebook ? '' : 'color:#aaa;'}">${u.facebook || 'ไม่ได้ระบุ'}</div>
                        </div>
                        <div>
                            <div style="color:#888;font-size:11px;margin-bottom:2px;">📅 วันที่สมัคร</div>
                            <div style="font-weight:600;">${createdAt}</div>
                        </div>
                        ${suspendAt ? `
                        <div>
                            <div style="color:#888;font-size:11px;margin-bottom:2px;">🚫 วันที่ถูกระงับ</div>
                            <div style="font-weight:600;color:#e53e3e;">${suspendAt}</div>
                        </div>` : ''}
                        ${u.banReason ? `
                        <div style="grid-column:1/-1;">
                            <div style="color:#888;font-size:11px;margin-bottom:2px;">📝 เหตุผลการระงับ:</div>
                            <div style="font-weight:600;color:#e53e3e;font-size:13px;line-height:1.4;">${u.banReason}</div>
                        </div>` : ''}
                    </div>
                </div>
            </div>

            <!-- ปุ่มดำเนินการ -->
            <div style="display:flex;gap:10px;margin-top:20px;padding-top:16px;border-top:1px solid #ece8e1;flex-wrap:wrap;">
                <button class="action-btn btn-warn" style="flex:1;min-width:120px;padding:9px;"
                        onclick="closeModal('userDetailModal'); window.location.href='admin-edit-user.html?email=${encodeURIComponent(email)}'">
                    ✏️ แก้ไขข้อมูล
                </button>
                <button class="action-btn ${u.status === 'BANNED' ? 'btn-active' : 'btn-suspend'}" style="flex:1;min-width:120px;padding:9px;"
                        onclick="closeModal('userDetailModal'); toggleUserBan('${email}','${u.status}')">
                    ${u.status === 'BANNED' ? '🔓 ปลดล็อก' : '🚫 ระงับบัญชี'}
                </button>
                <button class="action-btn btn-del" style="flex:1;min-width:100px;padding:9px;"
                        onclick="closeModal('userDetailModal'); adminDeleteUser('${email}')">
                    🗑️ ลบสมาชิก
                </button>
            </div>`;
    } catch (err) {
        document.getElementById('udBody').innerHTML = '<div style="text-align:center;color:red;padding:30px;">ไม่สามารถโหลดข้อมูลได้</div>';
    }
}

function openEditUser(email, firstName, lastName, phone, role) {
    document.getElementById('euEmail').value        = email;
    document.getElementById('euEmailDisplay').innerText = email;
    document.getElementById('euFirstName').value    = firstName;
    document.getElementById('euLastName').value     = lastName;
    document.getElementById('euPhone').value        = phone;
    document.getElementById('euRole').value         = role;
    document.getElementById('editUserModal').style.display = 'flex';
}

async function saveUserAdmin() {
    const email     = document.getElementById('euEmail').value;
    const firstName = document.getElementById('euFirstName').value.trim();
    const lastName  = document.getElementById('euLastName').value.trim();
    const phone     = document.getElementById('euPhone').value.trim();
    const role      = document.getElementById('euRole').value;

    if (!firstName || !lastName) { await customAlert('ข้อมูลไม่ครบ', 'กรุณากรอกชื่อและนามสกุล', '⚠️'); return; }

    const res = await fetch(`${API_BASE}/admin/users/${encodeURIComponent(email)}`, {
        method: 'PATCH', headers: ADMIN_HEADER,
        body: JSON.stringify({ firstName, lastName, phone, role, adminEmail: 'admin' })
    });
    const result = await res.json();
    if (result.success) {
        await customAlert('สำเร็จ', 'บันทึกข้อมูลสมาชิกแล้ว', '✅');
        closeModal('editUserModal');
        loadUsers();
    } else { await customAlert('เกิดข้อผิดพลาด', result.message, '❌'); }
}

// ------------------------------------------------------------------
//  BAN WITH REASON — Modal flow
// ------------------------------------------------------------------

function openBanModal(email) {
    // ดึงข้อมูล user จาก allUsersData
    const u = allUsersData.find(x => x.email === email);
    const fullName = u ? `${u.firstName||''} ${u.lastName||''}`.trim() : email;
    document.getElementById('banModalEmail').value        = email;
    document.getElementById('banModalUserName').innerText  = fullName;
    document.getElementById('banModalUserEmail').innerText = email;
    document.getElementById('banReasonSelect').value        = '';
    document.getElementById('banReasonDetail').value       = '';
    document.getElementById('banReasonModal').style.display = 'flex';
}

async function confirmBanUser() {
    const email  = document.getElementById('banModalEmail').value;
    const reason = document.getElementById('banReasonSelect').value;
    const detail = document.getElementById('banReasonDetail').value.trim();

    if (!reason) {
        await customAlert('ข้อมูลไม่ครบ', 'กรุณาเลือกเหตุผลการระงับ', '⚠️');
        return;
    }

    // รวมเหตุผล + รายละเอียด
    const banReason = detail ? `${reason} — ${detail}` : reason;

    try {
        const res = await fetch(`${API_BASE}/admin/users/${encodeURIComponent(email)}/status`, {
            method: 'PATCH', headers: ADMIN_HEADER,
            body: JSON.stringify({ status: 'BANNED', banReason, adminEmail: 'admin' })
        });
        const result = await res.json();
        document.getElementById('banReasonModal').style.display = 'none';

        if (result.success) {
            await customAlert('สำเร็จ', `ระงับบัญชี ${email} เรียบร้อยแล้ว`, '✅');
            loadUsers();
            loadAppeals();
        } else {
            await customAlert('เกิดข้อผิดพลาด', result.message, '❌');
        }
    } catch (err) {
        document.getElementById('banReasonModal').style.display = 'none';
        await customAlert('เกิดข้อผิดพลาด', 'ไม่สามารถเชื่อมต่อ Backend ได้', '❌');
    }
}

// ------------------------------------------------------------------
//  APPEALS — คำร้องโต้แย้งการระงับบัญชี
// ------------------------------------------------------------------
let allAppealsData = [];
let appealsFiltered = [];

async function loadAppeals() {
    const tbody = document.querySelector('#table-appeals tbody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:30px;color:#888;">กำลังโหลด...</td></tr>';
    try {
        const res = await fetch(`${API_BASE}/admin/appeals`, { headers: ADMIN_HEADER });
        const result = await res.json();
        allAppealsData = result.success ? result.data : [];
        appealsFiltered = allAppealsData;
        appealsPage = 1;
        renderAppeals();
        updateAppealBadge();
    } catch (err) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:30px;color:red;">เกิดข้อผิดพลาด</td></tr>';
    }
}

function updateAppealBadge() {
    const pendingCount = allAppealsData.filter(a => a.status === 'PENDING').length;
    const badge = document.getElementById('appealBadge');
    if (badge) {
        badge.innerText = pendingCount;
        badge.style.display = pendingCount > 0 ? 'inline' : 'none';
    }
}

function filterAppeals() {
    const kw = (document.getElementById('appealSearch')?.value || '').toLowerCase();
    const statusFilter = document.getElementById('appealStatusFilter').value;
    appealsFiltered = allAppealsData.filter(a => {
        const matchKw = !kw ||
            (a.userEmail||'').toLowerCase().includes(kw) ||
            (a.firstName||'').toLowerCase().includes(kw) ||
            (a.lastName||'').toLowerCase().includes(kw);
        const matchStatus = !statusFilter || a.status === statusFilter;
        return matchKw && matchStatus;
    });
    appealsPage = 1;
    renderAppeals();
}

const APPEAL_STATUS_CONFIG = {
    PENDING:   { label: '⏳ รอตรวจสอบ',     bg: '#fff3cd', color: '#856404', border: '#ffc107' },
    APPROVED:  { label: '✅ อนุมัติ',         bg: '#d1fae5', color: '#065f46', border: '#10b981' },
    REJECTED:  { label: '❌ ปฏิเสธ',          bg: '#fee2e2', color: '#991b1b', border: '#ef4444' },
    REVIEWING: { label: '👁 กำลังตรวจสอบ',  bg: '#dbeafe', color: '#1e40af', border: '#3b82f6' }
};

let appealsPage = 1;

function goAppealsPage(page) {
    appealsPage = page;
    renderAppeals();
    document.querySelector('#tab-appeals').scrollTop = 0;
}

function renderAppeals() {
    const tbody = document.querySelector('#table-appeals tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (!appealsFiltered.length) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:30px;color:#888;">ไม่มีคำร้องโต้แย้ง 📭</td></tr>';
        document.getElementById('pagination-appeals').innerHTML = '';
        return;
    }

    const start = (appealsPage - 1) * PAGE_SIZE;
    const slice = appealsFiltered.slice(start, start + PAGE_SIZE);

    slice.forEach(a => {
        const sc       = APPEAL_STATUS_CONFIG[a.status] || { label: a.status, bg: '#eee', color: '#555', border: '#ccc' };
        const fullName = `${a.firstName||''} ${a.lastName||''}`.trim() || a.userEmail;
        const dateStr  = new Date(a.submittedAt).toLocaleDateString('th-TH', {
            year: 'numeric', month: 'short', day: 'numeric'
        });
        const timeStr  = new Date(a.submittedAt).toLocaleTimeString('th-TH', {
            hour: '2-digit', minute: '2-digit'
        });

        const banReason  = (a.banReason || 'ไม่ระบุ');
        const shortReason = banReason.length > 60 ? banReason.substring(0, 60) + '…' : banReason;

        const statusBadge = `<span class="prop-badge appeal-status-pill" style="background:${sc.bg};color:${sc.color};">${sc.label}</span>`;

        const actionBtns = a.status === 'PENDING' ? `
            <button class="prop-btn prop-btn-pub"  onclick="resolveAppealAction(${a.appealId},'APPROVED')">✅ อนุมัติ</button>
            <button class="prop-btn prop-btn-del"  onclick="resolveAppealAction(${a.appealId},'REJECTED')">❌ ปฏิเสธ</button>` : '';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>
                <div style="font-weight:600;line-height:1.4;">${fullName}</div>
                <div style="font-size:12px;color:#888;margin-top:2px;">${a.userEmail}</div>
            </td>
            <td style="font-size:13px;color:#555;max-width:260px;">
                <span title="${banReason.replace(/"/g,'&quot;')}">${shortReason}</span>
            </td>
            <td style="white-space:nowrap;font-size:13px;color:#666;">
                <div>${dateStr}</div>
                <div style="font-size:11px;color:#aaa;">${timeStr}</div>
            </td>
            <td class="appeal-action-cell">
                    ${statusBadge}
                    <button class="prop-btn prop-btn-view" onclick="viewAppealDetail(${a.appealId})">📋 ดูเต็ม</button>
                    ${actionBtns}
            </td>`;
        tbody.appendChild(tr);
    });

    renderPagination('pagination-appeals', appealsFiltered.length, appealsPage, 'goAppealsPage');
}

async function viewAppealDetail(appealId) {
    const a = allAppealsData.find(x => x.appealId === appealId);
    if (!a) return;

    const sc   = APPEAL_STATUS_CONFIG[a.status] || { label: a.status, bg: '#eee', color: '#555' };
    const fullName = `${a.firstName||''} ${a.lastName||''}`.trim() || a.userEmail;
    const submittedAt = new Date(a.submittedAt).toLocaleString('th-TH');
    const reviewedAt  = a.reviewedAt ? new Date(a.reviewedAt).toLocaleString('th-TH') : null;

    document.getElementById('appealDetailBody').innerHTML = `
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;flex-wrap:wrap;">
            <span style="background:${sc.bg};color:${sc.color};padding:4px 14px;border-radius:20px;font-size:13px;font-weight:600;">${sc.label}</span>
            <span style="font-size:12px;color:#888;">ส่งเมื่อ ${submittedAt}</span>
            ${reviewedAt ? `<span style="font-size:12px;color:#888;">| ตรวจสอบเมื่อ ${reviewedAt}</span>` : ''}
        </div>
        <div style="background:#faf8f5;border:1px solid #ece8e1;border-radius:8px;padding:14px 16px;margin-bottom:14px;">
            <div style="font-weight:700;font-size:15px;color:#333;margin-bottom:4px;">${fullName}</div>
            <div style="font-size:13px;color:#888;">${a.userEmail}</div>
        </div>
        <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:12px 16px;margin-bottom:14px;">
            <div style="font-size:12px;color:#991b1b;font-weight:600;margin-bottom:4px;">🚫 เหตุผลที่ถูกระงับบัญชี:</div>
            <div style="font-size:14px;color:#555;line-height:1.5;">${a.banReason || 'ไม่ระบุเหตุผล'}</div>
        </div>
        <div style="background:#f0f4f8;border:1px solid #d1d5db;border-radius:8px;padding:12px 16px;margin-bottom:14px;">
            <div style="font-size:12px;color:#3730a3;font-weight:600;margin-bottom:4px;">💬 คำร้องโต้แย้งจากผู้ใช้:</div>
            <div style="font-size:14px;color:#333;line-height:1.6;white-space:pre-wrap;">${a.appealMessage || ''}</div>
        </div>
        ${a.adminNote ? `
        <div style="background:#f5f0e6;border:1px solid #dcd3c6;border-radius:8px;padding:12px 16px;margin-bottom:14px;">
            <div style="font-size:12px;color:#8b7355;font-weight:600;margin-bottom:4px;">📝 หมายเหตุจาก Admin:</div>
            <div style="font-size:14px;color:#555;line-height:1.5;">${a.adminNote}</div>
        </div>` : ''}
        ${a.status === 'PENDING' ? `
            <div style="display:flex;gap:10px;margin-top:16px;">
                <button class="prop-btn prop-btn-pub" style="flex:1;padding:10px;font-size:14px;"
                    onclick="resolveAppealAction(${a.appealId},'APPROVED')">✅ อนุมัติ (ปลดล็อกบัญชี)</button>
                <button class="prop-btn prop-btn-del" style="flex:1;padding:10px;font-size:14px;"
                    onclick="resolveAppealAction(${a.appealId},'REJECTED')">❌ ปฏิเสธ</button>
            </div>
        ` : ''}`;
    document.getElementById('appealDetailModal').style.display = 'flex';
}

async function resolveAppealAction(appealId, action) {
    const actionLabel = action === 'APPROVED' ? 'อนุมัติและปลดล็อกบัญชี' : 'ปฏิเสธคำร้อง';
    const icon        = action === 'APPROVED' ? '✅' : '❌';
    const ok = await customConfirm(`ยืนยัน${actionLabel}`, `คุณต้องการ${actionLabel}ใช่หรือไม่?`, icon);
    if (!ok) return;

    try {
        const res = await fetch(`${API_BASE}/admin/appeals/${appealId}`, {
            method: 'PATCH', headers: ADMIN_HEADER,
            body: JSON.stringify({ action, adminEmail: 'admin' })
        });
        const result = await res.json();
        if (result.success) {
            await customAlert('สำเร็จ', `${actionLabel}เรียบร้อยแล้ว`, '✅');
            document.getElementById('appealDetailModal').style.display = 'none';
            loadAppeals();
            loadUsers();
        } else {
            await customAlert('เกิดข้อผิดพลาด', result.message, '❌');
        }
    } catch (err) {
        await customAlert('เกิดข้อผิดพลาด', 'ไม่สามารถเชื่อมต่อ Backend ได้', '❌');
    }
}
