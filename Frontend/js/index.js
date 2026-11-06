// ==========================================
// ระบบ Custom Popup (Alert & Confirm)
// ==========================================

// Thai collator สำหรับเรียงลำดับตามหลักพจนานุกรมราชบัณฑิตยสถาน
const thaiCollator = new Intl.Collator('th', { sensitivity: 'base', usage: 'sort' });
function customAlert(title, message, icon='ℹ️') {
    return new Promise(resolve => {
        document.getElementById('popupIcon').innerText = icon;
        document.getElementById('popupTitle').innerText = title;
        document.getElementById('popupMessage').innerText = message;
        const btns = document.getElementById('popupButtons');
        btns.innerHTML = `<button class="btn-popup btn-popup-primary" id="popupOkBtn">ตกลง</button>`;
        document.getElementById('customPopup').style.display = 'flex';
        document.getElementById('popupOkBtn').onclick = () => {
            document.getElementById('customPopup').style.display = 'none';
            resolve();
        };
    });
}

function customConfirm(title, message, icon='❓') {
    return new Promise(resolve => {
        document.getElementById('popupIcon').innerText = icon;
        document.getElementById('popupTitle').innerText = title;
        document.getElementById('popupMessage').innerText = message;
        const btns = document.getElementById('popupButtons');
        btns.innerHTML = `
            <button class="btn-popup btn-popup-cancel" id="popupCancelBtn">ยกเลิก</button>
            <button class="btn-popup btn-popup-danger" id="popupConfirmBtn">ยืนยัน</button>
        `;
        document.getElementById('customPopup').style.display = 'flex';
        document.getElementById('popupCancelBtn').onclick = () => { document.getElementById('customPopup').style.display = 'none'; resolve(false); };
        document.getElementById('popupConfirmBtn').onclick = () => { document.getElementById('customPopup').style.display = 'none'; resolve(true); };
    });
}

// ==========================================
// ฟังก์ชันเริ่มต้น
// ==========================================
var API_BASE = 'http://localhost:5000/api';

// เช็ค login ก่อนไปหน้าแชท
function requireLoginForChat(e, url) {
    e.preventDefault();
    e.stopPropagation();
    const activeUser = localStorage.getItem('activeUser');
    if (!activeUser) {
        customAlert('กรุณาเข้าสู่ระบบ', 'ต้องเข้าสู่ระบบก่อนถึงจะทักแชทได้ 💬', '🔒')
            .then(() => {
                if (window.openLogin) window.openLogin();
            });
    } else {
        window.location.href = url;
    }
}

let allPropertiesFromDB = [];    // ข้อมูลดิบจาก API ทั้งหมด
let filteredPropertiesList = [];  // ข้อมูลหลังกรอง
let currentPage = 1;
const itemsPerPage = 8;

// map propertyId → { monthly:{min,max}, daily:{min,max}, ... }
let _groupPriceMap = {};

// ── คำนวณช่วงราคาจากกลุ่ม ────────────────────────────
async function buildGroupPriceMap() {
    try {
        // ดึง priceMap จาก backend ที่คำนวณมาให้แล้ว ครอบคลุมทุก owner
        const res    = await fetch(`${API_BASE}/groups/all-grouped`);
        const result = await res.json();
        if (!result.success) return;
        _groupPriceMap = result.priceMap || {};
    } catch (_) {}
}

function fmtPriceRange(range) {
    if (!range) return null;
    const { min, max, unit } = range;
    if (!min) return null;
    const minStr = Number(min).toLocaleString();
    const maxStr = Number(max).toLocaleString();
    return min === max ? `฿${minStr}${unit}` : `฿${minStr} – ${maxStr}${unit}`;
}

function getPriceDisplay(prop, rentType) {
    const r = _groupPriceMap[prop.propertyId];

    if (rentType === 'monthly') {
        return fmtPriceRange(r?.monthly)
            || (prop.priceMonthly > 0 ? `${Number(prop.priceMonthly).toLocaleString()} ฿/เดือน` : null);
    } else if (rentType === 'daily') {
        return fmtPriceRange(r?.daily)
            || (prop.priceDaily > 0 ? `${Number(prop.priceDaily).toLocaleString()} ฿/วัน` : null);
    } else if (rentType === 'yearly') {
        return fmtPriceRange(r?.yearly)
            || (prop.priceYearly > 0 ? `${Number(prop.priceYearly).toLocaleString()} ฿/ปี` : null);
    } else if (rentType === 'term') {
        return fmtPriceRange(r?.semester)
            || (prop.priceSemester > 0 ? `${Number(prop.priceSemester).toLocaleString()} ฿/เทอม` : null);
    } else {
        // tab 'all' — ลำดับ: monthly > daily > semester > yearly
        return fmtPriceRange(r?.monthly   || r?.daily || r?.semester || r?.yearly)
            || (prop.priceMonthly  > 0 ? `${Number(prop.priceMonthly).toLocaleString()} ฿/เดือน` : null)
            || (prop.priceDaily    > 0 ? `${Number(prop.priceDaily).toLocaleString()} ฿/วัน`     : null)
            || (prop.priceSemester > 0 ? `${Number(prop.priceSemester).toLocaleString()} ฿/เทอม` : null)
            || (prop.priceYearly   > 0 ? `${Number(prop.priceYearly).toLocaleString()} ฿/ปี`    : null)
            || 'ไม่ระบุราคา';
    }
}

window.onload = async function() {
    await _indexPageInit();
}

// แยก init ออกมาเป็นฟังก์ชันอิสระ เพื่อให้เรียกได้โดยตรง
async function _indexPageInit() {
    if (window._indexInitDone) return;
    window._indexInitDone = true;

    const activeUser = localStorage.getItem("activeUser");
    if (activeUser) {
        setTimeout(() => {
            if (activeUser === 'admin') {
                if (typeof updateHeaderForAdmin === 'function') updateHeaderForAdmin();
            } else {
                if (typeof updateHeaderForLoggedInUser === 'function') updateHeaderForLoggedInUser(activeUser);
                checkAutoSuspend(activeUser);
            }
        }, 500);
    }

    try {
        await loadAllPublishedProperties();
    } catch(e) {
        console.error('[index] loadAllPublishedProperties error:', e);
    }

    if (activeUser) {
        try { await loadFavCache(); } catch(e) {}
        updateFavBadge();
        renderPropertiesGrid();
    }

    const urlParams = new URLSearchParams(window.location.search);
    const action = urlParams.get('action');
    if (action === 'login')    { setTimeout(() => { if (window.openLogin) openLogin(); }, 800); }
    if (action === 'register') { setTimeout(() => { if (window.openRegister) openRegister(); }, 800); }
    if (action) history.replaceState(null, '', window.location.pathname);

    if (urlParams.has('keyword') || urlParams.has('type') || urlParams.has('province') ||
        urlParams.has('minPrice') || urlParams.has('roomFacs') || urlParams.has('bldgFacs')) {
        _applyFilterFromURL(urlParams);
    }
}

// ── Robust init: รัน _indexPageInit ทันทีที่ script parse เสร็จ ──
// ไม่รอ window.onload เพราะมี race กับ shared-header.js
(function() {
    function tryInit() {
        if (document.getElementById('allPropertiesGrid')) {
            _indexPageInit();
        } else {
            // DOM ยังไม่พร้อม รอสักครู่
            setTimeout(tryInit, 30);
        }
    }
    // ใช้ setTimeout(0) เพื่อให้ script อื่นๆ parse เสร็จก่อน
    setTimeout(tryInit, 0);
})();

async function checkAutoSuspend(email) {
    const profile = JSON.parse(localStorage.getItem("userProfile_" + email));
    if (profile && profile.status === 'BANNED') {
        const reason = profile.banReason || 'บัญชีของคุณถูกระงับการใช้งานตามคำสั่งของ Admin';
        if (window.showBannedAppealModal) {
            window.showBannedAppealModal(email, reason);
        } else {
            _inlineBannedModal(email, reason);
        }
        localStorage.removeItem("activeUser");
    }
}

// Fallback: สร้าง Banned Appeal Modal แบบ inline (ใช้เมื่อ shared-header.js ยังไม่โหลดเวอร์ชั่นใหม่)
function _inlineBannedModal(email, banReason) {
    // ปิด auth modal ก่อน
    if (typeof closeAuthModal === 'function') closeAuthModal();

    // ลบ modal เก่าถ้ามี
    const old = document.getElementById('bannedAppealModal');
    if (old) old.remove();

    const wrapper = document.createElement('div');
    wrapper.innerHTML = `
<div class="modal-overlay" id="bannedAppealModal" style="display:flex;">
  <div class="modal-content" style="max-width:480px;">
    <div class="modal-header">
      <h2 class="modal-title" style="color:#dc3545;">🚫 บัญชีถูกระงับการใช้งาน</h2>
      <span class="close-modal-btn" onclick="document.getElementById('bannedAppealModal').remove()">&times;</span>
    </div>
    <input type="hidden" id="bannedEmail" value="${email}">
    <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:14px 16px;margin-bottom:16px;">
      <div style="font-size:15px;color:#991b1b;font-weight:600;margin-bottom:8px;">⚠️ บัญชีของคุณถูกระงับการใช้งาน</div>
      <div style="font-size:13px;color:#666;margin-bottom:6px;">เหตุผลที่ถูกระงับ:</div>
      <div id="bannedReasonDisplay" style="font-size:14px;color:#333;background:#fff;border:1px solid #e0d6d0;border-radius:6px;padding:10px 12px;line-height:1.5;">${banReason}</div>
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
      <button onclick="document.getElementById('bannedAppealModal').remove()" style="flex:1;padding:10px;border:1px solid #ccc;border-radius:6px;background:#f3f4f6;color:#374151;font-weight:600;cursor:pointer;font-size:14px;">ตกลง</button>
      <button onclick="_inlineSubmitAppeal()" style="flex:1;padding:10px;border:none;border-radius:6px;background:#2b7bb9;color:#fff;font-weight:600;cursor:pointer;font-size:14px;">📤 ส่งคำร้องขอปลดแบน</button>
    </div>
  </div>
</div>`;
    document.body.appendChild(wrapper);
}

// Fallback: ส่งคำร้องแบบ inline (ใช้เมื่อ shared-header.js ยังไม่โหลดเวอร์ชั่นใหม่)
async function _inlineSubmitAppeal() {
    const email   = document.getElementById('bannedEmail').value;
    const message = (document.getElementById('appealReason').value || '').trim();
    if (!message) {
        return customAlert('ข้อมูลไม่ครบ', 'กรุณากรอกข้อความคำร้อง', '⚠️');
    }
    try {
        const res = await fetch(`${API_URL}/auth/appeal`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, appealMessage: message })
        });
        const result = await res.json();
        if (result.success) {
            document.getElementById('bannedAppealModal')?.remove();
            await customAlert('ส่งคำร้องสำเร็จ', 'ส่งคำร้องสำเร็จ กรุณารอการตรวจสอบจาก Admin', '✅');
        } else {
            await customAlert('เกิดข้อผิดพลาด', result.message || 'ไม่สามารถส่งคำร้องได้', '❌');
        }
    } catch (err) {
        await customAlert('เกิดข้อผิดพลาด', 'ไม่สามารถเชื่อมต่อ Backend ได้', '❌');
    }
}

// ==========================================
// ค้นหาที่พัก
// ==========================================
let currentRentSearchType = 'all';
function setRentTab(el, type) { document.querySelectorAll(".search-tab").forEach(t => t.classList.remove("active")); el.classList.add("active"); currentRentSearchType = type; _isFavMode = false; applyFilters(); }

// แยก 2 input ให้เป็นอิสระต่อกัน — ไม่ sync กันแล้ว
function syncSearchAndExecute(val) { applyFilters(); }

// ── Autocomplete ──────────────────────────────────────────────────
const TYPE_LABEL_AC = { DORMITORY:'หอพัก', APARTMENT:'อพาร์ตเมนต์', HOUSE:'บ้านเช่า', CONDO:'คอนโด' };
let selectedSugIndex = -1;

function onSearchInput(val) {
    applyFilters();
    const box = document.getElementById('searchSuggestions');
    const keyword = val.trim().toLowerCase();
    selectedSugIndex = -1;

    if (!keyword || keyword.length < 1) { box.style.display = 'none'; return; }

    const matches = allPropertiesFromDB.filter(p =>
        (p.title||'').toLowerCase().includes(keyword) ||
        (p.province||'').toLowerCase().includes(keyword) ||
        (p.district||'').toLowerCase().includes(keyword)
    ).slice(0, 8);

    if (matches.length === 0) { box.style.display = 'none'; return; }

    box.innerHTML = '';
    matches.forEach((p, i) => {
        const item = document.createElement('div');
        item.className = 'suggestion-item';
        item.dataset.index = i;
        const loc = [p.province, p.district].filter(Boolean).join(', ');
        item.innerHTML = `
            <span class="sug-icon">🏠</span>
            <span class="sug-body">
                <span class="sug-title">${p.title || 'ไม่มีชื่อ'}</span>
                <span class="sug-sub">${loc || ''}</span>
            </span>`;
        item.onmousedown = (e) => {
            e.preventDefault(); // ป้องกัน blur ก่อนคลิก
            document.getElementById('searchInput').value = p.title;
            box.style.display = 'none';
            applyFilters();
        };
        box.appendChild(item);
    });
    box.style.display = 'block';
}

function onSearchKeydown(e) {
    const box = document.getElementById('searchSuggestions');
    if (box.style.display === 'none') return;
    const items = box.querySelectorAll('.suggestion-item');
    if (e.key === 'ArrowDown') {
        e.preventDefault();
        selectedSugIndex = Math.min(selectedSugIndex + 1, items.length - 1);
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        selectedSugIndex = Math.max(selectedSugIndex - 1, -1);
    } else if (e.key === 'Enter') {
        if (selectedSugIndex >= 0) {
            e.preventDefault();
            items[selectedSugIndex].onmousedown(e);
        } else { box.style.display = 'none'; }
        return;
    } else if (e.key === 'Escape') {
        box.style.display = 'none'; return;
    }
    items.forEach((it, i) => it.classList.toggle('active', i === selectedSugIndex));
    if (selectedSugIndex >= 0) items[selectedSugIndex].scrollIntoView({ block: 'nearest' });
}

// ปิด suggestion เมื่อ click นอก
document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-input-group') && !e.target.closest('.top-search-container')) {
        const box = document.getElementById('searchSuggestions');
        const topBox = document.getElementById('topSearchSuggestions');
        if (box) box.style.display = 'none';
        if (topBox) topBox.style.display = 'none';
    }
});

// ── Top Search Autocomplete ───────────────────────────────────────
let topSugIndex = -1;

function onTopSearchInput(val) {
    applyFilters();
    const box = document.getElementById('topSearchSuggestions');
    const keyword = val.trim().toLowerCase();
    topSugIndex = -1;

    if (!keyword) { box.style.display = 'none'; return; }

    // รวม unique suggestions จากชื่อที่พัก + จังหวัด + อำเภอ
    const seen = new Set();
    const items = [];

    allPropertiesFromDB.forEach(p => {
        // match ชื่อที่พัก
        if ((p.title||'').toLowerCase().includes(keyword) && !seen.has('p:' + p.title)) {
            seen.add('p:' + p.title);
            items.push({ icon: '🏠', label: p.title, sub: [p.province, p.district].filter(Boolean).join(', '), type: 'property', value: p.title });
        }
        // match จังหวัด
        if ((p.province||'').toLowerCase().includes(keyword) && !seen.has('pv:' + p.province)) {
            seen.add('pv:' + p.province);
            items.push({ icon: '📍', label: p.province, sub: 'จังหวัด', type: 'location', value: p.province });
        }
    });

    const limited = items.slice(0, 10);
    if (limited.length === 0) { box.style.display = 'none'; return; }

    box.innerHTML = '';
    limited.forEach((item, i) => {
        const div = document.createElement('div');
        div.className = 'suggestion-item';
        div.dataset.index = i;
        div.innerHTML = `
            <span class="sug-icon">${item.icon}</span>
            <span class="sug-body">
                <span class="sug-title">${item.label}</span>
                <span class="sug-sub">${item.sub}</span>
            </span>`;
        div.onmousedown = (e) => {
            e.preventDefault();
            document.getElementById('topSearchInput').value = item.value;
            box.style.display = 'none';
            applyFilters();
            // เลื่อนหน้าไปที่ผลลัพธ์
            const section = document.querySelector('.container');
            if (section) window.scrollTo({ top: section.offsetTop - 80, behavior: 'smooth' });
        };
        box.appendChild(div);
    });
    box.style.display = 'block';
}

function onTopSearchKeydown(e) {
    const box = document.getElementById('topSearchSuggestions');
    if (box.style.display === 'none') return;
    const items = box.querySelectorAll('.suggestion-item');
    if (e.key === 'ArrowDown') {
        e.preventDefault();
        topSugIndex = Math.min(topSugIndex + 1, items.length - 1);
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        topSugIndex = Math.max(topSugIndex - 1, -1);
    } else if (e.key === 'Enter') {
        if (topSugIndex >= 0) { e.preventDefault(); items[topSugIndex].onmousedown(e); }
        else { box.style.display = 'none'; }
        return;
    } else if (e.key === 'Escape') {
        box.style.display = 'none'; return;
    }
    items.forEach((it, i) => it.classList.toggle('active', i === topSugIndex));
    if (topSugIndex >= 0) items[topSugIndex].scrollIntoView({ block: 'nearest' });
}
function togglePrice(e) { e.stopPropagation(); const dropdown = document.getElementById('priceDropdown'); dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block'; }
function updateText() { const min = document.getElementById('minPrice').value; const max = document.getElementById('maxPrice').value; document.getElementById('priceText').innerText = (min||max) ? `฿${min||0} - ฿${max||"∞"}` : "ทุกช่วงราคา"; }
function clearMin() { document.getElementById('minPrice').value = ''; updateText(); applyFilters(); }
function clearMax() { document.getElementById('maxPrice').value = ''; updateText(); applyFilters(); }
function selectMin(val) { document.getElementById('minPrice').value = val; updateText(); applyFilters(); }
function selectMax(val) { document.getElementById('maxPrice').value = val; updateText(); applyFilters(); }

document.addEventListener('click', function(e) { if(!e.target.closest('.price-box')) { const pd = document.getElementById('priceDropdown'); if(pd) pd.style.display = 'none'; } if (!e.target.closest(".dropdown")) document.querySelectorAll(".dropdown-menu").forEach(m => m.style.display = "none"); });
function toggleDropdown(id) { document.querySelectorAll(".dropdown-menu").forEach(m => m.style.display = "none"); const el = document.getElementById(id); if(el) el.style.display = "block"; }

// ดึง facilities สำหรับทุก property (fallback กรณี API เก่าไม่ส่งมา)
async function enrichFacilities() {
    await Promise.all(allPropertiesFromDB.map(async p => {
        try {
            const res = await fetch(`${API_BASE}/properties/${p.propertyId}`);
            const r = await res.json();
            if (r.success) {
                p.roomFacility     = r.data.roomFacility     || null;
                p.buildingFacility = r.data.buildingFacility || null;
            }
        } catch (_) {}
    }));
}

// โหลดจาก API ครั้งเดียว แล้ว filter บน client
async function loadAllPublishedProperties() {
    try {
        const res = await fetch(`${API_BASE}/properties`);
        const result = await res.json();
        if (result.success) {
            allPropertiesFromDB = result.data;
            const needsFacilities = allPropertiesFromDB.length > 0 &&
                allPropertiesFromDB[0].buildingFacility === undefined &&
                allPropertiesFromDB[0].roomFacility === undefined;
            if (needsFacilities) {
                await enrichFacilities();
            }
            // สร้าง price range map จาก /all-grouped (ทำงานสำหรับทุก user รวมถึง guest)
            await buildGroupPriceMap();
        } else {
            allPropertiesFromDB = [];
            console.error('API error:', result.message);
        }
    } catch (err) {
        allPropertiesFromDB = [];
        console.error('Cannot connect to backend:', err);
        document.getElementById("allPropertiesGrid").innerHTML =
            `<div class="empty-state"><h3>ไม่สามารถเชื่อมต่อ Backend ได้</h3><p>กรุณาตรวจสอบว่ารัน <code>node server.js</code> อยู่</p></div>`;
        document.getElementById("paginationControls").innerHTML = "";
        return;
    }
    applyFilters();
}

function executeSearch() { _isFavMode = false; applyFilters(); }

// TYPE_MAP: DB ENUM -> frontend key (for filter matching)
const DB_TYPE_MAP = { 'DORMITORY': 'room', 'APARTMENT': 'apartment', 'HOUSE': 'house', 'CONDO': 'condo' };

function applyFilters(overrideTitle) {
    // อ่านจากทั้ง 2 ช่อง แยกจากกัน — ใช้ตัวที่มีค่า
    const heroVal = (document.getElementById("searchInput")?.value || '').toLowerCase().trim();
    const topVal  = (document.getElementById("topSearchInput")?.value || '').toLowerCase().trim();
    const keyword = heroVal || topVal;   // ใช้ค่าที่มีก่อน (ไม่ sync กัน)

    const propType = document.getElementById("propTypeSearch")?.value || 'all';
    const minP     = parseInt(document.getElementById("minPrice")?.value) || 0;
    const maxP     = parseInt(document.getElementById("maxPrice")?.value) || Infinity;
    const rentType = currentRentSearchType;

    let list = allPropertiesFromDB.filter(prop => {
        // -- ประเภท --
        if (propType !== 'all') {
            const frontendType = DB_TYPE_MAP[prop.propertyType] || '';
            if (frontendType !== propType) return false;
        }

        // -- คำค้นหา --
        if (keyword) {
            const text = `${prop.title||''} ${prop.province||''} ${prop.district||''} ${prop.addressDetail||''}`.toLowerCase();
            if (!text.includes(keyword)) return false;
        }

        // -- ราคา --
        let price = 0;
        if (rentType === 'monthly')      price = parseFloat(prop.priceMonthly)  || 0;
        else if (rentType === 'daily')   price = parseFloat(prop.priceDaily)    || 0;
        else if (rentType === 'yearly')  price = parseFloat(prop.priceYearly)   || 0;
        else if (rentType === 'term')    price = parseFloat(prop.priceSemester) || 0;
        else if (rentType === 'all') {
            // แสดงทุกที่พักที่มีราคาอย่างน้อยหนึ่งประเภท
            price = parseFloat(prop.priceMonthly) || parseFloat(prop.priceDaily) ||
                    parseFloat(prop.priceYearly)  || parseFloat(prop.priceSemester) || 0;
        }

        // ตัดที่พักที่ไม่มีราคาเลยออก
        if (price === 0) return false;
        if ((minP > 0 || maxP < Infinity) && (price < minP || price > maxP)) return false;

        return true;
    });

    filteredPropertiesList = list;
    currentPage = 1;
    const titleEl = document.querySelector(".section-title");
    if (overrideTitle) { if (titleEl) titleEl.innerText = overrideTitle; }
    else { if (titleEl) titleEl.innerText = '🏠 ประกาศที่พักล่าสุด'; }
    renderPropertiesGrid();
}

function renderPropertiesGrid() {
    const container = document.getElementById("allPropertiesGrid");
    container.innerHTML = "";
    if (filteredPropertiesList.length === 0) {
        container.innerHTML = `<div class="empty-state"><h3>ไม่พบที่พักที่ตรงกับเงื่อนไข</h3></div>`;
        document.getElementById("paginationControls").innerHTML = "";
        return;
    }

    const startIndex = (currentPage - 1) * itemsPerPage;
    const itemsToShow = filteredPropertiesList.slice(startIndex, startIndex + itemsPerPage);

    // TYPE ENUM -> ป้ายชื่อภาษาไทย
    const typeLabels = { 'DORMITORY': 'หอพัก/ห้องเช่า', 'APARTMENT': 'อพาร์ตเมนต์', 'HOUSE': 'บ้านเช่า', 'CONDO': 'คอนโด' };

    itemsToShow.forEach(prop => {
        const fallbackImg = 'https://placehold.co/400x300/e6f0ff/2b7bb9?text=No+Photo';
        const coverImg = prop.coverImage ? prop.coverImage : fallbackImg;
        const typeName = typeLabels[prop.propertyType] || 'ไม่ระบุประเภท';

        // ราคา — ใช้ช่วงราคาจากกลุ่ม (ถ้ามี) หรือราคาเดียวปกติ
        const displayPrice = getPriceDisplay(prop, currentRentSearchType) || 'ไม่ระบุราคา';

        const locationText = prop.province ? `จ.${prop.province}` : 'ไม่ระบุตำแหน่ง';

        const isFav = checkIsFav(prop.propertyId, prop.ownerEmail);
        const safeTitle = (prop.title || '').replace(/'/g, "\\'");

        const card = document.createElement("div");
        card.className = "property-card";
        // คลิกกล่องไปยังหน้ารายละเอียด (ยกเว้นปุ่มต่างๆ)
        card.onclick = (e) => {
            if (!e.target.closest('button') && !e.target.closest('a')) {
                window.location.href = `view-property.html?id=${prop.propertyId}`;
            }
        };
        const activeUser = localStorage.getItem("activeUser");
        const isOwner = activeUser && activeUser === prop.ownerEmail;

        card.innerHTML = `
            <div class="card-image-wrap">
                <img src="${coverImg}" class="card-image" alt="${prop.title || ''}"
                     onerror="this.onerror=null;this.src='${fallbackImg}';">
                ${!isOwner ? `
                <button class="btn-fav-overlay ${isFav ? 'active' : ''}"
                        onclick="event.stopPropagation();toggleFavorite(${prop.propertyId},'${prop.ownerEmail}','${safeTitle}')"
                        title="บันทึกรายการโปรด">
                    ${isFav ? '❤️' : '🤍'}
                </button>
                <button class="btn-report-overlay"
                        onclick="event.stopPropagation();openReportModal(${prop.propertyId},'${prop.ownerEmail}','${safeTitle}')"
                        title="รายงานปัญหา">🚩</button>
                ` : `<div style="position:absolute;top:8px;left:8px;background:rgba(139,115,85,0.85);color:white;border-radius:6px;padding:3px 10px;font-size:11px;font-weight:600;">📌 โพสของคุณ</div>`}
            </div>
            <div class="card-content">
                <h3 class="card-title">${prop.title || 'ไม่มีชื่อที่พัก'}</h3>
                <div class="card-info">🏷️ ${typeName}</div>
                <div class="card-info">📍 ${locationText}</div>
                <div class="card-price">${displayPrice}</div>
            </div>
            <div class="card-actions">
                ${isOwner
                    ? `<a href="edit-property.html?id=${prop.propertyId}" class="btn-chat-card" style="background:#f5f0e6;color:#8b7355;"
                          onclick="event.stopPropagation()">✏️ แก้ไขโพส</a>`
                    : `<a href="chat.html?user=${prop.ownerEmail}&propertyId=${prop.propertyId}" class="btn-chat-card"
                          onclick="event.stopPropagation(); requireLoginForChat(event, 'chat.html?user=${prop.ownerEmail}&propertyId=${prop.propertyId}'); return false;">💬 ทักแชทเจ้าของ</a>`
                }
            </div>
        `;
        container.appendChild(card);
    });
    renderPaginationControls();
}

function renderPaginationControls() {
    const pagContainer = document.getElementById("paginationControls");
    pagContainer.innerHTML = "";
    const totalPages = Math.ceil(filteredPropertiesList.length / itemsPerPage);
    
    if (totalPages === 0) return;

    const btnPrev = document.createElement("button");
    btnPrev.className = "page-btn"; btnPrev.innerText = "« ก่อนหน้า"; btnPrev.disabled = currentPage === 1;
    btnPrev.onclick = () => { if(currentPage > 1) { currentPage--; renderPropertiesGrid(); window.scrollTo(0, document.querySelector('.main-search-wrapper').offsetTop); } };
    pagContainer.appendChild(btnPrev);

    for (let i = 1; i <= totalPages; i++) {
        const btnPage = document.createElement("button");
        btnPage.className = `page-btn ${i === currentPage ? 'active' : ''}`; btnPage.innerText = i;
        btnPage.onclick = () => { currentPage = i; renderPropertiesGrid(); window.scrollTo(0, document.querySelector('.main-search-wrapper').offsetTop); };
        pagContainer.appendChild(btnPage);
    }

    const btnNext = document.createElement("button");
    btnNext.className = "page-btn"; btnNext.innerText = "ถัดไป »"; btnNext.disabled = currentPage === totalPages;
    btnNext.onclick = () => { if(currentPage < totalPages) { currentPage++; renderPropertiesGrid(); window.scrollTo(0, document.querySelector('.main-search-wrapper').offsetTop); } };
    pagContainer.appendChild(btnNext);
}

// ==========================================
// ระบบรายงานปัญหา
// ==========================================
async function openReportModal(propId, ownerEmail, propName) {
    if (!localStorage.getItem("activeUser")) {
        await customAlert("ข้อผิดพลาด", "กรุณาเข้าสู่ระบบก่อนทำการรายงานที่พัก", "🔒");
        openLogin();
        return;
    }
    document.getElementById("repPropId").value = propId;
    document.getElementById("repOwnerEmail").value = ownerEmail;
    document.getElementById("repPropName").value = propName;
    document.getElementById("repPropNameDisplay").innerText = propName;
    
    document.getElementById("reportForm").reset();
    document.getElementById("reportReasonOtherText").style.display = "none";
    document.getElementById("reportModal").style.display = "flex";
}

// ── listener นี้ต้องรอ DOM ready เพื่อกัน crash ──
document.addEventListener('DOMContentLoaded', function() {
    const otherCb = document.getElementById('reportReasonOtherCb');
    if (otherCb) {
        otherCb.addEventListener('change', function() {
            const txt = document.getElementById('reportReasonOtherText');
            if (txt) txt.style.display = this.checked ? 'block' : 'none';
        });
    }
});

async function submitReport(e) {
    e.preventDefault();
    const activeUser = localStorage.getItem("activeUser");
    const checkboxes = document.querySelectorAll('input[name="reportReason"]:checked');
    let reasons = Array.from(checkboxes).map(cb => cb.value);
    
    const otherCb = document.getElementById('reportReasonOtherCb');
    if(otherCb.checked) {
        const otherText = document.getElementById('reportReasonOtherText').value.trim();
        if(otherText !== "") reasons.push("อื่นๆ: " + otherText);
    }

    if(reasons.length === 0) {
        await customAlert("ข้อมูลไม่ครบ", "กรุณาเลือกสาเหตุการรายงานอย่างน้อย 1 ข้อ", "⚠️");
        return;
    }

    const propertyId = document.getElementById("repPropId").value;

    try {
        const res = await fetch('http://localhost:5000/api/reports', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                reporterEmail: activeUser,
                propertyId:    parseInt(propertyId),
                reasons:       reasons
            })
        });

        const ct = res.headers.get('content-type');
        if (!ct || !ct.includes('application/json')) {
            await customAlert("ข้อผิดพลาด", `Server ตอบผิดรูปแบบ (${res.status})`, "❌");
            return;
        }

        const result = await res.json();
        if (result.success) {
            document.getElementById("reportModal").style.display = "none";
            await customAlert("สำเร็จ", "ขอบคุณครับ! ระบบส่งรายงานไปให้แอดมินพิจารณาแล้ว", "✅");
        } else {
            await customAlert("ข้อผิดพลาด", result.message || "ไม่สามารถส่งรายงานได้", "❌");
        }
    } catch (err) {
        console.error("submitReport error:", err);
        await customAlert("ข้อผิดพลาด", "ไม่สามารถเชื่อมต่อ Backend ได้", "❌");
    }
}

// ==========================================
// ระบบ Login & Register (เชื่อมต่อ Backend API)
// ==========================================
const API_URL = 'http://localhost:5000/api';

async function registerUser(event) {
    if (window.__isSharedHeader && window._shRegisterUser) return window._shRegisterUser(event);
    event.preventDefault();
    const firstName   = document.getElementById("regFirstName").value.trim();
    const lastName    = document.getElementById("regLastName").value.trim();
    const email       = document.getElementById("regEmail").value.trim();
    const pass        = document.getElementById("regPass").value;
    const confirmPass = document.getElementById("regConfirmPass").value;
    const phone       = document.getElementById("regPhone").value.trim();
    const termsChecked = document.getElementById("regTerms").checked;

    if (!firstName || !lastName || !email || !pass) {
        return customAlert("ข้อผิดพลาด", "กรุณากรอกข้อมูลที่มีเครื่องหมาย * ให้ครบถ้วน", "⚠️");
    }
    if (pass !== confirmPass) {
        return customAlert("ข้อผิดพลาด", "รหัสผ่านไม่ตรงกัน!", "❌");
    }
    if (!termsChecked) {
        return customAlert("ข้อผิดพลาด", "กรุณากดยอมรับเงื่อนไขก่อน", "⚠️");
    }

    try {
        const response = await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ firstName, lastName, email, password: pass, phone })
        });
        const result = await response.json();

        if (result.success) {
            await customAlert("สำเร็จ", "สมัครสมาชิกสำเร็จ! กรุณาเข้าสู่ระบบ", "✅");
            // กรอก email ให้อัตโนมัติในฟอร์ม login
            document.getElementById("loginEmail").value = email;
            switchAuthTab('loginTab');
        } else {
            await customAlert("ข้อผิดพลาด", result.message || "ไม่สามารถสมัครสมาชิกได้", "❌");
        }
    } catch (err) {
        console.error("Register error:", err);
        await customAlert("ข้อผิดพลาด", "ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ กรุณาตรวจสอบว่ารัน Backend อยู่", "❌");
    }
}

async function loginUser(event) {
    // ถ้าถูกโหลดผ่าน shared-header ให้ใช้ version ของ shared-header แทน
    if (window.__isSharedHeader && window._shLoginUser) return window._shLoginUser(event);
    if (event) event.preventDefault();
    const email = document.getElementById("loginEmail").value.trim();
    const pass  = document.getElementById("loginPass").value;

    // Admin shortcut (ตรวจ role จาก DB แทน hardcode)
    if (email === 'admin') {
        try {
            const response = await fetch(`${API_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password: pass })
            });
            const result = await response.json();
            if (result.success && result.user.role === 'ADMIN') {
                localStorage.setItem('activeUser', 'admin');
                localStorage.setItem('userProfile_admin', JSON.stringify({ email: 'admin', fullName: 'ผู้ดูแลระบบ', role: 'ADMIN' }));
                closeAuthModal();
                // อยู่หน้าเดิม ไม่ redirect — updateHeaderState จะจัดการ header
                updateHeaderForAdmin();
            } else if (result.banned) {
                // Admin ก็โดนแบนได้ → ส่งไป appeal modal
                if (window.showBannedAppealModal) {
                    window.showBannedAppealModal(email, result.banReason || 'ไม่ระบุเหตุผล');
                }
            } else {
                await customAlert('ข้อผิดพลาด', 'รหัสผ่าน Admin ไม่ถูกต้อง', '❌');
            }
        } catch (err) {
            await customAlert('ข้อผิดพลาด', 'ไม่สามารถเชื่อมต่อ Backend ได้', '❌');
        }
        return;
    }

    if (!email || !pass) {
        return customAlert("ข้อผิดพลาด", "กรุณากรอกอีเมลและรหัสผ่าน", "⚠️");
    }

    try {
        const response = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password: pass })
        });
        const result = await response.json();

        if (result.success) {
            const user = result.user;
            // เก็บข้อมูล user ลง localStorage เหมือนเดิม เพื่อให้หน้าอื่นๆ ยังทำงานได้
            localStorage.setItem("activeUser", user.email);
            localStorage.setItem("userProfile_" + user.email, JSON.stringify({
                email: user.email,
                fullName: user.fullName,
                firstName: user.firstName,
                lastName: user.lastName,
                phone: user.phone,
                role: user.role,
                profileImage: user.profileImage
            }));

            await customAlert("สำเร็จ", `ยินดีต้อนรับ คุณ${user.fullName}!`, "✅");
            closeAuthModal();
            updateHeaderForLoggedInUser(user.email);
            // โหลด favorites จาก DB และ re-render หัวใจ
            if (typeof loadFavCache === 'function') await loadFavCache();
            if (typeof updateFavBadge === 'function') updateFavBadge();
            if (typeof renderPropertiesGrid === 'function') renderPropertiesGrid();
        } else if (result.banned) {
            // บัญชีถูกระงับ → ส่งไป Banned Appeal Modal (มี textarea + ปุ่มส่งคำร้อง)
            // ส่ง email ไปด้วยเพื่อให้ฟอร์มส่งคำร้องได้
            if (window.showBannedAppealModal) {
                window.showBannedAppealModal(email, result.banReason || result.message || 'ไม่ระบุเหตุผล');
            } else {
                // Fallback: สร้าง modal inline ถ้า shared-header.js ยังไม่โหลดเวอร์ชั่นใหม่
                _inlineBannedModal(email, result.banReason || result.message || 'ไม่ระบุเหตุผล');
            }
        } else {
            await customAlert("ข้อผิดพลาด", result.message || "เข้าสู่ระบบไม่สำเร็จ", "❌");
        }
    } catch (err) {
        console.error("Login error:", err);
        await customAlert("ข้อผิดพลาด", "ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ กรุณาตรวจสอบว่ารัน Backend อยู่", "❌");
    }
}

function quickLogin(email, pass) {
    document.getElementById("loginEmail").value = email;
    document.getElementById("loginPass").value = pass;
    loginUser(null);
}
function updateHeaderForLoggedInUser(email) {
    const guestMenu = document.getElementById("guestMenu");
    const userMenu  = document.getElementById("userMenu");
    if (guestMenu) guestMenu.style.display = "none";
    if (userMenu)  userMenu.style.display  = "flex";
    const profile = JSON.parse(localStorage.getItem("userProfile_" + email) || 'null');
    const nameEl  = document.getElementById("displayUserEmail");
    if (nameEl) nameEl.innerText = profile ? profile.fullName : email;
    if (typeof updateChatBadge === 'function') updateChatBadge();
}

function updateHeaderForAdmin() {
    const guestMenu = document.getElementById("guestMenu");
    const userMenu  = document.getElementById("userMenu");
    if (guestMenu) guestMenu.style.display = "none";
    if (userMenu)  userMenu.style.display  = "flex";

    const nameEl = document.getElementById("displayUserEmail");
    if (nameEl) nameEl.innerText = "ผู้ดูแลระบบ";

    // ซ่อน favorites + chat icon
    const favLink  = document.querySelector('#userMenu a[onclick*="shFavClick"], #userMenu a[onclick*="favClick"]');
    const chatLink = document.querySelector('#userMenu a[href="chat.html"]');
    const favBadge = document.getElementById("favCountBadge");
    if (favLink)  favLink.style.display  = "none";
    if (chatLink) chatLink.style.display = "none";
    if (favBadge) favBadge.style.display = "none";

    // เปลี่ยน dropdown เป็นเมนู admin
    const menu = document.getElementById("userProfileMenu");
    if (menu) {
        menu.innerHTML = `
            <div style="padding:12px 16px 10px;border-bottom:1px solid #f0ece6;">
                <div style="font-size:11px;color:#aaa;margin-bottom:3px;text-transform:uppercase;letter-spacing:0.5px;">ผู้ดูแลระบบ</div>
                <div style="font-size:15px;font-weight:700;color:#4a3f35;">ผู้ดูแลระบบ</div>
            </div>
            <div class="ddmenu-item" onclick="window.location.href='admin.html'"
                 style="color:#8b7355;font-weight:600;">
                <span class="ddmenu-icon">⚙️</span> Admin Panel
            </div>
            <div style="border-top:1px solid #f0ece6;margin:4px 0;"></div>
            <div class="ddmenu-item ddmenu-danger" onclick="logoutUser()">
                <span class="ddmenu-icon">🚪</span> ออกจากระบบ
            </div>`;
    } else {
        // retry ถ้า header ยังไม่ inject
        setTimeout(updateHeaderForAdmin, 500);
    }
}

async function logoutUser() {
    // ถ้าถูกโหลดผ่าน shared-header ให้ใช้ version ของ shared-header แทน
    if (window.__isSharedHeader && window._shLogoutUser) return window._shLogoutUser();
    const isConfirm = await customConfirm("ยืนยันการออกจากระบบ", "คุณต้องการออกจากระบบใช่หรือไม่?", "🚪");
    if (isConfirm) {
        localStorage.removeItem("activeUser");
        favCache = new Set();
        favCacheLoaded = false;
        if (typeof updateFavBadge === 'function') updateFavBadge();
        if (typeof renderPropertiesGrid === 'function') renderPropertiesGrid();
        window.location.reload();
    }
}

async function checkLoginBeforePost() {
    if (localStorage.getItem("activeUser")) window.location.href = "add-property.html"; 
    else { await customAlert("แจ้งเตือน", "กรุณาเข้าสู่ระบบก่อนลงประกาศครับ", "🔒"); openLogin(); }
}

function openLogin() { document.getElementById("authModal").style.display = "flex"; switchAuthTab('loginTab'); }
function openRegister() { document.getElementById("authModal").style.display = "flex"; switchAuthTab('registerTab'); }
function closeAuthModal() { document.getElementById("authModal").style.display = "none"; }
function switchAuthTab(tabName) { document.querySelectorAll(".form-container").forEach(f => f.style.display = "none"); document.querySelectorAll(".auth-tab-btn").forEach(t => t.classList.remove("active")); document.getElementById(tabName).style.display = "block"; document.getElementById(tabName === 'loginTab' ? 'btn-login' : 'btn-register').classList.add("active"); }
function togglePassword(id) { let el = document.getElementById(id); el.type = el.type === "password" ? "text" : "password"; }
function updateChatBadge() {
    const activeUser = localStorage.getItem("activeUser");
    if (!activeUser) return;
    fetch(`http://localhost:5000/api/chat/unread?email=${encodeURIComponent(activeUser)}`)
        .then(r => r.json())
        .then(result => {
            const badge = document.getElementById("unreadBadge");
            if (!badge) return;
            const count = result.success ? result.count : 0;
            badge.innerText = count;
            badge.style.display = count > 0 ? "block" : "none";
        })
        .catch(() => {});
}

// ==========================================
// ระบบรายการโปรด (Favorites) — ต่อ DB
// ==========================================
const FAV_API = 'http://localhost:5000/api/favorites';

// cache favorites ใน memory เพื่อไม่ต้อง fetch ทุกครั้ง
let favCache = new Set(); // Set of propertyId (number)
let favCacheLoaded = false;

async function loadFavCache() {
    const activeUser = localStorage.getItem("activeUser");
    if (!activeUser) { favCache = new Set(); favCacheLoaded = true; return; }
    try {
        const res = await fetch(`${FAV_API}?email=${encodeURIComponent(activeUser)}`);
        const result = await res.json();
        if (result.success) {
            favCache = new Set(result.data.map(f => Number(f.propertyId)));
        }
    } catch (e) { console.error('loadFavCache error:', e); }
    favCacheLoaded = true;
}

function checkIsFav(propertyId) {
    return favCache.has(Number(propertyId));
}

async function toggleFavorite(propertyId, ownerEmail, title) {
    const activeUser = localStorage.getItem("activeUser");
    if (activeUser === 'admin') return; // admin ไม่สามารถกดถูกใจได้
    if (!activeUser) {
        await customAlert("แจ้งเตือน", "กรุณาเข้าสู่ระบบก่อนบันทึกรายการโปรด", "🔒");
        openLogin();
        return;
    }

    const pid = Number(propertyId);
    const isFav = favCache.has(pid);

    try {
        if (isFav) {
            // ลบออก
            await fetch(FAV_API, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: activeUser, propertyId: pid })
            });
            favCache.delete(pid);
        } else {
            // เพิ่ม
            await fetch(FAV_API, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: activeUser, propertyId: pid })
            });
            favCache.add(pid);
        }
        updateFavBadge();
        renderPropertiesGrid(); // รีเฟรชสีหัวใจ
    } catch (err) {
        console.error('toggleFavorite error:', err);
    }
}

function updateFavBadge() {
    const badge = document.getElementById("favCountBadge");
    if (badge) {
        badge.innerText = favCache.size;
        badge.style.display = favCache.size > 0 ? "block" : "none";
    }
}

async function showFavorites() {
    const activeUser = localStorage.getItem("activeUser");
    if (!activeUser) { customAlert("รายการโปรด", "กรุณาเข้าสู่ระบบก่อนครับ", "🔒"); return; }

    if (favCache.size === 0) {
        customAlert("รายการโปรด", "คุณยังไม่มีรายการที่บันทึกไว้", "❤️");
        return;
    }

    filteredPropertiesList = allPropertiesFromDB.filter(p =>
        favCache.has(Number(p.propertyId))
    );
    document.querySelector(".section-title").innerText = "❤️ รายการโปรดของคุณ";
    currentPage = 1;
    renderPropertiesGrid();
    window.scrollTo({ top: document.querySelector('.container').offsetTop - 50, behavior: 'smooth' });
}

let _isFavMode = false;
function toggleFavorites() {
    if (_isFavMode) {
        // กลับหน้าปกติ
        _isFavMode = false;
        applyFilters();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
        // ไปหน้า favorites
        const activeUser = localStorage.getItem("activeUser");
        if (!activeUser) { customAlert("รายการโปรด", "กรุณาเข้าสู่ระบบก่อนครับ", "🔒"); return; }
        if (favCache.size === 0) { customAlert("รายการโปรด", "คุณยังไม่มีรายการที่บันทึกไว้", "❤️"); return; }
        _isFavMode = true;
        filteredPropertiesList = allPropertiesFromDB.filter(p => favCache.has(Number(p.propertyId)));
        document.querySelector(".section-title").innerText = "❤️ รายการโปรดของคุณ";
        currentPage = 1;
        renderPropertiesGrid();
        window.scrollTo({ top: document.querySelector('.main-search-wrapper')?.offsetTop || 0, behavior: 'smooth' });
    }
}

document.addEventListener("DOMContentLoaded", function() { updateFavBadge(); });
// ==========================================
// ฟังก์ชันจัดการ Popup (Modal) ค้นหา
// ==========================================
function openFilterModal() {
    const m = document.getElementById('filterSearchModal');
    if (m) { m.style.display = 'flex'; }
    document.getElementById('searchMenu')?.classList.remove('show');
}
function closeFilterModal() {
    const m = document.getElementById('filterSearchModal');
    if (m) m.style.display = 'none';
}

let indexSearchMap = null;
window.openMapModal = function openMapModal() {
    const modal = document.getElementById('mapSearchModal');
    if (!modal) return;
    modal.style.display = 'flex';
    document.getElementById('searchMenu')?.classList.remove('show');

    const iframe = document.getElementById('mapViewIframe');
    if (!iframe) return;

    // ตั้ง allow="geolocation" ทุกครั้ง
    iframe.setAttribute('allow', 'geolocation');

    if (!iframe.getAttribute('data-loaded')) {
        // โหลดครั้งแรก — รอ 1 frame ให้ modal layout เสร็จก่อนตั้ง src
        // เพื่อให้ iframe มีขนาดจริงก่อน Leaflet init + geolocation ทำงาน
        requestAnimationFrame(() => {
            iframe.setAttribute('data-loaded', '1');
            iframe.src = 'map-view.html';
        });
    } else {
        // เปิดซ้ำ — รอ layout เสร็จก่อนส่ง reopen เพื่อให้ invalidateSize ได้ขนาดถูก
        requestAnimationFrame(() => {
            setTimeout(() => {
                try {
                    iframe.contentWindow?.postMessage({ type: 'reopen' }, '*');
                } catch(e) {}
            }, 50);
        });
    }
}
function closeMapModal() { document.getElementById('mapSearchModal').style.display = 'none'; }

// ── Geolocation สำหรับ index map modal — ดึงตำแหน่ง + ปักหมุด + setView ──
let _indexUserMarker = null;

function _initIndexMapGeolocation() {
    if (!navigator.geolocation || !indexSearchMap?.map) return;

    const isSecure = location.protocol === 'https:' ||
                     location.hostname === 'localhost' ||
                     location.hostname === '127.0.0.1';
    if (!isSecure) return;

    navigator.geolocation.getCurrentPosition(
        (pos) => {
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;
            const map = indexSearchMap.map;

            // setView ไปยังตำแหน่งผู้ใช้ zoom 13 แล้ว invalidateSize ทันที
            map.setView([lat, lng], 13, { animate: true });
            map.invalidateSize();
            setTimeout(() => map.invalidateSize(), 200);
            setTimeout(() => map.invalidateSize(), 600);

            // ลบ marker เดิม (ถ้ามี) แล้วปักหมุดใหม่
            if (_indexUserMarker) { map.removeLayer(_indexUserMarker); _indexUserMarker = null; }

            const userIcon = L.divIcon({
                className: '',
                html: `<div style="position:relative;width:30px;height:30px;">
                           <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);
                                       width:14px;height:14px;background:#2196f3;border:3px solid #fff;
                                       border-radius:50%;box-shadow:0 2px 6px rgba(33,150,243,.5);z-index:2;"></div>
                           <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);
                                       width:30px;height:30px;border-radius:50%;
                                       background:rgba(33,150,243,.2);
                                       animation:_idxPulse 2s ease-out infinite;"></div>
                       </div>`,
                iconSize:   [30, 30],
                iconAnchor: [15, 15],
            });

            // inject keyframes ครั้งเดียว
            if (!document.getElementById('_idxPulseStyle')) {
                const s = document.createElement('style');
                s.id = '_idxPulseStyle';
                s.textContent = '@keyframes _idxPulse{0%{transform:translate(-50%,-50%) scale(.5);opacity:.8}100%{transform:translate(-50%,-50%) scale(1.6);opacity:0}}';
                document.head.appendChild(s);
            }

            _indexUserMarker = L.marker([lat, lng], { icon: userIcon, zIndexOffset: 1000 })
                .addTo(map)
                .bindPopup('<div style="font-family:Prompt,sans-serif;font-size:13px;font-weight:600;color:#2196f3;">📍 ตำแหน่งของคุณ</div>',
                           { offset: [0, -10] });

            console.log('[IndexMap] Geolocation success:', lat, lng);
        },
        (err) => {
            console.warn('[IndexMap] Geolocation error:', err.code, err.message);
        },
        {
            enableHighAccuracy: true,   // รองรับทั้ง Desktop (Network/IP) และ Mobile (GPS)
            timeout:            10000,
            maximumAge:         0,
        }
    );
}

// ==========================================
// ฟังก์ชัน: ค้นหาจากแผนที่ + Filter
// ==========================================
function onMapProvinceChange() {
    const pName   = document.getElementById('mapProvince').value;
    const distSel = document.getElementById('mapDistrict');
    const subSel  = document.getElementById('mapSubdistrict');

    distSel.innerHTML = '<option value="">ทุกอำเภอ</option>';
    subSel.innerHTML  = '<option value="">ทุกตำบล</option>';
    distSel.disabled  = true;
    subSel.disabled   = true;

    if (pName) {
        const prov = indexGeoData.find(p => p.name_th === pName);
        if (prov?.districts) {
            const sortedDistricts = [...prov.districts].sort((a, b) => thaiCollator.compare(a.name_th, b.name_th));
            sortedDistricts.forEach(d => {
                const opt = document.createElement('option');
                opt.value = d.name_th; opt.text = d.name_th;
                distSel.appendChild(opt);
            });
            distSel.disabled = false;
        }
    }
    applyMapFilterLive();
}

function onMapDistrictChange() {
    const pName  = document.getElementById('mapProvince').value;
    const dName  = document.getElementById('mapDistrict').value;
    const subSel = document.getElementById('mapSubdistrict');

    subSel.innerHTML = '<option value="">ทุกตำบล</option>';
    subSel.disabled  = true;

    if (pName && dName) {
        const prov = indexGeoData.find(p => p.name_th === pName);
        const dist = prov?.districts?.find(d => d.name_th === dName);
        if (dist?.sub_districts) {
            const sortedSubs = [...dist.sub_districts].sort((a, b) => thaiCollator.compare(a.name_th, b.name_th));
            sortedSubs.forEach(t => {
                const opt = document.createElement('option');
                opt.value = t.name_th; opt.text = t.name_th;
                subSel.appendChild(opt);
            });
            subSel.disabled = false;
        }
    }
    applyMapFilterLive();
}

function applyMapFilterLive() {
    if (!indexSearchMap) return; // ไม่มี inline map — modal ใช้ iframe แล้ว skip

    const keyword  = (document.getElementById('mapKeyword')?.value || '').toLowerCase().trim();
    const propType = document.querySelector('input[name="mapTypeR"]:checked')?.value || '';
    const province = document.getElementById('mapProvince')?.value || '';
    const district = document.getElementById('mapDistrict')?.value || '';
    const subdist  = document.getElementById('mapSubdistrict')?.value || '';
    const rentType = document.getElementById('mapRentType')?.value || '';
    const minPrice = parseInt(document.getElementById('mapMinPrice')?.value) || 0;
    const maxPrice = parseInt(document.getElementById('mapMaxPrice')?.value) || Infinity;

    const roomFacs = [...document.querySelectorAll('.map-room-amenity:not(:checked)')].map(cb => cb.value);
    const bldgFacs = [...document.querySelectorAll('.map-bldg-amenity:not(:checked)')].map(cb => cb.value);

    // helper: อ่าน facility field รองรับทั้ง nested และ flat
    function getRoomVal(p, col) {
        if (p.roomFacility && p.roomFacility[col] !== undefined) return p.roomFacility[col];
        return p[col];
    }
    function getBldgVal(p, col) {
        if (p.buildingFacility && p.buildingFacility[col] !== undefined) return p.buildingFacility[col];
        return p[col];
    }

    const filtered = allPropertiesFromDB.filter(p => {
        if (!p.latitude || !p.longitude) return false;

        // คำค้นหา
        if (keyword) {
            const text = `${p.title||''} ${p.province||''} ${p.district||''} ${p.subdistrict||''} ${p.addressDetail||''}`.toLowerCase();
            if (!text.includes(keyword)) return false;
        }

        // ประเภท
        if (propType && p.propertyType !== propType) return false;

        // ตำแหน่ง
        if (province && p.province !== province) return false;
        if (district && p.district !== district) return false;
        if (subdist  && p.subdistrict !== subdist) return false;

        // ราคา
        if (minPrice > 0 || maxPrice < Infinity) {
            let price = 0;
            if (rentType === 'monthly')      price = parseFloat(p.priceMonthly)  || 0;
            else if (rentType === 'daily')   price = parseFloat(p.priceDaily)    || 0;
            else if (rentType === 'yearly')  price = parseFloat(p.priceYearly)   || 0;
            else if (rentType === 'term')    price = parseFloat(p.priceSemester) || 0;
            else price = parseFloat(p.priceMonthly || p.priceDaily || p.priceSemester || p.priceYearly || 0);
            if (price === 0 && (minPrice > 0 || maxPrice < Infinity)) return false;
            if (price < minPrice || price > maxPrice) return false;
        }

        // สิ่งอำนวยความสะดวกในห้อง — unchecked = ซ่อนที่พักที่มีสิ่งนั้น
        for (const fac of roomFacs) {
            if (getRoomVal(p, fac) == 1) return false;
        }

        // สิ่งอำนวยความสะดวกในอาคาร — unchecked = ซ่อนที่พักที่มีสิ่งนั้น
        for (const fac of bldgFacs) {
            if (getBldgVal(p, fac) == 1) return false;
        }

        return true;
    });

    indexSearchMap.updateMarkers(filtered);

    const countEl = document.getElementById('mapResultCount');
    if (countEl) {
        const active = roomFacs.length + bldgFacs.length + (propType ? 1 : 0) + (province ? 1 : 0) + (keyword ? 1 : 0) + (minPrice > 0 || maxPrice < Infinity ? 1 : 0);
        countEl.innerText = `พบ ${filtered.length} แห่ง${active > 0 ? ` (filter ${active} รายการ)` : ''}`;
    }
}

function resetMapFilter() {
    const kw = document.getElementById('mapKeyword');
    if (kw) kw.value = '';
    const typeAll = document.querySelector('input[name="mapTypeR"][value=""]');
    if (typeAll) typeAll.checked = true;
    ['mapProvince','mapRentType','mapMinPrice','mapMaxPrice'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    const dist = document.getElementById('mapDistrict');
    if (dist) { dist.innerHTML = '<option value="">ทุกอำเภอ/เขต</option>'; dist.disabled = true; }
    const sub = document.getElementById('mapSubdistrict');
    if (sub)  { sub.innerHTML  = '<option value="">ทุกตำบล/แขวง</option>';  sub.disabled  = true; }
    document.querySelectorAll('.map-room-amenity, .map-bldg-amenity').forEach(cb => cb.checked = true);
    applyMapFilterLive();
}
window.addEventListener('click', function(event) {
    const mapModal = document.getElementById('mapSearchModal');
    if (event.target == mapModal) closeMapModal();
});

// ==========================================
// ฟังก์ชันประมวลผล: ค้นหาแบบละเอียด (Advanced Search)
// ==========================================
window.applyAdvancedFilter = function applyAdvancedFilter() {
    // หน้าอื่น (inject ผ่าน shared-header) → redirect ไป index
    if (window.__isSharedHeader) return window._shApplyAdvancedFilter();
    const keyword     = (document.getElementById('advKeyword')?.value || '').toLowerCase().trim();
    const type        = document.querySelector('input[name="advTypeR"]:checked')?.value || '';
    const rentType    = document.getElementById('advRentType')?.value || '';
    const minPrice    = parseInt(document.getElementById('advMinPrice')?.value) || 0;
    const maxPrice    = parseInt(document.getElementById('advMaxPrice')?.value) || 9999999;
    const advProvince = document.getElementById('advProvince')?.value || '';
    const advDistrict = document.getElementById('advDistrict')?.value || '';
    const advSubdist  = document.getElementById('advSubdistrict')?.value || '';

    // เก็บค่า checkbox ที่ถูกเอาออก (unchecked) = สิ่งที่ไม่ต้องการ
    const roomFacs = [...document.querySelectorAll('.adv-room-amenity:not(:checked)')].map(cb => cb.value);
    const bldgFacs = [...document.querySelectorAll('.adv-bldg-amenity:not(:checked)')].map(cb => cb.value);

    filteredPropertiesList = allPropertiesFromDB.filter(prop => {
        // คำค้นหา
        if (keyword) {
            const text = `${prop.title||''} ${prop.province||''} ${prop.district||''} ${prop.addressDetail||''}`.toLowerCase();
            if (!text.includes(keyword)) return false;
        }
        // ประเภท
        if (type) {
            const frontendType = DB_TYPE_MAP[prop.propertyType] || '';
            if (frontendType !== type) return false;
        }
        // ตำแหน่ง
        if (advProvince && prop.province !== advProvince) return false;
        if (advDistrict && prop.district !== advDistrict) return false;
        if (advSubdist  && prop.subdistrict !== advSubdist) return false;
        // ราคา
        let price = 0;
        if (rentType === 'monthly')     price = parseFloat(prop.priceMonthly)  || 0;
        else if (rentType === 'daily')  price = parseFloat(prop.priceDaily)    || 0;
        else if (rentType === 'yearly') price = parseFloat(prop.priceYearly)   || 0;
        else if (rentType === 'term')   price = parseFloat(prop.priceSemester) || 0;
        else price = parseFloat(prop.priceMonthly || prop.priceSemester || prop.priceDaily || 0);
        if (price < minPrice || price > maxPrice) return false;

        // สิ่งอำนวยความสะดวกในห้อง — unchecked = ซ่อนที่พักที่มีสิ่งนั้น
        if (roomFacs.length > 0) {
            for (const col of roomFacs) {
                const val = prop.roomFacility ? prop.roomFacility[col] : prop[col];
                if (val == 1) return false;
            }
        }

        // สิ่งอำนวยความสะดวกอาคาร — unchecked = ซ่อนที่พักที่มีสิ่งนั้น
        if (bldgFacs.length > 0) {
            for (const col of bldgFacs) {
                const val = prop.buildingFacility ? prop.buildingFacility[col] : prop[col];
                if (val == 1) return false;
            }
        }

        return true;
    });

    _closeAdvancedSearch();
    currentPage = 1;
    const _stEl = document.querySelector(".section-title");
    if (_stEl) _stEl.innerText = `🔍 ผลการค้นหา (${filteredPropertiesList.length} รายการ)`;
    renderPropertiesGrid();
    const _cEl = document.querySelector('.container');
    if (_cEl) window.scrollTo({ top: _cEl.offsetTop - 80, behavior: 'smooth' });
}

function _applyFilterFromURL(params) {
    // ใส่ค่าลง filter fields
    const kw = params.get('keyword');
    if (kw) { const el = document.getElementById('advKeyword'); if (el) el.value = kw; }

    const type = params.get('type');
    if (type) {
        const radio = document.querySelector(`input[name="advTypeR"][value="${type}"]`);
        if (radio) radio.checked = true;
    }

    const province = params.get('province');
    if (province) {
        const sel = document.getElementById('advProvince');
        if (sel) { sel.value = province; if (typeof onAdvProvinceChange === 'function') onAdvProvinceChange(); }
    }

    const minP = params.get('minPrice');
    const maxP = params.get('maxPrice');
    if (minP) { const el = document.getElementById('advMinPrice'); if (el) el.value = minP; }
    if (maxP) { const el = document.getElementById('advMaxPrice'); if (el) el.value = maxP; }

    const rentType = params.get('rentType');
    if (rentType) { const el = document.getElementById('advRentType'); if (el) el.value = rentType; }

    const roomFacs = params.get('roomFacs');
    if (roomFacs) roomFacs.split(',').forEach(v => {
        const cb = document.querySelector(`.adv-room-amenity[value="${v}"]`);
        if (cb) cb.checked = true;
    });

    const bldgFacs = params.get('bldgFacs');
    if (bldgFacs) bldgFacs.split(',').forEach(v => {
        const cb = document.querySelector(`.adv-bldg-amenity[value="${v}"]`);
        if (cb) cb.checked = true;
    });

    // apply filter
    applyAdvancedFilter();

    // ล้าง query string ออกจาก URL
    history.replaceState(null, '', window.location.pathname);
}

window.resetAdvancedFilter = function resetAdvancedFilter() {
    document.getElementById('advKeyword').value = '';
    document.querySelector('input[name="advTypeR"][value=""]').checked = true;
    document.getElementById('advRentType').value = '';
    document.getElementById('advMinPrice').value = '';
    document.getElementById('advMaxPrice').value = '';
    document.getElementById('advProvince').value = '';
    document.getElementById('advDistrict').innerHTML = '<option value="">ทุกอำเภอ/เขต</option>';
    document.getElementById('advDistrict').disabled = true;
    document.getElementById('advSubdistrict').innerHTML = '<option value="">ทุกตำบล/แขวง</option>';
    document.getElementById('advSubdistrict').disabled = true;
    document.querySelectorAll('.adv-room-amenity, .adv-bldg-amenity').forEach(cb => cb.checked = true);
}

// ==========================================
// ฟังก์ชันประมวลผล: ค้นหาจากแผนที่ (Map Search)
// ==========================================
function applyMapFilter() {
    const keyword = document.getElementById('mapSearchKeyword').value;
    const rentType = document.getElementById('mapRentType').value;
    customAlert("จำลองการค้นหาพิกัด 📍", `ค้นหา: ${keyword || 'ทั้งหมด'} \nรูปแบบ: ${rentType || 'ทั้งหมด'}\n(ระบบนี้เตรียมไว้สำหรับให้ปักหมุดและโชว์จุดบนแผนที่ในอนาคต)`, "🗺️");
}

// ── Thailand Geography for Advanced Search ───────────────────────
let indexGeoData = [];

async function loadIndexGeoData() {
    if (indexGeoData.length > 0) return; // โหลดแล้ว
    try {
        const res = await fetch('thailand-geography.json');
        indexGeoData = await res.json();
        // เรียงจังหวัดตามตัวอักษรภาษาไทย
        indexGeoData.sort((a, b) => thaiCollator.compare(a.name_th, b.name_th));
        // เติม province ให้ทั้ง advProvince และ mapProvince
        ['advProvince', 'mapProvince'].forEach(selId => {
            const provSel = document.getElementById(selId);
            if (!provSel) return;
            indexGeoData.forEach(p => {
                const opt = document.createElement('option');
                opt.value = p.name_th; opt.text = p.name_th;
                provSel.appendChild(opt);
            });
        });
    } catch (e) { console.error('โหลด geo ไม่ได้:', e); }
}

function onAdvProvinceChange() {
    const pName = document.getElementById('advProvince').value;
    const distSel = document.getElementById('advDistrict');
    const subSel  = document.getElementById('advSubdistrict');
    distSel.innerHTML = '<option value="">-- ทุกอำเภอ/เขต --</option>';
    subSel.innerHTML  = '<option value="">-- ทุกตำบล/แขวง --</option>';
    distSel.disabled = true; subSel.disabled = true;
    if (!pName) return;
    const prov = indexGeoData.find(p => p.name_th === pName);
    if (!prov?.districts) return;
    const sortedDistricts = [...prov.districts].sort((a, b) => thaiCollator.compare(a.name_th, b.name_th));
    sortedDistricts.forEach(d => {
        const opt = document.createElement('option');
        opt.value = d.name_th; opt.text = d.name_th;
        distSel.appendChild(opt);
    });
    distSel.disabled = false;
}

function onAdvDistrictChange() {
    const pName = document.getElementById('advProvince').value;
    const dName = document.getElementById('advDistrict').value;
    const subSel = document.getElementById('advSubdistrict');
    subSel.innerHTML = '<option value="">-- ทุกตำบล/แขวง --</option>';
    subSel.disabled = true;
    if (!pName || !dName) return;
    const prov = indexGeoData.find(p => p.name_th === pName);
    const dist = prov?.districts?.find(d => d.name_th === dName);
    if (!dist?.sub_districts) return;
    const sortedSubs = [...dist.sub_districts].sort((a, b) => thaiCollator.compare(a.name_th, b.name_th));
    sortedSubs.forEach(t => {
        const opt = document.createElement('option');
        opt.value = t.name_th; opt.text = t.name_th;
        subSel.appendChild(opt);
    });
    subSel.disabled = false;
}

function toggleAdvancedSearch() {
    const dropdown = document.getElementById('advancedSearchDropdown');
    if (!dropdown) return;
    const isOpen = dropdown.style.display === 'flex';
    dropdown.style.display = isOpen ? 'none' : 'flex';
    if (!isOpen) {
        loadIndexGeoData();
        // บน mobile ≤768px — CSS จัดการตำแหน่งทั้งหมดแล้ว ไม่ต้องคำนวณ JS
        if (window.innerWidth > 768) {
            requestAnimationFrame(_positionAdvDropdown);
        }
    }
}

/**
 * คำนวณ offset ของ dropdown ไม่ให้หลุดขอบซ้าย/ขวา viewport
 * — ใช้ getBoundingClientRect() แทนการ hardcode right/left
 */
function _positionAdvDropdown() {
    const dropdown = document.getElementById('advancedSearchDropdown');
    if (!dropdown || dropdown.style.display !== 'flex') return;

    // บน mobile (≤768px) — CSS จัดการ centered floating panel แล้ว
    if (window.innerWidth <= 768) return;

    const btn  = document.getElementById('advSearchBtn');
    const MARGIN = 8;
    const vw   = window.innerWidth || document.documentElement.clientWidth;
    const dw   = dropdown.offsetWidth || 650;

    // คำนวณ top = ใต้ปุ่ม
    let top = 60; // fallback
    if (btn) {
        const btnRect = btn.getBoundingClientRect();
        top = btnRect.bottom + 10;
    }

    // คำนวณ left: ชิดขวาปุ่ม แต่ไม่หลุดขอบจอ
    let left;
    if (btn) {
        const btnRect = btn.getBoundingClientRect();
        left = btnRect.right - dw; // align ขวาปุ่ม
        if (left < MARGIN) left = MARGIN;
        if (left + dw > vw - MARGIN) left = vw - MARGIN - dw;
    } else {
        left = vw - MARGIN - dw;
        if (left < MARGIN) left = MARGIN;
    }

    dropdown.style.top       = top + 'px';
    dropdown.style.left      = left + 'px';
    dropdown.style.right     = 'auto';
    dropdown.style.transform = '';
}

function _closeAdvancedSearch() {
    const dropdown = document.getElementById('advancedSearchDropdown');
    if (dropdown) {
        dropdown.style.display   = 'none';
        dropdown.style.transform = '';
    }
}

// resize / zoom → ปรับตำแหน่งใหม่ทันที (desktop only)
window.addEventListener('resize', function() {
    if (window.innerWidth > 768) _positionAdvDropdown();
}, { passive: true });

// คลิก/แตะพื้นที่ว่างนอก dropdown → ปิดอัตโนมัติ
document.addEventListener('click', function(event) {
    const dropdown = document.getElementById('advancedSearchDropdown');
    if (!dropdown || dropdown.style.display !== 'flex') return;
    // ถ้าคลิกอยู่ใน dropdown เอง → ไม่ปิด
    if (dropdown.contains(event.target)) return;
    // ถ้าคลิกปุ่มที่ trigger dropdown หรืออยู่ใน mobile nav → ไม่ปิด
    const desktopBtn = document.getElementById('advSearchBtn');
    if (desktopBtn?.contains(event.target)) return;
    if (event.target.closest('#mobileNav')) return;
    _closeAdvancedSearch();
});

// ESC → ปิด dropdown
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') _closeAdvancedSearch();
});

