var API_BASE = 'http://localhost:5000/api';

let ownerEmail = '';
let propertyId = '';
let activeUser = '';

const TYPE_LABELS = { DORMITORY:'หอพัก/ห้องเช่า', APARTMENT:'อพาร์ตเมนต์', HOUSE:'บ้านเช่า', CONDO:'คอนโด' };

// ----------------------------------------
// Custom Popup
// ----------------------------------------
function customAlert(title, message, icon = 'ℹ️') {
    return new Promise(resolve => {
        document.getElementById('popupIcon').innerText    = icon;
        document.getElementById('popupTitle').innerText   = title;
        document.getElementById('popupMessage').innerText = message;
        document.getElementById('popupButtons').innerHTML =
            `<button class="btn-popup btn-popup-primary" id="popupOkBtn">ตกลง</button>`;
        document.getElementById('customPopup').style.display = 'flex';
        document.getElementById('popupOkBtn').onclick = () => {
            document.getElementById('customPopup').style.display = 'none';
            resolve();
        };
    });
}

// ----------------------------------------
// Init
// ----------------------------------------
window.onload = async function () {
    activeUser = localStorage.getItem('activeUser') || '';

    const urlParams = new URLSearchParams(window.location.search);
    ownerEmail = urlParams.get('email')      || '';
    propertyId = urlParams.get('propertyId') || '';

    if (!ownerEmail) {
        await customAlert('ไม่พบข้อมูล', 'ไม่พบอีเมลเจ้าของที่พัก', '❌');
        history.back();
        return;
    }

    // ซ่อนปุ่มทักแชทถ้าเป็นเจ้าของเอง
    if (activeUser === ownerEmail) {
        const chatBtn     = document.getElementById('chatBtn');
        const sideChatBtn = document.getElementById('sideChatBtn');
        if (chatBtn)     chatBtn.style.display     = 'none';
        if (sideChatBtn) sideChatBtn.style.display = 'none';
    }

    await Promise.all([loadOwnerData(), loadOwnerProperties()]);
};

// ----------------------------------------
// Tab Switch
// ----------------------------------------
function switchTab(tab) {
    document.getElementById('tab-info').style.display       = tab === 'info'       ? 'block' : 'none';
    document.getElementById('tab-properties').style.display = tab === 'properties' ? 'block' : 'none';

    document.getElementById('navInfo').classList.toggle('active',       tab === 'info');
    document.getElementById('navProperties').classList.toggle('active', tab === 'properties');
}

// ----------------------------------------
// โหลดข้อมูลเจ้าของ
// ----------------------------------------
async function loadOwnerData() {
    try {
        const res    = await fetch(`${API_BASE}/users/me?email=${encodeURIComponent(ownerEmail)}`);
        const result = await res.json();
        if (!result.success) return;
        renderOwner(result.data);
    } catch (err) {
        console.error(err);
    }
}

function renderOwner(u) {
    const fullName = `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email;

    // Sidebar
    if (u.profileImage) {
        document.getElementById('sideProfilePic').src = u.profileImage;
        document.getElementById('bannerPic').src       = u.profileImage;
    }
    document.getElementById('sideProfileName').innerText = fullName;

    // Banner
    document.getElementById('bannerName').innerText  = fullName;
    document.getElementById('bannerEmail').innerText = u.email;

    // Fields
    document.getElementById('dispName').innerText     = fullName;
    document.getElementById('dispPhone').innerText    = u.phone    || 'ยังไม่ได้ระบุ';
    document.getElementById('dispLine').innerText     = u.lineId   || 'ยังไม่ได้ระบุ';
    document.getElementById('dispFacebook').innerText = u.facebook || 'ยังไม่ได้ระบุ';

    if (!u.lineId)   document.getElementById('dispLine').style.color     = '#aaa';
    if (!u.facebook) document.getElementById('dispFacebook').style.color = '#aaa';
    if (!u.phone)    document.getElementById('dispPhone').style.color    = '#aaa';
}

// ----------------------------------------
// โหลดที่พักของเจ้าของ
// ----------------------------------------
async function loadOwnerProperties() {
    const grid = document.getElementById('ownerPropertyGrid');
    try {
        const res    = await fetch(`${API_BASE}/users/me/properties?email=${encodeURIComponent(ownerEmail)}`);
        const result = await res.json();

        if (!result.success || result.data.length === 0) {
            grid.innerHTML = '<div class="empty-state">ยังไม่มีที่พักที่ลงประกาศ</div>';
            return;
        }

        // แสดงจำนวนที่พักใน badge
        const badge = document.getElementById('propCountBadge');
        if (badge) {
            badge.innerText      = result.data.length;
            badge.style.display  = 'inline-block';
        }

        // filter เฉพาะที่เผยแพร่ (isPublished = 1)
        const published = result.data.filter(p => p.isPublished);

        if (!published.length) {
            grid.innerHTML = '<div class="empty-state">ยังไม่มีที่พักที่เผยแพร่</div>';
            return;
        }

        grid.innerHTML = '';
        published.forEach(p => {
            const typeName    = TYPE_LABELS[p.propertyType] || p.propertyType;
            const price       = p.priceMonthly > 0
                ? `฿${Number(p.priceMonthly).toLocaleString()} /เดือน`
                : p.priceDaily > 0 ? `฿${Number(p.priceDaily).toLocaleString()} /วัน` : 'ไม่ระบุราคา';
            const location    = p.province ? `จ.${p.province}` : 'ไม่ระบุตำแหน่ง';
            const coverImg    = p.coverImage || 'https://placehold.co/400x250/eee/999?text=No+Photo';
            const isHighlight = propertyId && String(p.propertyId) === String(propertyId);

            const card = document.createElement('div');
            card.className = 'property-card';
            if (isHighlight) {
                card.style.cssText = 'border:2px solid #8b7355; box-shadow:0 4px 16px rgba(139,115,85,0.25);';
            }
            card.style.cursor = 'pointer';
            card.onclick = () => window.location.href = `view-property.html?id=${p.propertyId}`;
            card.innerHTML = `
                <div style="position:relative;">
                    <img src="${coverImg}" class="card-image" alt="${p.title}"
                         onerror="this.src='https://placehold.co/400x250/eee/999?text=No+Photo'">
                    ${isHighlight ? `<div style="position:absolute;top:8px;left:8px;background:#8b7355;color:white;border-radius:6px;padding:3px 10px;font-size:11px;font-weight:600;">📌 ที่พักนี้</div>` : ''}
                </div>
                <div class="card-content">
                    <h3 class="card-title">${p.title || 'ไม่มีชื่อ'}</h3>
                    <div class="card-info">🏷️ ${typeName}</div>
                    <div class="card-info">📍 ${location}</div>
                    <div class="card-price">${price}</div>
                </div>
                <div class="card-actions">
                    <a href="view-property.html?id=${p.propertyId}" class="action-btn btn-view"
                       onclick="event.stopPropagation()">👁 ดูรายละเอียด</a>
                </div>`;
            grid.appendChild(card);
        });
    } catch (err) {
        console.error(err);
        grid.innerHTML = '<div class="empty-state">โหลดที่พักไม่ได้ กรุณาลองใหม่</div>';
    }
}

// ----------------------------------------
// ทักแชท
// ----------------------------------------
function startChat() {
    if (!activeUser) {
        customAlert('กรุณาเข้าสู่ระบบ', 'ต้องเข้าสู่ระบบก่อนถึงจะทักแชทได้', '🔒')
            .then(() => { if (window.openLogin) window.openLogin(); });
        return;
    }
    const url = propertyId
        ? `chat.html?user=${encodeURIComponent(ownerEmail)}&propertyId=${propertyId}`
        : `chat.html?user=${encodeURIComponent(ownerEmail)}`;
    window.location.href = url;
}
