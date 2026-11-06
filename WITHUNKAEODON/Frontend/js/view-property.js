var API_BASE = 'http://localhost:5000/api';

const TYPE_LABELS = { DORMITORY:'หอพัก/ห้องเช่า', APARTMENT:'อพาร์ตเมนต์', HOUSE:'บ้านเช่า', CONDO:'คอนโด' };

const ROOM_FAC_LABELS = {
    hasAirConditioner:'เครื่องปรับอากาศ', hasFan:'พัดลม',
    hasWaterHeater:'เครื่องทำน้ำอุ่น', hasCableTV:'เคเบิลทีวี',
    hasRefrigerator:'ตู้เย็น', hasInRoomWifi:'Wi-Fi ในห้อง',
    hasSofa:'โซฟา', hasWorkDeskChair:'โต๊ะทำงาน',
    hasStove:'เตาปรุงอาหาร', isPetAllowed:'อนุญาตสัตว์เลี้ยง',
    isSmokingAllowed:'อนุญาตสูบบุหรี่'
};
const BLDG_FAC_LABELS = {
    hasKeycardAccess:'คีย์การ์ด', hasFingerprintAccess:'ลายนิ้วมือ',
    hasSecurityGuard:'ยามรักษาความปลอดภัย', hasCCTV:'กล้อง CCTV',
    hasBikeParking:'ที่จอดมอเตอร์ไซค์', hasCarParking:'ที่จอดรถยนต์',
    hasSwimmingPool:'สระว่ายน้ำ', hasFitness:'ฟิตเนส',
    hasLaundry:'ร้านซักรีด', hasElevator:'ลิฟต์',
    hasShop:'ร้านค้า', hasRestaurant:'ร้านอาหาร',
    hasEvCharger:'สถานีชาร์จ EV'
};

const fmt = p => (p && parseFloat(p) > 0) ? `฿${Number(p).toLocaleString()}` : null;

function renderFacilities(facObj, labelMap, containerId) {
    const el = document.getElementById(containerId);
    if (!facObj) return;
    const active = Object.keys(labelMap).filter(k => facObj[k] == 1);
    el.innerHTML = active.length
        ? active.map(k => `<span class="amenity-tag">✓ ${labelMap[k]}</span>`).join('')
        : '<span style="color:#aaa;font-size:13px;">ไม่ระบุ</span>';
}

// ── Toggle Photos / Map ──────────────────────────────────
let viewLeafletMap = null;

function switchView(mode) {
    const photosEl = document.getElementById('viewPhotos');
    const mapEl    = document.getElementById('viewMap');
    const btnPhoto = document.getElementById('btnShowPhotos');
    const btnMap   = document.getElementById('btnShowMap');

    if (mode === 'photos') {
        photosEl.style.display = 'flex';
        mapEl.style.display    = 'none';
        btnPhoto.classList.add('active');
        btnMap.classList.remove('active');
    } else {
        photosEl.style.display = 'none';
        mapEl.style.display    = 'flex';
        btnPhoto.classList.remove('active');
        btnMap.classList.add('active');

        // สร้าง Leaflet map ตอน switch มาหน้าแผนที่ครั้งแรก
        const lat = window._viewPropLat;
        const lng = window._viewPropLng;
        // switchView map tab
        if (lat && lng && !viewLeafletMap) {
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    viewLeafletMap = createViewMap('leafletMapView', lat, lng, window._viewPropTitle);
                });
            });
        } else if (viewLeafletMap) {
            requestAnimationFrame(() => viewLeafletMap.invalidateSize());
        }
    }
}

// ── Carousel ─────────────────────────────────────────────
let images = [];
let currentIndex = 0;
let autoSlideTimer = null;

const AUTO_SLIDE_INTERVAL = 4000; // 4 วินาที

function startAutoSlide() {
    stopAutoSlide();
    if (images.length > 1) {
        autoSlideTimer = setInterval(() => carouselMove(1), AUTO_SLIDE_INTERVAL);
    }
}

function stopAutoSlide() {
    if (autoSlideTimer) { clearInterval(autoSlideTimer); autoSlideTimer = null; }
}

function buildGallery() {
    if (!images.length) return;
    const dotsEl  = document.getElementById('carouselDots');
    const counter = document.getElementById('carouselCounter');
    dotsEl.innerHTML = '';

    images.forEach((_, i) => {
        const dot = document.createElement('button');
        dot.className = 'dot' + (i === 0 ? ' active' : '');
        dot.onclick = (e) => { e.stopPropagation(); goToSlide(i); startAutoSlide(); };
        dotsEl.appendChild(dot);
    });

    if (images.length <= 1) {
        document.querySelector('.carousel-prev').style.display = 'none';
        document.querySelector('.carousel-next').style.display = 'none';
        dotsEl.style.display = 'none';
        document.getElementById('carouselCounter').style.display = 'none';
    }

    goToSlide(0);
    startAutoSlide();
}

function goToSlide(index) {
    const mainImg = document.getElementById('mainImg');
    const dotsEl  = document.getElementById('carouselDots');
    const counter = document.getElementById('carouselCounter');
    if (!images.length) return;

    currentIndex = ((index % images.length) + images.length) % images.length;

    mainImg.style.opacity = '0';
    setTimeout(() => {
        mainImg.src = images[currentIndex];
        mainImg.onerror = () => { mainImg.src = 'https://placehold.co/700x440/eee/999?text=No+Photo'; };
        mainImg.style.opacity = '1';
    }, 150);

    dotsEl.querySelectorAll('.dot').forEach((d, i) => {
        d.classList.toggle('active', i === currentIndex);
    });

    counter.innerText = `${currentIndex + 1} / ${images.length}`;
}

function carouselMove(dir) {
    goToSlide(currentIndex + dir);
    // หยุด auto แล้วรีสตาร์ทนับใหม่ (ป้องกันกระตุก)
    startAutoSlide();
}

document.addEventListener('keydown', e => {
    if (document.getElementById('viewPhotos')?.style.display === 'none') return;
    if (e.key === 'ArrowLeft')  { carouselMove(-1); }
    if (e.key === 'ArrowRight') { carouselMove(1);  }
});

// หยุด auto เมื่อ user hover ที่ carousel
document.addEventListener('DOMContentLoaded', () => {
    const carousel = document.querySelector('.carousel');
    if (carousel) {
        carousel.addEventListener('mouseenter', stopAutoSlide);
        carousel.addEventListener('mouseleave', startAutoSlide);
    }
});

// ── Init ─────────────────────────────────────────────────
window.onload = async function () {
    const urlParams  = new URLSearchParams(window.location.search);
    const propertyId = urlParams.get('id');
    const activeUser = localStorage.getItem('activeUser');

    if (!propertyId) {
        showBlockedOverlay('ไม่ระบุ ID ที่พัก', 'กรุณาเลือกประกาศจากหน้าหลัก');
        return;
    }

    try {
        // ── ส่ง viewerEmail เพื่อให้เจ้าของดูประกาศที่ซ่อนของตัวเองได้ ──
        const viewerParam = activeUser
            ? `?viewerEmail=${encodeURIComponent(activeUser)}`
            : '';
        const res    = await fetch(`${API_BASE}/properties/${propertyId}${viewerParam}`);

        // ── จัดการ 404 / 403 / ประกาศถูกปิด ──────────────────────────────
        if (res.status === 404 || res.status === 403) {
            const errData = await res.json().catch(() => ({}));
            if (errData.blocked) {
                showBlockedOverlay(
                    'ประกาศนี้ถูกปิดการมองเห็น',
                    'เจ้าของประกาศได้ปิดการมองเห็นไว้ หรือประกาศถูกลบออกจากระบบแล้ว'
                );
            } else {
                showBlockedOverlay(
                    'ไม่พบประกาศนี้',
                    errData.message || 'ประกาศอาจถูกลบหรือลิงก์ไม่ถูกต้อง'
                );
            }
            return;
        }

        const result = await res.json();
        if (!result.success) {
            showBlockedOverlay('เกิดข้อผิดพลาด', result.message || 'ไม่สามารถโหลดข้อมูลได้');
            return;
        }
        const p = result.data;

        // ปุ่มแก้ไข + ทักแชท (อยู่ใน shared-header ซึ่ง render แบบ async)
        // รอให้ element พร้อมก่อน set
        const setHeaderBtns = (p) => {
            const editBtn = document.getElementById('editBtn');
            const chatBtn = document.getElementById('chatBtn');
            if (editBtn && activeUser && activeUser === p.ownerEmail) {
                editBtn.style.display = 'inline-block';
                editBtn.href = `edit-property.html?id=${p.propertyId}`;
            }
            if (chatBtn) chatBtn.href = `chat.html?user=${p.ownerEmail}&propertyId=${p.propertyId}`;
        };
        // ลอง set ทันที ถ้ายังไม่มีให้ retry
        setHeaderBtns(p);
        setTimeout(() => setHeaderBtns(p), 300);
        setTimeout(() => setHeaderBtns(p), 800);

        // ชื่อ + badge
        document.getElementById('viewName').innerText      = p.title || '-';
        document.getElementById('viewTypeBadge').innerText = TYPE_LABELS[p.propertyType] || p.propertyType;

        // ── ปุ่มแก้ไขประกาศ (เฉพาะเจ้าของ) ─────────────────────
        const editPropertyBtn = document.getElementById('editPropertyBtn');
        if (editPropertyBtn && activeUser && activeUser === p.ownerEmail) {
            editPropertyBtn.href = `edit-property.html?id=${p.propertyId}`;
            editPropertyBtn.style.display = 'inline-flex';
        }

        // ราคา
        const priceBlock = document.getElementById('priceBlock');
        const prices = [
            { label:'รายเดือน', val: fmt(p.priceMonthly),  unit:'/เดือน' },
            { label:'รายวัน',   val: fmt(p.priceDaily),    unit:'/วัน'   },
            { label:'รายปี',    val: fmt(p.priceYearly),   unit:'/ปี'    },
            { label:'รายเทอม',  val: fmt(p.priceSemester), unit:'/เทอม'  },
        ].filter(x => x.val);
        if (prices.length) {
            priceBlock.innerHTML = prices.map(x => `
                <div class="price-item">
                    <div class="label">${x.label}</div>
                    <div class="value">${x.val}<span style="font-size:12px;font-weight:400;color:#888;">${x.unit}</span></div>
                </div>`).join('');
        } else {
            priceBlock.innerHTML = '<span style="color:#aaa;font-size:13px;">ไม่ระบุราคา</span>';
        }

        // รายละเอียด
        document.getElementById('viewTypeTxt').innerText    = TYPE_LABELS[p.propertyType] || p.propertyType || '-';
        document.getElementById('viewArea').innerText       = p.roomSize  > 0 ? `${p.roomSize} ตร.ม.`  : '-';
        document.getElementById('viewRooms').innerText      = p.bedrooms  > 0 ? `${p.bedrooms} ห้อง`   : '-';
        document.getElementById('viewBeds').innerText       = p.bathrooms > 0 ? `${p.bathrooms} ห้อง`  : '-';
        document.getElementById('viewBedCount').innerText   = p.bedCount  > 0 ? `${p.bedCount} เตียง`  : '-';
        document.getElementById('viewBedSize').innerText    = p.bedSize   ?     `${p.bedSize} ฟุต`      : '-';
        document.getElementById('viewProvince').innerText   = p.province    || '-';
        document.getElementById('viewDistrict').innerText   = p.district    || '-';
        document.getElementById('viewSubdistrict').innerText = p.subdistrict || '-';
        document.getElementById('viewAddress').innerText    = p.addressDetail || '-';

        // ที่อยู่ใน col-left
        const addr = [p.addressDetail, p.subdistrict ? 'ต.'+p.subdistrict : '', p.district ? 'อ.'+p.district : '', p.province ? 'จ.'+p.province : ''].filter(Boolean).join(' ');
        document.getElementById('viewAddressText').innerText = addr || '-';

        // แผนที่ pin
        if (p.latitude && p.longitude) {
            const lat = parseFloat(p.latitude);
            const lng = parseFloat(p.longitude);
            if (!isNaN(lat) && !isNaN(lng) && (lat > 1 || lng > 1)) {
                // โหลด Leaflet แบบ lazy เมื่อ user กดแท็บแผนที่
                document.getElementById('viewAddressText').innerText = addr || '-';
                window._viewPropLat = lat;
                window._viewPropLng = lng;
                window._viewPropTitle = p.title;
            }
        } else {
            // ไม่มีพิกัด — ซ่อนปุ่มแผนที่
            document.getElementById('btnShowMap').style.display = 'none';
        }

        // สิ่งอำนวยความสะดวก
        renderFacilities(p.roomFacility,     ROOM_FAC_LABELS, 'viewRoomAmenities');
        renderFacilities(p.buildingFacility, BLDG_FAC_LABELS, 'viewBldgAmenities');

        // โพสต์อื่นของเจ้าของคนนี้
        loadOwnerOtherPosts(p.ownerEmail, p.propertyId);

        // รูปภาพ
        if (p.images && p.images.length > 0) {
            images = p.images.map(i => typeof i === 'string' ? i : i.imageUrl).filter(Boolean);
        }
        buildGallery();

        // เจ้าของ
        const owner = p.owner;
        if (owner) {
            const fullName = `${owner.firstName||''} ${owner.lastName||''}`.trim() || p.ownerEmail;
            document.getElementById('ownerName').innerText  = fullName;
            document.getElementById('ownerPhone').innerText = owner.phone ? `📞 ${owner.phone}` : '📞 -';
            if (owner.profileImage) document.getElementById('ownerPic').src = owner.profileImage;
        } else {
            document.getElementById('ownerName').innerText = p.ownerEmail;
        }

        // กดที่ card เจ้าของ → วาปไปหน้า owner-profile.html
        const ownerCard = document.getElementById('ownerProfileCard');
        if (ownerCard) {
            ownerCard.onclick = () => {
                window.location.href = `owner-profile.html?email=${encodeURIComponent(p.ownerEmail)}&propertyId=${p.propertyId}`;
            };
        }
        const chatBtn = document.getElementById('chatWithOwnerBtn');
        if (chatBtn) {
            if (activeUser && p.ownerEmail === activeUser) {
                chatBtn.style.display = 'none'; // เจ้าของดูโพสตัวเอง
            } else {
                // อ่าน activeUser ใหม่ทุกครั้งที่กด เพื่อรองรับ login ที่เกิดหลัง page load
                chatBtn.href = '#';
                chatBtn.onclick = (e) => {
                    e.preventDefault();
                    const currentUser = localStorage.getItem('activeUser');
                    if (!currentUser) {
                        if (typeof window.openLogin === 'function') {
                            window.openLogin();
                        } else {
                            window.location.href = `index.html?action=login`;
                        }
                    } else {
                        window.location.href = `chat.html?user=${p.ownerEmail}&propertyId=${p.propertyId}`;
                    }
                };
            }
        }

        // ── Favorite + Report buttons ─────────────────────────────
        if (activeUser && activeUser !== p.ownerEmail && activeUser !== 'admin') {
            let isFav = false;
            try {
                const favRes = await fetch(`${API_BASE}/favorites?email=${encodeURIComponent(activeUser)}`);
                const favResult = await favRes.json();
                if (favResult.success) {
                    isFav = favResult.data.some(f => f.propertyId == propertyId);
                }
            } catch (e) {}

            const favBtn = document.getElementById('favBtn');
            if (favBtn) {
                favBtn.innerText = isFav ? '❤️ บันทึกแล้ว' : '🤍 บันทึก';
                favBtn.style.background = isFav ? '#ffe0e0' : '#f5f0e6';
                favBtn.style.color = isFav ? '#c0392b' : '#8b7355';
                favBtn.onclick = async () => {
                    if (!isFav) {
                        await fetch(`${API_BASE}/favorites`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ email: activeUser, propertyId: parseInt(propertyId) })
                        });
                        isFav = true;
                        favBtn.innerText = '❤️ บันทึกแล้ว';
                        favBtn.style.background = '#ffe0e0';
                        favBtn.style.color = '#c0392b';
                    } else {
                        await fetch(`${API_BASE}/favorites`, {
                            method: 'DELETE',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ email: activeUser, propertyId: parseInt(propertyId) })
                        });
                        isFav = false;
                        favBtn.innerText = '🤍 บันทึก';
                        favBtn.style.background = '#f5f0e6';
                        favBtn.style.color = '#8b7355';
                    }
                };
                favBtn.style.display = 'inline-flex';
            }

            // ── Report button ─────────────────────────────────────
            const reportBtn = document.getElementById('reportBtn');
            if (reportBtn) {
                reportBtn.style.display = 'inline-flex';
                reportBtn.onclick = () => {
                    const safeTitle = (p.title || '').replace(/'/g, "\\'");
                    if (typeof openReportModal === 'function') {
                        openReportModal(p.propertyId, p.ownerEmail, safeTitle);
                    }
                };
            }
        }

        // รีวิว
        await loadReviews(propertyId);

    } catch (err) {
        console.error(err);
        showBlockedOverlay('ไม่สามารถโหลดข้อมูลได้', 'กรุณาตรวจสอบว่ารัน Backend อยู่');
    }
};

// ── เซ็นเซอร์ชื่อ แสดงแค่ตัวแรก + *** ─────────────────────
function censorName(name) {
    if (!name) return '***';
    // ถ้าเป็น email ให้เซ็นเซอร์ส่วน local
    if (name.includes('@')) {
        const [local, domain] = name.split('@');
        return local[0] + '***@' + domain;
    }
    // ถ้าเป็นชื่อ-นามสกุล
    const parts = name.trim().split(' ').filter(Boolean);
    if (parts.length === 1) {
        return parts[0][0] + '***';
    }
    return parts[0][0] + '*** ' + parts[1][0] + '***';
}

// ── Reviews ──────────────────────────────────────────────
async function loadReviews(propertyId) {
    const listEl    = document.getElementById('reviewList');
    const summaryEl = document.getElementById('reviewSummary');
    try {
        const res    = await fetch(`${API_BASE}/reviews/${propertyId}`);
        const result = await res.json();

        if (!result.success || result.data.length === 0) {
            listEl.innerHTML = '<p style="color:#aaa;font-size:13px;">ยังไม่มีรีวิว</p>';
            return;
        }

        const reviews  = result.data;
        const avg      = reviews.reduce((s,r) => s + r.ratingScore, 0) / reviews.length;
        const avgR     = Math.round(avg * 10) / 10;

        summaryEl.style.display = 'flex';
        document.getElementById('avgScore').innerText   = avgR.toFixed(1);
        document.getElementById('starDisplay').innerText = '★'.repeat(Math.round(avg)) + '☆'.repeat(5 - Math.round(avg));
        document.getElementById('reviewCount').innerText = `${reviews.length} รีวิว`;

        listEl.innerHTML = '';
        reviews.forEach(r => {
            const rawName = (r.reviewerName||'').trim() || r.userEmail;
            const name    = censorName(rawName);
            const stars   = '★'.repeat(r.ratingScore) + '☆'.repeat(5 - r.ratingScore);
            const dateStr = new Date(r.createdAt).toLocaleDateString('th-TH', { year:'numeric', month:'short', day:'numeric' });

            const card = document.createElement('div');
            card.className = 'review-card';
            card.innerHTML = `
                <div class="review-header">
                    <span class="review-name">👤 ${name}</span>
                    <span class="review-date">${dateStr}</span>
                </div>
                <div class="review-stars">${stars}</div>
                ${r.comment ? `<div class="review-comment">${r.comment}</div>` : ''}`;
            listEl.appendChild(card);
        });
    } catch (err) {
        console.error('loadReviews error:', err);
        listEl.innerHTML = '<p style="color:#aaa;font-size:13px;">ไม่สามารถโหลดรีวิวได้</p>';
    }
}

// ── Owner Modal ───────────────────────────────────────────
function openOwnerModal() {
    const owner = window._ownerData;
    const email = window._ownerEmail;
    const propId = window._propertyId;
    const activeUser = localStorage.getItem('activeUser');

    const fullName = owner
        ? (`${owner.firstName||''} ${owner.lastName||''}`.trim() || email)
        : email;

    // รูป
    const pic = document.getElementById('modalOwnerPic');
    pic.src = (owner && owner.profileImage) ? owner.profileImage : 'https://placehold.co/90?text=U';

    // ชื่อ + email
    document.getElementById('modalOwnerName').innerText  = fullName;
    document.getElementById('modalOwnerEmail').innerText = email;

    // รายละเอียดติดต่อ
    const detailsEl = document.getElementById('modalOwnerDetails');
    detailsEl.innerHTML = '';

    const addRow = (icon, label, value, color) => {
        if (!value) return;
        const row = document.createElement('div');
        row.style.cssText = 'display:flex; align-items:center; gap:10px; font-size:14px;';
        row.innerHTML = `
            <span style="font-size:18px; width:28px; text-align:center;">${icon}</span>
            <div>
                <div style="font-size:11px; color:#aaa; font-weight:500;">${label}</div>
                <div style="font-size:14px; font-weight:600; color:${color || '#4a3f35'};">${value}</div>
            </div>`;
        detailsEl.appendChild(row);
    };

    addRow('📞', 'เบอร์โทรศัพท์', owner?.phone, '#4a3f35');
    addRow('💬', 'Line ID', owner?.lineId, '#06C755');
    addRow('📘', 'Facebook', owner?.facebook, '#1877F2');

    if (!detailsEl.children.length) {
        detailsEl.innerHTML = '<div style="color:#aaa; font-size:13px; text-align:center;">ไม่มีข้อมูลติดต่อเพิ่มเติม</div>';
    }

    // ปุ่มแชท
    const chatBtn = document.getElementById('modalChatBtn');
    if (activeUser && activeUser === email) {
        chatBtn.style.display = 'none';
    } else {
        chatBtn.style.display = 'flex';
        chatBtn.onclick = (e) => {
            e.preventDefault();
            if (!activeUser) {
                closeOwnerModal();
                if (window.openLogin) window.openLogin();
            } else {
                window.location.href = `chat.html?user=${email}&propertyId=${propId}`;
            }
        };
    }

    document.getElementById('ownerModal').style.display = 'flex';
}

function closeOwnerModal() {
    document.getElementById('ownerModal').style.display = 'none';
}

// กด backdrop ปิด modal
document.addEventListener('click', (e) => {
    const modal = document.getElementById('ownerModal');
    if (modal && e.target === modal) closeOwnerModal();
});

// ════════════════════════════════════════════════════════
// โพสต์อื่นของเจ้าของคนนี้
// ════════════════════════════════════════════════════════

async function loadOwnerOtherPosts(ownerEmail, currentPropertyId) {
    const section = document.getElementById('ownerPostsSection');
    const bar     = document.getElementById('ownerPostsBar');
    try {
        const res    = await fetch(`${API_BASE}/groups/by-property/${currentPropertyId}`);
        const result = await res.json();

        if (!result.success || !result.data.length) return;

        section.style.display = 'block';

        // สร้าง pill ของโพสต์ปัจจุบัน (active) + โพสต์อื่นในกลุ่ม
        // โพสต์ปัจจุบันอยู่ซ้ายสุด highlight เสมอ
        const currentTitle = document.getElementById('viewName').innerText || 'ประกาศนี้';
        const groupName    = result.groupName || null;

        let html = '';

        // label ชื่อกลุ่ม (ถ้ามี)
        if (groupName) {
            html += `<span class="group-pill-label">${groupName}</span>`;
        }

        // pill ปัจจุบัน (active — ไม่ clickable)
        html += `<span class="group-pill group-pill--active" title="${currentTitle}">${currentTitle}</span>`;

        // pill โพสต์อื่น
        result.data.forEach(p => {
            html += `
                <button class="group-pill group-pill--other"
                    title="${p.title}"
                    onclick="window.location.href='view-property.html?id=${p.propertyId}'">
                    ${p.title}
                </button>`;
        });

        bar.innerHTML = html;

    } catch (err) {
        console.error('loadOwnerOtherPosts error:', err);
    }
}

// ══════════════════════════════════════════════════════════
// Blocked / Not-Found Overlay
// แสดงหน้าแจ้งเตือนเมื่อประกาศถูกปิดหรือไม่พบ
// พร้อม countdown redirect กลับหน้าหลักอัตโนมัติ 4 วินาที
// ══════════════════════════════════════════════════════════
function showBlockedOverlay(title, message) {
    // ซ่อน content หลักทั้งหมดก่อน (ป้องกัน layout flash)
    const container = document.getElementById('detailContainer');
    if (container) container.style.display = 'none';

    // สร้าง overlay ถ้ายังไม่มี
    if (document.getElementById('_blockedOverlay')) return;

    // inject keyframe animation ครั้งเดียว
    if (!document.getElementById('_blockedStyle')) {
        const s = document.createElement('style');
        s.id = '_blockedStyle';
        s.textContent = `
            @keyframes _blockedFadeIn {
                from { opacity:0; transform:translateY(18px); }
                to   { opacity:1; transform:translateY(0); }
            }
        `;
        document.head.appendChild(s);
    }

    const overlay = document.createElement('div');
    overlay.id = '_blockedOverlay';
    overlay.style.cssText = [
        'position:fixed', 'inset:0',
        'background:linear-gradient(135deg,#faf8f5 0%,#f0ece5 100%)',
        'z-index:99999',
        'display:flex', 'flex-direction:column',
        'align-items:center', 'justify-content:center',
        'padding:24px', 'font-family:Sarabun,Prompt,sans-serif',
    ].join(';');

    overlay.innerHTML = `
        <div style="
            background:white;
            border-radius:18px;
            padding:40px 48px;
            max-width:480px;
            width:100%;
            text-align:center;
            box-shadow:0 8px 40px rgba(0,0,0,0.10);
            border:1px solid #ece8e1;
            animation:_blockedFadeIn 0.35s ease;
        ">
            <div style="font-size:58px;margin-bottom:16px;line-height:1;">🔒</div>
            <h2 style="
                margin:0 0 10px;
                font-size:22px;
                font-weight:700;
                color:#2b3a4a;
            ">${title}</h2>
            <p style="
                margin:0 0 28px;
                font-size:15px;
                color:#888;
                line-height:1.6;
            ">${message}</p>
            <div style="
                display:inline-block;
                background:#fef3c7;
                border:1px solid #fde68a;
                border-radius:8px;
                padding:8px 18px;
                font-size:13px;
                color:#92400e;
                margin-bottom:24px;
            ">
                ↩ กำลังพากลับหน้าหลักใน <strong id="_blockedCountdown">4</strong> วินาที...
            </div>
            <br>
            <a href="index.html" style="
                display:inline-block;
                background:#8b7355;
                color:white;
                text-decoration:none;
                padding:11px 28px;
                border-radius:9px;
                font-size:15px;
                font-weight:600;
                transition:background 0.15s;
            "
            onmouseover="this.style.background='#6b5740'"
            onmouseout="this.style.background='#8b7355'">
                🏠 กลับหน้าหลักเดี๋ยวนี้
            </a>
        </div>
    `;
    document.body.appendChild(overlay);

    // countdown 4 → 3 → 2 → 1 → redirect
    let seconds = 4;
    const tick = setInterval(() => {
        seconds--;
        const el = document.getElementById('_blockedCountdown');
        if (el) el.textContent = seconds;
        if (seconds <= 0) {
            clearInterval(tick);
            window.location.href = 'index.html';
        }
    }, 1000);
}
