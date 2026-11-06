var API_BASE = 'http://localhost:5000/api';
let activeUser = '';
let currentChatWith = '';
let pendingImageBase64 = null;
let pollTimer = null;

// ==========================================
// Init
// ==========================================
window.onload = async function () {
    activeUser = localStorage.getItem('activeUser');
    if (!activeUser) {
        alert('กรุณาเข้าสู่ระบบก่อนใช้งานแชท');
        window.location.href = 'index.html';
        return;
    }

    const urlParams  = new URLSearchParams(window.location.search);
    const targetUser = urlParams.get('user');
    const propertyId = urlParams.get('propertyId');

    await loadContactList();

    if (targetUser && targetUser !== activeUser) {
        await openChat(targetUser);
        if (propertyId) {
            await sendPropertyCard(propertyId);
        }
    }

    // โหลดที่พักของตัวเองเพื่อแสดงปุ่ม 🏠 (เฉพาะเจ้าของ)
    loadMyProperties();
};

// ==========================================
// Property Card
// ==========================================
const propCardCache = {};

async function fetchPropCardData(pid) {
    if (propCardCache[pid]) {
        updatePropCardDOM(pid, propCardCache[pid]);
        return;
    }
    try {
        const res = await fetch(`${API_BASE}/properties/${pid}`);
        const result = await res.json();
        if (!result.success) return;
        const p = result.data;
        const fallback = 'https://placehold.co/280x140/e6f0ff/2b7bb9?text=No+Photo';
        const firstImg = p.images?.[0];
        const imgSrc = typeof firstImg === 'string' ? firstImg : (firstImg?.imageUrl || fallback);
        propCardCache[pid] = {
            img:        imgSrc || fallback,
            title:      p.title || '-',
            price:      p.priceMonthly > 0 ? `฿${Number(p.priceMonthly).toLocaleString()}/เดือน`
                      : p.priceDaily > 0    ? `฿${Number(p.priceDaily).toLocaleString()}/วัน`
                      : p.priceSemester > 0 ? `฿${Number(p.priceSemester).toLocaleString()}/เทอม` : '',
            ownerEmail: p.ownerEmail || ''
        };
        updatePropCardDOM(pid, propCardCache[pid]);
    } catch (e) { console.error('fetchPropCardData:', e); }
}

function updatePropCardDOM(pid, data) {
    const imgEl   = document.getElementById(`pcimg-${pid}`);
    const titleEl = document.getElementById(`pctitle-${pid}`);
    const priceEl = document.getElementById(`pcprice-${pid}`);
    if (imgEl)   { imgEl.src = data.img; imgEl.onerror = () => { imgEl.src = 'https://placehold.co/280x140/eee/999?text=No+Photo'; }; }
    if (titleEl) titleEl.innerText = data.title;
    if (priceEl) priceEl.innerText = data.price;
    // แสดงปุ่มขอรีวิวถ้าเราเป็นเจ้าของ (ทำทุกครั้งที่ DOM ถูก render ใหม่)
    const reviewBtn = document.getElementById(`review-req-btn-${pid}`);
    if (reviewBtn) {
        reviewBtn.style.display = (data.ownerEmail && data.ownerEmail === activeUser) ? 'block' : 'none';
    }
}

// แสดงปุ่ม 🏠 เฉพาะเจ้าของที่พัก
async function loadMyProperties() {
    try {
        const res = await fetch(`${API_BASE}/users/me/properties?email=${encodeURIComponent(activeUser)}`);
        const result = await res.json();
        if (result.success && result.data.length > 0) {
            document.getElementById('btnShareProperty').style.display = 'flex';
            window._myProperties = result.data;
        }
    } catch (e) {}
}

async function openSharePropertyPanel() {
    const panel = document.getElementById('sharePropertyPanel');
    const list  = document.getElementById('sharePropertyList');
    if (panel.style.display === 'block') { panel.style.display = 'none'; return; }

    list.innerHTML = '<p style="color:#aaa;padding:12px;text-align:center;">กำลังโหลด...</p>';
    panel.style.display = 'block';

    try {
        // ดึงข้อความในแชทปัจจุบัน แล้วหา PROPERTY_CARD ที่มีอยู่
        const res = await fetch(`${API_BASE}/chat/messages?me=${encodeURIComponent(activeUser)}&with=${encodeURIComponent(currentChatWith)}`);
        const result = await res.json();
        if (!result.success) { list.innerHTML = '<p style="color:#aaa;padding:12px;text-align:center;">โหลดไม่สำเร็จ</p>'; return; }

        // เก็บ propertyId ที่ไม่ซ้ำจากข้อความในแชทนี้
        const seenPids = new Set();
        const cardPids = [];
        result.data.forEach(msg => {
            const m = (msg.messageText || '').match(/^\[PROPERTY_CARD:(\d+)\]$/);
            if (m && !seenPids.has(m[1])) {
                seenPids.add(m[1]);
                cardPids.push(m[1]);
            }
        });

        if (cardPids.length === 0) {
            list.innerHTML = '<p style="color:#aaa;padding:12px;text-align:center;">ยังไม่มีที่พักในแชทนี้</p>';
            return;
        }

        // โหลดข้อมูลที่พักแต่ละอันจาก cache หรือ API
        list.innerHTML = '';
        const TYPE = { DORMITORY:'หอพัก', APARTMENT:'อพาร์ตเมนต์', HOUSE:'บ้านเช่า', CONDO:'คอนโด' };

        for (const pid of cardPids) {
            // ใช้ cache ถ้ามี ไม่งั้น fetch
            if (!propCardCache[pid]) {
                try {
                    const r = await fetch(`${API_BASE}/properties/${pid}`);
                    const pr = await r.json();
                    if (pr.success) {
                        const p = pr.data;
                        const firstImg = p.images?.[0];
                        const imgSrc = typeof firstImg === 'string' ? firstImg : (firstImg?.imageUrl || '');
                        propCardCache[pid] = { img: imgSrc, title: p.title || '-', price: '', ownerEmail: p.ownerEmail || '', propertyType: p.propertyType, province: p.province };
                    }
                } catch (e) {}
            }

            const cached = propCardCache[pid];
            if (!cached) continue;

            const item = document.createElement('div');
            item.style.cssText = 'display:flex;align-items:center;gap:10px;padding:10px 12px;cursor:pointer;border-radius:8px;transition:background 0.15s;';
            item.onmouseover = () => { item.style.background = '#f5f0e6'; };
            item.onmouseout  = () => { item.style.background = 'transparent'; };
            item.innerHTML = `
                <span style="font-size:22px;">🏠</span>
                <div style="flex:1;overflow:hidden;">
                    <div style="font-weight:600;font-size:13px;color:#4a3f35;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${cached.title}</div>
                    <div style="font-size:12px;color:#888;">${TYPE[cached.propertyType]||''} · ${cached.province||''}</div>
                </div>`;
            item.onclick = async () => { panel.style.display = 'none'; await sendReviewRequest(pid); };
            list.appendChild(item);
        }
    } catch (e) {
        console.error('openSharePropertyPanel error:', e);
        list.innerHTML = '<p style="color:#aaa;padding:12px;text-align:center;">โหลดไม่สำเร็จ</p>';
    }
}

// เจ้าของกดส่งคำขอรีวิวให้ผู้เช่า
async function sendReviewRequest(propertyId) {
    if (!currentChatWith || !activeUser) return;
    const ok = confirm(`ส่งคำขอรีวิวที่พักนี้ให้ ${getDisplayName(currentChatWith)} ใช่ไหม?`);
    if (!ok) return;
    try {
        await fetch(`${API_BASE}/chat/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                senderEmail:   activeUser,
                receiverEmail: currentChatWith,
                messageText:   `[REVIEW_REQUEST:${propertyId}]`,
                propertyId:    parseInt(propertyId)
            })
        });
        await renderMessages();
        await loadContactList();
    } catch (err) { console.error('sendReviewRequest error:', err); }
}

// ผู้เช่ากดส่งรีวิว
async function submitReview(propertyId) {
    const stars  = document.querySelector(`input[name="star-${propertyId}"]:checked`);
    const comment = document.getElementById(`review-comment-${propertyId}`)?.value.trim();
    if (!stars) { alert('กรุณาเลือกคะแนนดาวก่อน'); return; }

    const btn = document.getElementById(`review-btn-${propertyId}`);
    if (btn) { btn.disabled = true; btn.innerText = 'กำลังส่ง...'; }

    try {
        const res = await fetch(`${API_BASE}/reviews`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userEmail:   activeUser,
                propertyId:  parseInt(propertyId),
                ratingScore: parseInt(stars.value),
                comment:     comment || ''
            })
        });
        const result = await res.json();
        if (result.success) {
            // แทนที่ฟอร์มด้วยข้อความขอบคุณ
            const form = document.getElementById(`review-form-${propertyId}`);
            if (form) {
                form.id = `review-done-${propertyId}`;
                form.innerHTML = `<div style="text-align:center; padding:8px; color:#28a745; font-weight:600;">
                    ✅ ขอบคุณสำหรับรีวิว! (${stars.value} ⭐)
                </div>`;
                _lastRenderedKey = ''; // บังคับ re-render ครั้งต่อไปโดยไม่รีเซต form
            }
        } else {
            alert(result.message || 'ส่งรีวิวไม่สำเร็จ');
            if (btn) { btn.disabled = false; btn.innerText = 'ส่งรีวิว'; }
        }
    } catch (err) {
        console.error('submitReview error:', err);
        if (btn) { btn.disabled = false; btn.innerText = 'ส่งรีวิว'; }
    }
}

async function sendPropertyCard(propertyId) {
    if (!currentChatWith || !activeUser) return;
    try {
        const checkRes = await fetch(
            `${API_BASE}/chat/messages?me=${encodeURIComponent(activeUser)}&with=${encodeURIComponent(currentChatWith)}`
        );
        const checkResult = await checkRes.json();
        const alreadySent = checkResult.success && checkResult.data.some(
            m => m.messageText === `[PROPERTY_CARD:${propertyId}]` && m.senderEmail === activeUser
        );
        if (alreadySent) return;

        await fetch(`${API_BASE}/chat/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                senderEmail:   activeUser,
                receiverEmail: currentChatWith,
                messageText:   `[PROPERTY_CARD:${propertyId}]`,
                propertyId:    parseInt(propertyId)
            })
        });
        await renderMessages();
        await loadContactList();
    } catch (err) { console.error('sendPropertyCard error:', err); }
}

// ==========================================
// Contact List
// ==========================================
async function loadContactList() {
    const container = document.getElementById('contactList');
    try {
        const res = await fetch(`${API_BASE}/chat/conversations?email=${encodeURIComponent(activeUser)}`);
        const result = await res.json();
        container.innerHTML = '';

        if (!result.success || result.data.length === 0) {
            if (currentChatWith) { renderSingleContact(currentChatWith, container); }
            else { container.innerHTML = "<div style='padding:20px;color:#888;text-align:center;'>ยังไม่มีประวัติการสนทนา</div>"; }
            return;
        }

        const allEmails = result.data.map(c => c.contactEmail);
        if (currentChatWith && !allEmails.includes(currentChatWith)) {
            result.data.unshift({ contactEmail: currentChatWith, fullName: getDisplayName(currentChatWith), lastMessage: '', lastSender: '', unreadCount: 0 });
        }

        result.data.forEach(conv => {
            const div = document.createElement('div');
            div.className = `contact-item ${currentChatWith === conv.contactEmail ? 'active' : ''}`;
            div.onclick = () => openChat(conv.contactEmail);

            let lastMsgPreview = conv.lastMessage || '';
            if (lastMsgPreview.match(/^\[PROPERTY_CARD:\d+\]$/)) lastMsgPreview = '🏠 แชร์ที่พัก';
            else if (lastMsgPreview.startsWith('data:image')) lastMsgPreview = '📷 ส่งรูปภาพ';
            if (lastMsgPreview.length > 40) lastMsgPreview = lastMsgPreview.substring(0, 40) + '...';

            const prefix = conv.lastSender === activeUser ? 'คุณ: ' : '';
            const unreadBadge = conv.unreadCount > 0
                ? `<span style="background:#e74c3c;color:white;border-radius:50%;padding:2px 7px;font-size:12px;font-weight:bold;margin-left:auto;flex-shrink:0;">${conv.unreadCount}</span>`
                : '';

            div.innerHTML = `
                <div class="contact-avatar">👤</div>
                <div class="contact-info" style="display:flex;flex-direction:column;overflow:hidden;flex:1;">
                    <div style="display:flex;align-items:center;gap:8px;">
                        <div class="contact-name">${escapeHtml(conv.fullName)}</div>
                        ${unreadBadge}
                    </div>
                    <div class="contact-last-msg">${prefix}${escapeHtml(lastMsgPreview)}</div>
                </div>`;
            container.appendChild(div);
        });
    } catch (err) {
        console.error('loadContactList error:', err);
        container.innerHTML = "<div style='padding:20px;color:#888;text-align:center;'>ไม่สามารถโหลดรายชื่อได้<br><small>กรุณาตรวจสอบว่ารัน Backend อยู่</small></div>";
    }
}

function renderSingleContact(email, container) {
    const div = document.createElement('div');
    div.className = 'contact-item active';
    div.onclick = () => openChat(email);
    div.innerHTML = `
        <div class="contact-avatar">👤</div>
        <div class="contact-info">
            <div class="contact-name">${escapeHtml(getDisplayName(email))}</div>
            <div class="contact-last-msg" style="color:#aaa;">เริ่มการสนทนา</div>
        </div>`;
    container.appendChild(div);
}

function getDisplayName(email) {
    const cached = JSON.parse(localStorage.getItem('userProfile_' + email) || 'null');
    return cached?.fullName || email;
}

// ==========================================
// Open Chat
// ==========================================
async function openChat(contactEmail) {
    currentChatWith = contactEmail;
    _lastRenderedKey = ''; // reset cache เมื่อเปลี่ยน conversation
    document.getElementById('emptyChat').style.display = 'none';
    document.getElementById('chatHeader').style.display = 'flex';
    document.getElementById('chatMessages').style.display = 'flex';
    document.getElementById('chatInputArea').style.display = 'flex';
    document.getElementById('chatHeaderName').innerText = getDisplayName(contactEmail);

    try {
        const r = await fetch(`${API_BASE}/users/me?email=${encodeURIComponent(contactEmail)}`);
        const result = await r.json();
        if (result.success) {
            const u = result.data;
            const fullName = `${u.firstName || ''} ${u.lastName || ''}`.trim() || contactEmail;
            document.getElementById('chatHeaderName').innerText = fullName;
            localStorage.setItem('userProfile_' + contactEmail, JSON.stringify({
                email: u.email, fullName, firstName: u.firstName,
                lastName: u.lastName, phone: u.phone, role: u.role
            }));
        }
    } catch (e) {}

    if (window.innerWidth <= 768) document.getElementById('sidebar').classList.add('hidden');

    await renderMessages();
    await markAsRead();
    await loadContactList();

    clearInterval(pollTimer);
    pollTimer = setInterval(async () => {
        await renderMessages();
        await loadContactList();
        await markAsRead();
    }, 3000);
}

// ==========================================
// Render Messages
// ==========================================
let _lastRenderedKey = ''; // cache key ป้องกัน re-render ซ้ำ

async function renderMessages() {
    if (!currentChatWith) return;
    const container = document.getElementById('chatMessages');
    const scrolledToBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 80;

    try {
        const res = await fetch(`${API_BASE}/chat/messages?me=${encodeURIComponent(activeUser)}&with=${encodeURIComponent(currentChatWith)}`);
        const result = await res.json();
        if (!result.success) return;

        // สร้าง key จาก chatId + isRead ทุกข้อความ — ถ้าเหมือนเดิมไม่ต้อง re-render
        const newKey = result.data.map(m => `${m.chatId}:${m.isRead}`).join(',');
        if (newKey === _lastRenderedKey) return; // ไม่มีการเปลี่ยนแปลง
        _lastRenderedKey = newKey;

        container.innerHTML = '';

        if (result.data.length === 0) {
            container.innerHTML = `<div style="text-align:center;color:#aaa;padding:20px;font-size:14px;">เริ่มต้นการสนทนาได้เลย 👋</div>`;
            return;
        }

        for (const msg of result.data) {
            const isMe = msg.senderEmail === activeUser;
            const timeStr = new Date(msg.sentAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
            const div = document.createElement('div');
            div.className = `message ${isMe ? 'sent' : 'received'}`;
            const text = msg.messageText || '';

            const cardMatch = text.match(/^\[PROPERTY_CARD:(\d+)\]$/);
            if (cardMatch) {
                const pid = cardMatch[1];
                div.style.cssText = 'width:260px; padding:0; background:transparent; box-shadow:none; border:none; align-self:' + (isMe ? 'flex-end' : 'flex-start');

                // สร้าง card ด้วย DOM เพื่อ set รูปได้ทันทีหลัง fetch
                const cardWrap = document.createElement('div');
                cardWrap.style.cssText = 'width:260px; background:white; border:1px solid #dcd3c6; border-radius:12px; overflow:hidden; cursor:pointer; box-shadow:0 2px 8px rgba(0,0,0,0.08); transition:box-shadow 0.2s;';
                cardWrap.onclick = () => { window.location.href = `view-property.html?id=${pid}`; };
                cardWrap.onmouseover = () => { cardWrap.style.boxShadow = '0 4px 16px rgba(0,0,0,0.15)'; };
                cardWrap.onmouseout  = () => { cardWrap.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)'; };

                const imgEl = document.createElement('img');
                imgEl.id    = `pcimg-${pid}`;
                imgEl.src   = 'https://placehold.co/280x140/e6f0ff/2b7bb9?text=Loading...';
                imgEl.alt   = '';
                imgEl.style.cssText = 'width:100%; height:150px; object-fit:cover; display:block; background:#f0ece6;';
                imgEl.onerror = () => { imgEl.src = 'https://placehold.co/280x140/eee/999?text=No+Photo'; };

                const infoDiv = document.createElement('div');
                infoDiv.style.padding = '10px 12px';

                const titleEl = document.createElement('div');
                titleEl.id = `pctitle-${pid}`;
                titleEl.style.cssText = 'font-weight:600; font-size:14px; color:#4a3f35; margin-bottom:4px;';
                titleEl.innerText = 'กำลังโหลด...';

                const priceEl = document.createElement('div');
                priceEl.id = `pcprice-${pid}`;
                priceEl.style.cssText = 'font-size:13px; color:#e74c3c; margin-bottom:6px;';

                const hint = document.createElement('div');
                hint.style.cssText = 'font-size:12px; color:#8b7355; font-weight:500;';
                hint.innerText = '👁️ คลิกเพื่อดูรายละเอียด';

                infoDiv.appendChild(titleEl);
                infoDiv.appendChild(priceEl);
                infoDiv.appendChild(hint);

        // ปุ่มขอรีวิว: แสดงเฉพาะเมื่อ activeUser เป็นเจ้าของที่พักนั้น
        // ตรวจจาก ownerEmail ที่อยู่ใน propCardCache หรือดึงจาก API ทีหลัง
        if (isMe) {
            const reviewBtn = document.createElement('button');
            reviewBtn.id = `review-req-btn-${pid}`;
            reviewBtn.style.cssText = 'margin-top:8px; width:100%; background:#f5f0e6; color:#8b7355; border:1px solid #dcd3c6; border-radius:6px; padding:7px; font-size:13px; font-weight:600; cursor:pointer; transition:0.2s;';
            reviewBtn.innerText = '⭐ ขอรีวิวจากผู้เช่า';
            reviewBtn.onclick = (e) => { e.stopPropagation(); sendReviewRequest(pid); };
            reviewBtn.onmouseover = () => { reviewBtn.style.background = '#ebe3d5'; };
            reviewBtn.onmouseout  = () => { reviewBtn.style.background = '#f5f0e6'; };
            infoDiv.appendChild(reviewBtn);
        }

                cardWrap.appendChild(imgEl);
                cardWrap.appendChild(infoDiv);

                const timeDiv = document.createElement('div');
                timeDiv.className = 'message-time';
                timeDiv.style.marginTop = '4px';
                timeDiv.innerText = timeStr;

                div.appendChild(cardWrap);
                div.appendChild(timeDiv);
                container.appendChild(div);
                fetchPropCardData(pid); // โหลดรูปและข้อมูลจริง
                continue;
            }

            // ── Review Request card (ผู้เช่าเห็นฟอร์มกรอกรีวิว) ──
            const reviewMatch = text.match(/^\[REVIEW_REQUEST:(\d+)\]$/);
            if (reviewMatch) {
                const pid = reviewMatch[1];

                // ถ้า form นี้มีอยู่แล้วใน DOM ให้ข้ามการสร้างใหม่ (ป้องกันดาว/ข้อความหายตอน poll)
                if (document.getElementById(`review-form-${pid}`) || document.getElementById(`review-done-${pid}`)) {
                    continue;
                }
                div.style.cssText = 'width:260px; padding:0; background:transparent; box-shadow:none; border:none; align-self:' + (isMe ? 'flex-end' : 'flex-start');

                const card = document.createElement('div');
                card.style.cssText = 'width:260px; background:white; border:1px solid #dcd3c6; border-radius:12px; overflow:hidden; box-shadow:0 2px 8px rgba(0,0,0,0.08); padding:14px;';

                const header = document.createElement('div');
                header.style.cssText = 'font-weight:700; font-size:14px; color:#4a3f35; margin-bottom:4px;';
                header.innerText = '⭐ ขอรีวิวที่พัก';

                const sub = document.createElement('div');
                sub.style.cssText = 'font-size:12px; color:#888; margin-bottom:12px;';
                sub.innerText = 'กรุณาให้คะแนนและความคิดเห็น';

                card.appendChild(header);
                card.appendChild(sub);

                if (!isMe) {
                    // ผู้เช่าเห็นฟอร์มรีวิว
                    const formDiv = document.createElement('div');
                    formDiv.id = `review-form-${pid}`;

                    // ดาว 1-5 (เรียงซ้าย→ขวา, ไม่มี duplicate id)
                    const orderedStarRow = document.createElement('div');
                    orderedStarRow.style.cssText = 'display:flex; gap:4px; margin-bottom:10px; justify-content:center;';
                    for (let s = 1; s <= 5; s++) {
                        const inp = document.createElement('input');
                        inp.type = 'radio'; inp.name = `star-${pid}`; inp.value = s; inp.id = `star-${pid}-${s}`;
                        inp.style.display = 'none';
                        const lbl = document.createElement('label');
                        lbl.htmlFor = `star-${pid}-${s}`;
                        lbl.style.cssText = 'font-size:28px; cursor:pointer; color:#ddd; transition:color 0.15s;';
                        lbl.innerText = '★';
                        lbl.title = `${s} ดาว`;
                        orderedStarRow.appendChild(inp);
                        orderedStarRow.appendChild(lbl);
                    }
                    // event: hover และ click highlight ดาว
                    orderedStarRow.addEventListener('mouseover', e => {
                        if (e.target.tagName !== 'LABEL') return;
                        const val = parseInt(e.target.htmlFor.split('-').pop());
                        orderedStarRow.querySelectorAll('label').forEach((l, i) => {
                            l.style.color = (i + 1) <= val ? '#f5a623' : '#ddd';
                        });
                    });
                    orderedStarRow.addEventListener('mouseout', () => {
                        const checked = formDiv.querySelector(`input[name="star-${pid}"]:checked`);
                        const val = checked ? parseInt(checked.value) : 0;
                        orderedStarRow.querySelectorAll('label').forEach((l, i) => {
                            l.style.color = (i + 1) <= val ? '#f5a623' : '#ddd';
                        });
                    });
                    orderedStarRow.addEventListener('change', e => {
                        if (e.target.type !== 'radio') return;
                        const val = parseInt(e.target.value);
                        orderedStarRow.querySelectorAll('label').forEach((l, i) => {
                            l.style.color = (i + 1) <= val ? '#f5a623' : '#ddd';
                        });
                    });

                    const textarea = document.createElement('textarea');
                    textarea.id = `review-comment-${pid}`;
                    textarea.placeholder = 'ความคิดเห็น (ไม่บังคับ)';
                    textarea.rows = 3;
                    textarea.style.cssText = 'width:100%; box-sizing:border-box; border:1px solid #dcd3c6; border-radius:8px; padding:8px; font-size:13px; font-family:Prompt,sans-serif; resize:none; margin-bottom:10px;';

                    const submitBtn = document.createElement('button');
                    submitBtn.id = `review-btn-${pid}`;
                    submitBtn.style.cssText = 'width:100%; background:#8b7355; color:white; border:none; border-radius:8px; padding:9px; font-size:14px; font-weight:600; cursor:pointer; transition:0.2s;';
                    submitBtn.innerText = 'ส่งรีวิว';
                    submitBtn.onclick = () => submitReview(pid);

                    formDiv.appendChild(orderedStarRow);
                    formDiv.appendChild(textarea);
                    formDiv.appendChild(submitBtn);
                    card.appendChild(formDiv);
                } else {
                    // เจ้าของเห็นแค่ว่าส่งคำขอไปแล้ว
                    const sent = document.createElement('div');
                    sent.style.cssText = 'text-align:center; color:#8b7355; font-size:13px; font-weight:500; padding:4px 0;';
                    sent.innerText = '✅ ส่งคำขอรีวิวแล้ว';
                    card.appendChild(sent);
                }

                const timeDiv2 = document.createElement('div');
                timeDiv2.className = 'message-time';
                timeDiv2.style.marginTop = '4px';
                timeDiv2.innerText = timeStr;

                div.appendChild(card);
                div.appendChild(timeDiv2);
                container.appendChild(div);
                continue;
            }

            if (text.startsWith('data:image')) {
                const img = document.createElement('img');
                img.src = text;
                img.onclick = () => window.open(text, '_blank');
                div.appendChild(img);
            } else if (msg.senderEmail === 'admin' && text.includes('แจ้งเตือนจาก Admin') && !isMe) {
                // ── ข้อความแจ้งเตือนจาก admin — render แบบ inline fix buttons ──
                let pidFromMsg = msg.propertyId || null;
                if (!pidFromMsg) {
                    const idMatch = text.match(/\(ID:\s*(\d+)\)/);
                    if (idMatch) pidFromMsg = parseInt(idMatch[1]);
                }

                // ลบ REPORT_TYPES tag ออก แล้ว split เป็น paragraph
                const cleanText = text.replace(/\n?\[REPORT_TYPES:[^\]]*\]/g, '').trim();
                const paragraphs = cleanText.split(/\n\n+/);

                const msgContainer = document.createElement('div');
                msgContainer.style.cssText = 'display:flex; flex-direction:column; gap:10px;';

                paragraphs.forEach(para => {
                    // ดึง [FIX:section] ออกจาก paragraph
                    const fixMatch = para.match(/\[FIX:([^\]]+)\]/);
                    const section  = fixMatch ? fixMatch[1].trim() : null;
                    const paraText = para.replace(/\s*\[FIX:[^\]]+\]/g, '').trim();
                    if (!paraText) return;

                    const paraDiv = document.createElement('div');
                    paraDiv.style.cssText = 'display:flex; flex-direction:column; gap:3px;';

                    // แสดงแต่ละบรรทัดใน paragraph
                    paraText.split('\n').forEach(line => {
                        const lineEl = document.createElement('div');
                        lineEl.innerText = line;
                        lineEl.style.cssText = 'font-size:13px; line-height:1.6; white-space:pre-wrap;';
                        paraDiv.appendChild(lineEl);
                    });

                    // ถ้ามี [FIX:section] → ปุ่ม inline ขีดเส้นใต้ + highlight เหลือง
                    if (section && pidFromMsg) {
                        const fixBtn = document.createElement('button');
                        fixBtn.innerText = '✏️ แก้ไข';
                        fixBtn.style.cssText = [
                            'display:inline-block',
                            'margin-top:5px',
                            'align-self:flex-start',
                            'background:#fff176',
                            'color:#5c4200',
                            'border:none',
                            'border-bottom:2px solid #e6b800',
                            'border-radius:4px',
                            'padding:3px 14px',
                            'font-size:12px',
                            'font-weight:700',
                            'cursor:pointer',
                            'font-family:Prompt,sans-serif',
                            'text-decoration:underline',
                            'text-underline-offset:2px',
                            'transition:background 0.15s'
                        ].join(';');
                        fixBtn.onmouseover = () => { fixBtn.style.background = '#ffe500'; };
                        fixBtn.onmouseout  = () => { fixBtn.style.background = '#fff176'; };
                        fixBtn.onclick = () => {
                            fetch(`${API_BASE}/reports/mark-fixing`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ email: activeUser, propertyId: pidFromMsg })
                            }).catch(() => {});
                            if (section === 'contact') {
                                window.location.href = `profile.html?tab=profile`;
                            } else {
                                window.location.href = `edit-property.html?id=${pidFromMsg}&section=${section}`;
                            }
                        };
                        paraDiv.appendChild(fixBtn);
                    }

                    msgContainer.appendChild(paraDiv);
                });

                div.appendChild(msgContainer);
            } else {
                // ข้อความปกติ
                const textDiv = document.createElement('div');
                textDiv.innerText = text.replace(/\n?\[REPORT_TYPES:[^\]]*\]/g, '').trim();
                div.appendChild(textDiv);
            }
            const timeDiv = document.createElement('div');
            timeDiv.className = 'message-time';
            timeDiv.innerText = timeStr;
            div.appendChild(timeDiv);
            container.appendChild(div);
        }

        if (scrolledToBottom) container.scrollTop = container.scrollHeight;
    } catch (err) { console.error('renderMessages error:', err); }
}

// ==========================================
// Mark as Read / Send / Image / Utils
// ==========================================
async function markAsRead() {
    if (!currentChatWith) return;
    try {
        await fetch(`${API_BASE}/chat/read?me=${encodeURIComponent(activeUser)}&with=${encodeURIComponent(currentChatWith)}`, { method: 'PATCH' });
    } catch (e) {}
}

async function sendMessage() {
    const textInput = document.getElementById('messageInput');
    const text = textInput.value.trim();
    if (!text && !pendingImageBase64) return;
    if (!currentChatWith) return;
    const messageText = pendingImageBase64 || text;
    textInput.value = '';
    cancelImage();
    try {
        await fetch(`${API_BASE}/chat/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ senderEmail: activeUser, receiverEmail: currentChatWith, messageText })
        });
        _lastRenderedKey = ''; // reset cache เพื่อให้แสดงข้อความใหม่ทันที
        await renderMessages();
        await loadContactList();
    } catch (err) { console.error('sendMessage error:', err); }
}

function handleImageSelect(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
        pendingImageBase64 = e.target.result;
        document.getElementById('imagePreview').src = pendingImageBase64;
        document.getElementById('imagePreviewContainer').style.display = 'flex';
    };
    reader.readAsDataURL(file);
}

function cancelImage() {
    pendingImageBase64 = null;
    document.getElementById('imageUploadInput').value = '';
    document.getElementById('imagePreviewContainer').style.display = 'none';
}

function escapeHtml(text) {
    if (!text) return '';
    return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function backToSidebar() {
    clearInterval(pollTimer);
    pollTimer = null;
    currentChatWith = '';
    document.getElementById('sidebar').classList.remove('hidden');
    document.getElementById('emptyChat').style.display = 'flex';
    document.getElementById('chatHeader').style.display = 'none';
    document.getElementById('chatMessages').style.display = 'none';
    document.getElementById('chatInputArea').style.display = 'none';
    loadContactList();
}
