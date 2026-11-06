var API_BASE   = 'http://localhost:5000/api';
const activeUser = localStorage.getItem('activeUser');

// Thai collator สำหรับเรียงลำดับตามหลักพจนานุกรมราชบัณฑิตยสถาน
const thaiCollator = new Intl.Collator('th', { sensitivity: 'base', usage: 'sort' });
let propertyIdToEdit = null;

let propertyOwnerEmail = null; // เก็บ ownerEmail จริงของที่พัก
let existingImages = [];
let newImages      = [];
let deleteImageIds = [];

const DB_TO_FORM = { DORMITORY: 'room', HOUSE: 'house', APARTMENT: 'apartment', CONDO: 'condo' };

const ROOM_COL_TO_VAL = {
    hasAirConditioner : 'เครื่องปรับอากาศ',
    hasFan            : 'พัดลม',
    hasWaterHeater    : 'เครื่องทำน้ำอุ่น',
    hasCableTV        : 'เคเบิลทีวี/ดาวเทียม',
    hasRefrigerator   : 'ตู้เย็น',
    hasInRoomWifi     : 'อินเทอร์เน็ตในห้อง (Wi-Fi)',
    hasSofa           : 'โซฟา',
    hasWorkDeskChair  : 'โต๊ะทำงาน',
    hasStove          : 'เตาปรุงอาหาร',
    isPetAllowed      : 'สัตว์เลี้ยง',
    isSmokingAllowed  : 'สูบบุหรี่'
};
const BLDG_COL_TO_VAL = {
    hasKeycardAccess    : 'คีย์การ์ด',
    hasFingerprintAccess: 'ลายนิ้วมือ',
    hasSecurityGuard    : 'รปภ',
    hasCCTV             : 'CCTV',
    hasBikeParking      : 'ที่จอดมอเตอร์ไซค์',
    hasCarParking       : 'ที่จอดรถยนต์',
    hasSwimmingPool     : 'สระว่ายน้ำ',
    hasFitness          : 'ฟิตเนส',
    hasLaundry          : 'ร้านซักรีด',
    hasElevator         : 'ลิฟต์',
    hasShop             : 'ร้านค้า',
    hasRestaurant       : 'ร้านอาหาร',
    hasEvCharger        : 'EV Charger'
};

// ----------------------------------------
// Geography cascade
// ----------------------------------------
let geoData = [];

async function loadGeoData() {
    try {
        const res = await fetch('thailand-geography.json');
        geoData   = await res.json();
        geoData.sort((a, b) => thaiCollator.compare(a.name_th, b.name_th));
        const sel = document.getElementById('locProvince');
        sel.innerHTML = '<option value="">-- เลือกจังหวัด --</option>';
        geoData.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.name_th; opt.text = p.name_th;
            sel.appendChild(opt);
        });
    } catch (e) { console.error('โหลดข้อมูลจังหวัดล้มเหลว:', e); }
}

function onProvinceChange() {
    const pName    = document.getElementById('locProvince').value;
    const amphSel  = document.getElementById('locAmphur');
    const tambSel  = document.getElementById('locTambon');
    amphSel.innerHTML = '<option value="">-- อำเภอ/เขต --</option>';
    tambSel.innerHTML = '<option value="">-- ตำบล/แขวง --</option>';
    amphSel.disabled  = true; tambSel.disabled = true;
    if (!pName) return;
    const prov = geoData.find(p => p.name_th === pName);
    if (!prov?.districts) return;
    const sortedDistricts = [...prov.districts].sort((a, b) => thaiCollator.compare(a.name_th, b.name_th));
    sortedDistricts.forEach(d => {
        const opt = document.createElement('option');
        opt.value = d.name_th; opt.text = d.name_th;
        amphSel.appendChild(opt);
    });
    amphSel.disabled = false;
}

function onAmphurChange() {
    const pName    = document.getElementById('locProvince').value;
    const aName    = document.getElementById('locAmphur').value;
    const tambSel  = document.getElementById('locTambon');
    tambSel.innerHTML = '<option value="">-- ตำบล/แขวง --</option>';
    tambSel.disabled  = true;
    if (!pName || !aName) return;
    const prov = geoData.find(p => p.name_th === pName);
    if (!prov) return;
    // fuzzy match อำเภอ
    const normA = aName.replace(/^(อำเภอ|เขต)/, '').trim().toLowerCase();
    const dist = prov.districts.find(d =>
        d.name_th === aName ||
        d.name_th.replace(/^(อำเภอ|เขต)/, '').trim().toLowerCase() === normA
    );
    if (!dist?.sub_districts) return;
    const sortedSubs = [...dist.sub_districts].sort((a, b) => thaiCollator.compare(a.name_th, b.name_th));
    sortedSubs.forEach(t => {
        const opt = document.createElement('option');
        opt.value = t.name_th; opt.text = t.name_th;
        tambSel.appendChild(opt);
    });
    tambSel.disabled = false;
}

async function setLocationValues(province, district, subdistrict) {
    if (geoData.length === 0) await loadGeoData();
    const provSel = document.getElementById('locProvince');
    const amphSel = document.getElementById('locAmphur');
    const tambSel = document.getElementById('locTambon');

    // helper: ตัดคำนำหน้าและ fuzzy match
    function normalize(s) {
        return (s || '').replace(/^(จังหวัด|อำเภอ|เขต|ตำบล|แขวง)/, '').trim();
    }
    function findOption(sel, raw) {
        const n = normalize(raw).toLowerCase();
        return Array.from(sel.options).find(o => normalize(o.value).toLowerCase() === n);
    }

    // 1. จังหวัด
    if (province) {
        const normProv = normalize(province);
        provSel.value = normProv;
        if (!provSel.value) {
            const found = geoData.find(p => normalize(p.name_th).toLowerCase() === normProv.toLowerCase());
            const useVal = found ? found.name_th : normProv;
            provSel.value = useVal;
            if (!provSel.value) {
                const opt = document.createElement('option');
                opt.value = useVal; opt.text = useVal;
                provSel.appendChild(opt); provSel.value = useVal;
            }
        }
        onProvinceChange();
        await new Promise(r => setTimeout(r, 50));
    }

    // 2. อำเภอ
    if (district) {
        const normDist = normalize(district);
        let opt = findOption(amphSel, normDist);
        if (opt) {
            amphSel.value = opt.value;
        } else {
            const newOpt = document.createElement('option');
            newOpt.value = normDist; newOpt.text = normDist;
            amphSel.appendChild(newOpt); amphSel.value = normDist;
        }
        amphSel.disabled = false;
        onAmphurChange();
        await new Promise(r => setTimeout(r, 50));
    }

    // 3. ตำบล
    if (subdistrict) {
        const normSub = normalize(subdistrict);
        let opt = findOption(tambSel, normSub);
        if (opt) {
            tambSel.value = opt.value;
        } else {
            const newOpt = document.createElement('option');
            newOpt.value = normSub; newOpt.text = normSub;
            tambSel.appendChild(newOpt); tambSel.value = normSub;
        }
        tambSel.disabled = false;
    }
}

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
            document.getElementById('customPopup').style.display = 'none'; resolve();
        };
    });
}

function customConfirm(title, message, icon = '❓') {
    return new Promise(resolve => {
        document.getElementById('popupIcon').innerText    = icon;
        document.getElementById('popupTitle').innerText   = title;
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

async function confirmGoBack() {
    const urlParams = new URLSearchParams(window.location.search);
    const fromAdmin = urlParams.get('from') === 'admin';
    const ok = await customConfirm('ออกโดยไม่บันทึก', 'ต้องการออกโดยไม่บันทึกการแก้ไขใช่หรือไม่?', '⚠️');
    if (ok) window.location.href = fromAdmin ? 'admin.html' : 'profile.html';
}

// ----------------------------------------
// Init
// ----------------------------------------
window.onload = async function () {
    document.getElementById('imgUpload').addEventListener('change', handleImageUpload);

    if (!activeUser) {
        await customAlert('ไม่ได้เข้าสู่ระบบ', 'กรุณาเข้าสู่ระบบก่อน', '🔒');
        window.location.href = 'index.html'; return;
    }
    const urlParams = new URLSearchParams(window.location.search);
    propertyIdToEdit = urlParams.get('id');
    if (!propertyIdToEdit) {
        await customAlert('ไม่พบข้อมูล', 'ไม่พบรหัสที่พักที่ต้องการแก้ไข', '❌');
        window.location.href = 'profile.html'; return;
    }

    await loadGeoData();
    await loadPropertyData();

    const sectionParam = urlParams.get('section');
    if (sectionParam) highlightReportSection(sectionParam);
};

// map section= -> element id
const SECTION_ID_MAP = {
    general             : 'section-general',
    images              : 'section-images',
    price               : 'section-price',
    contact             : 'section-contact',
    'room-amenities'    : 'section-room-amenities',
    'building-amenities': 'section-building-amenities'
};
const SECTION_LABEL = {
    general             : 'ข้อมูลทั่วไป / ที่ตั้ง',
    images              : 'รูปภาพ',
    price               : 'ราคา / ห้องพัก',
    contact             : 'ข้อมูลติดต่อ',
    'room-amenities'    : 'สิ่งอำนวยความสะดวกในห้อง',
    'building-amenities': 'สิ่งอำนวยความสะดวกส่วนกลาง'
};

function highlightReportSection(section) {
    const targetId = SECTION_ID_MAP[section] || 'section-general';
    const el = document.getElementById(targetId);
    if (!el) return;
    setTimeout(() => {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('section-flash');
        setTimeout(() => el.classList.remove('section-flash'), 3000);
        showFixBanner(section);
    }, 400);
}

function showFixBanner(section) {
    if (document.getElementById('fix-alert-banner')) return;
    const label  = SECTION_LABEL[section] || section;
    const banner = document.createElement('div');
    banner.id    = 'fix-alert-banner';
    banner.style.cssText = `
        position:fixed; top:70px; left:50%; transform:translateX(-50%);
        background:#fff3cd; border:1.5px solid #ffc107; border-radius:10px;
        padding:12px 20px; z-index:9999; font-family:'Prompt',sans-serif;
        font-size:14px; color:#7b5c00; box-shadow:0 4px 16px rgba(0,0,0,0.12);
        display:flex; align-items:center; gap:10px; max-width:90vw;
    `;
    banner.innerHTML = `
        <span style="font-size:20px;">📋</span>
        <span>Admin แนะนำให้แก้ไขส่วน <strong>${label}</strong></span>
        <button onclick="this.parentElement.remove()"
            style="background:none;border:none;cursor:pointer;font-size:18px;color:#aaa;margin-left:8px;">✕</button>
    `;
    document.body.appendChild(banner);
}

// ----------------------------------------
// Load property data
// ----------------------------------------
async function loadPropertyData() {
    try {
        const res    = await fetch(`${API_BASE}/properties/${propertyIdToEdit}`);
        const result = await res.json();
        if (!result.success) {
            await customAlert('เกิดข้อผิดพลาด', result.message, '❌');
            window.location.href = 'profile.html'; return;
        }
        const p = result.data;
        const isAdmin = activeUser === 'admin';
        if (p.ownerEmail !== activeUser && !isAdmin) {
            await customAlert('ไม่มีสิทธิ์', 'คุณไม่ใช่เจ้าของที่พักนี้', '🚫');
            window.location.href = 'profile.html'; return;
        }
        propertyOwnerEmail = p.ownerEmail; // เก็บ ownerEmail จริงไว้ใช้ตอน save

        document.getElementById('propName').value  = p.title || '';
        document.getElementById('propType').value  = DB_TO_FORM[p.propertyType] || '';
        await setLocationValues(p.province, p.district, p.subdistrict);
        document.getElementById('locAddress').value = p.addressDetail || '';

        if (p.longitude && p.latitude) {
            document.getElementById('mapPinX').value = p.longitude;
            document.getElementById('mapPinY').value = p.latitude;
            document.getElementById('pinStatus').style.display = 'block';
        }

        document.getElementById('priceDaily').value   = p.priceDaily    > 0 ? p.priceDaily    : '';
        document.getElementById('priceMonthly').value = p.priceMonthly  > 0 ? p.priceMonthly  : '';
        document.getElementById('priceYearly').value  = p.priceYearly   > 0 ? p.priceYearly   : '';
        document.getElementById('priceTerm').value    = p.priceSemester > 0 ? p.priceSemester : '';
        document.getElementById('areaSqm').value   = p.roomSize  > 0 ? p.roomSize  : '';
        document.getElementById('bedCount').value  = p.bedCount  > 0 ? p.bedCount  : '';
        document.getElementById('bedSize').value   = p.bedSize   || '';
        document.getElementById('bedRooms').value  = p.bedrooms  > 0 ? p.bedrooms  : '';
        document.getElementById('bathRooms').value = p.bathrooms > 0 ? p.bathrooms : '';

        if (p.roomFacility) {
            Object.keys(ROOM_COL_TO_VAL).forEach(col => {
                if (p.roomFacility[col] == 1) {
                    const cb = document.querySelector(`.room-amenity[value="${ROOM_COL_TO_VAL[col]}"]`);
                    if (cb) cb.checked = true;
                }
            });
        }
        if (p.buildingFacility) {
            Object.keys(BLDG_COL_TO_VAL).forEach(col => {
                if (p.buildingFacility[col] == 1) {
                    const cb = document.querySelector(`.bldg-amenity[value="${BLDG_COL_TO_VAL[col]}"]`);
                    if (cb) cb.checked = true;
                }
            });
        }

        existingImages = p.images
            ? p.images.map((url, idx) => ({ imageId: p.imageIds ? p.imageIds[idx] : null, imageUrl: url }))
            : [];
        await loadImageIds(propertyIdToEdit);

    } catch (err) {
        console.error('loadPropertyData error:', err);
        await customAlert('เกิดข้อผิดพลาด', 'โหลดข้อมูลไม่ได้ กรุณาตรวจสอบ Backend ด้วย', '❌');
    }
}

async function loadImageIds(propertyId) {
    try {
        const res    = await fetch(`${API_BASE}/properties/${propertyId}/images`);
        const result = await res.json();
        if (result.success) existingImages = result.data;
    } catch (e) { /* ไม่ block */ }
    renderImagePreviews();
}

// ----------------------------------------
// Map (Leaflet)
// ----------------------------------------
let editMap = null;

function openPinMapModal() {
    const modal = document.getElementById('mapModal');
    modal.style.display = 'flex';
    _initModalProvince();

    const existingLat = parseFloat(document.getElementById('mapPinY').value) || null;
    const existingLng = parseFloat(document.getElementById('mapPinX').value) || null;
    const hasPin = !!(existingLat && existingLng);

    // รอให้ modal layout เสร็จก่อน
    setTimeout(() => {
        if (editMap) {
            // แผนที่มีอยู่แล้ว — ทำ invalidateSize เพื่อแก้ขนาด container
            // แล้วย้ายหมุดไปพิกัดที่บันทึกไว้ปัจจุบัน (ถ้ามี)
            editMap.map.invalidateSize();
            setTimeout(() => {
                editMap.map.invalidateSize();
                if (hasPin) {
                    // setMarker: pan แผนที่ + ย้ายหมุดไปตำแหน่งที่บันทึกไว้
                    editMap.setMarker(existingLat, existingLng);
                }
            }, 200);
            setTimeout(() => editMap.map.invalidateSize(), 500);
            return;
        }

        // สร้างแผนที่ใหม่
        editMap = createPinMap('leafletMapEdit', existingLat, existingLng, onPinPlacedEdit);

        // invalidateSize หลัง tile โหลด — หลายรอบเพื่อแก้ขาวบน desktop
        setTimeout(() => editMap?.map.invalidateSize(), 200);
        setTimeout(() => editMap?.map.invalidateSize(), 600);

        // เพิ่มปุ่ม Geolocation + auto-locate เฉพาะครั้งแรก ถ้าไม่มีพิกัดเดิม
        if (typeof initPinMapGeolocation === 'function') {
            setTimeout(() => initPinMapGeolocation(editMap, onPinPlacedEdit, hasPin), 300);
        }
    }, 100);
}

// -- Modal cascade dropdown ---------------
function _initModalProvince() {
    const sel = document.getElementById('modalProvince');
    if (!sel || sel.options.length > 1) return;
    const sortedGeo = [...geoData].sort((a, b) => thaiCollator.compare(a.name_th, b.name_th));
    sortedGeo.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.name_th; opt.text = p.name_th;
        sel.appendChild(opt);
    });
}

// Flag ป้องกัน _geocodeAndFly ยิงตอน setModalLocationValues() update dropdown แบบ programmatic
// เซ็ต true ก่อน → อัปเดต dropdown → เซ็ต false หลัง เพื่อไม่ให้ map pan ทับ view ผู้ใช้
let _suppressMapFly = false;

function onModalProvinceChange() {
    const pName   = document.getElementById('modalProvince').value;
    const amphSel = document.getElementById('modalAmphur');
    const tambSel = document.getElementById('modalTambon');
    amphSel.innerHTML = '<option value="">อำเภอ / เขต</option>';
    tambSel.innerHTML = '<option value="">ตำบล / แขวง</option>';
    amphSel.disabled = true; tambSel.disabled = true;
    if (!pName) return;
    const prov = geoData.find(p => p.name_th === pName);
    if (!prov?.districts) return;
    const sortedDistricts = [...prov.districts].sort((a, b) => thaiCollator.compare(a.name_th, b.name_th));
    sortedDistricts.forEach(d => {
        const opt = document.createElement('option');
        opt.value = d.name_th; opt.text = d.name_th;
        amphSel.appendChild(opt);
    });
    amphSel.disabled = false;
    // ข้าม geocode ถ้าถูกเรียกจาก setModalLocationValues (programmatic)
    if (!_suppressMapFly) _geocodeAndFly(pName + ' ประเทศไทย');
}

function onModalAmphurChange() {
    const pName   = document.getElementById('modalProvince').value;
    const aName   = document.getElementById('modalAmphur').value;
    const tambSel = document.getElementById('modalTambon');
    tambSel.innerHTML = '<option value="">ตำบล / แขวง</option>';
    tambSel.disabled = true;
    if (!pName || !aName) return;
    const prov = geoData.find(p => p.name_th === pName);
    const normA = aName.replace(/^(อำเภอ|เขต)/, '').trim().toLowerCase();
    const dist = prov?.districts?.find(d =>
        d.name_th === aName ||
        d.name_th.replace(/^(อำเภอ|เขต)/, '').trim().toLowerCase() === normA
    );
    if (!dist?.sub_districts) return;
    const sortedSubs = [...dist.sub_districts].sort((a, b) => thaiCollator.compare(a.name_th, b.name_th));
    sortedSubs.forEach(t => {
        const opt = document.createElement('option');
        opt.value = t.name_th; opt.text = t.name_th;
        tambSel.appendChild(opt);
    });
    tambSel.disabled = false;
    // ข้าม geocode ถ้าถูกเรียกจาก setModalLocationValues (programmatic)
    if (!_suppressMapFly) _geocodeAndFly(aName + ' ' + pName + ' ประเทศไทย');
}

function onModalTambonChange() {
    const pName = document.getElementById('modalProvince').value;
    const aName = document.getElementById('modalAmphur').value;
    const tName = document.getElementById('modalTambon').value;
    if (!tName) return;
    // ตำบลผู้ใช้เลือกเองเสมอ (ไม่มี programmatic path) — geocode ได้ปกติ
    if (!_suppressMapFly) _geocodeAndFly(tName + ' ' + aName + ' ' + pName + ' ประเทศไทย');
}

async function _geocodeAndFly(query) {
    try {
        const results = await geocodeSearch(query);
        if (!results.length) return;
        const lat = parseFloat(results[0].lat);
        const lng = parseFloat(results[0].lon);
        if (!editMap) return;

        // ตรวจว่าผู้ใช้ปักหมุดไว้แล้วหรือยัง
        const savedLat = parseFloat(document.getElementById('mapPinY').value);
        const savedLng = parseFloat(document.getElementById('mapPinX').value);
        const hasUserPin = !isNaN(savedLat) && !isNaN(savedLng) && savedLat !== 0 && savedLng !== 0;

        if (hasUserPin) {
            // มีหมุดอยู่แล้ว — ไม่ทำอะไรกับ map เลย
            // คง viewport ไว้ตามที่ user กำลังดูอยู่
            // (dropdown เปลี่ยนเพื่อ label เท่านั้น ไม่ใช่เพื่อย้ายหมุด)
            return;
        } else {
            // ยังไม่มีหมุด — pan + วางหมุดที่ตำแหน่งผลลัพธ์
            editMap.map.setView([lat, lng], 13);
            editMap.setMarker(lat, lng);
            document.getElementById('mapPinX').value = lng;
            document.getElementById('mapPinY').value = lat;
        }
    } catch (e) { console.error('_geocodeAndFly:', e); }
}

async function onPinPlacedEdit(lat, lng) {
    document.getElementById('mapPinX').value = lng;
    document.getElementById('mapPinY').value = lat;
    document.getElementById('pinStatus').innerText     = '📍 กำลังโหลดที่อยู่...';
    document.getElementById('pinStatus').style.display = 'block';
    try {
        const addr = await reverseGeocode(lat, lng);

        // เซ็ต modal dropdowns (modalProvince/modalAmphur/modalTambon)
        await setModalLocationValues(addr.province, addr.district, addr.subdistrict);

        document.getElementById('pinStatus').innerText =
            `📍 จ.${addr.province||'-'} อ.${addr.district||'-'} ต.${addr.subdistrict||'-'}`;
    } catch (e) {
        document.getElementById('pinStatus').innerText = '❌ โหลดที่อยู่ไม่สำเร็จ!';
    }
}

async function setModalLocationValues(province, district, subdistrict) {
    if (geoData.length === 0) await loadGeoData();
    const provSel = document.getElementById('modalProvince');
    const amphSel = document.getElementById('modalAmphur');
    const tambSel = document.getElementById('modalTambon');
    if (!provSel) return;

    function normalize(s) {
        return (s || '').replace(/^(จังหวัด|อำเภอ|เขต|ตำบล|แขวง)/, '').trim();
    }
    function findOpt(sel, raw) {
        const n = normalize(raw).toLowerCase();
        return Array.from(sel.options).find(o => normalize(o.value).toLowerCase() === n);
    }

    // 1. จังหวัด
    if (province) {
        const norm = normalize(province);
        provSel.value = norm;
        if (!provSel.value) {
            const found = geoData.find(p => normalize(p.name_th).toLowerCase() === norm.toLowerCase());
            const useVal = found ? found.name_th : norm;
            if (!Array.from(provSel.options).find(o => o.value === useVal)) {
                const opt = document.createElement('option');
                opt.value = useVal; opt.text = useVal;
                provSel.appendChild(opt);
            }
            provSel.value = useVal;
        }
        _suppressMapFly = true;
        onModalProvinceChange();
        _suppressMapFly = false;
        await new Promise(r => setTimeout(r, 30));
    }

    // 2. อำเภอ
    if (district) {
        const norm = normalize(district);
        let opt = findOpt(amphSel, norm);
        if (opt) {
            amphSel.value = opt.value;
        } else {
            const newOpt = document.createElement('option');
            newOpt.value = norm; newOpt.text = norm;
            amphSel.appendChild(newOpt);
            amphSel.value = norm;
        }
        amphSel.disabled = false;
        _suppressMapFly = true;
        onModalAmphurChange();
        _suppressMapFly = false;
        await new Promise(r => setTimeout(r, 30));
    }

    // 3. ตำบล
    if (subdistrict) {
        const norm = normalize(subdistrict);
        let opt = findOpt(tambSel, norm);
        if (opt) {
            tambSel.value = opt.value;
        } else {
            const newOpt = document.createElement('option');
            newOpt.value = norm; newOpt.text = norm;
            tambSel.appendChild(newOpt);
            tambSel.value = norm;
        }
        tambSel.disabled = false;

        // sync กลับไปยัง locTambon (นอก modal) ด้วย
        await setLocationValues(
            document.getElementById('modalProvince').value,
            document.getElementById('modalAmphur').value,
            tambSel.value
        );
    }
}

function closePinMapModal() {
    document.getElementById('mapModal').style.display = 'none';
}

function savePinAndClose() {
    if (document.getElementById('mapPinY').value)
        document.getElementById('pinStatus').style.display = 'block';
    closePinMapModal();
}

// ----------------------------------------
// Map search - debounced dropdown
// ----------------------------------------
let _mapSearchTimer = null;

function onMapSearchInput(value) {
    clearTimeout(_mapSearchTimer);
    const resultsEl = document.getElementById('mapSearchResults');
    if (!value.trim()) { resultsEl.style.display = 'none'; resultsEl.innerHTML = ''; return; }
    resultsEl.style.display = 'block';
    resultsEl.innerHTML = '<p style="padding:10px 14px;color:#aaa;font-size:13px;">กำลังค้นหา...</p>';
    _mapSearchTimer = setTimeout(() => doMapSearch(value.trim()), 400);
}

async function doMapSearch(query) {
    const resultsEl = document.getElementById('mapSearchResults');
    try {
        const results = await geocodeSearch(query);
        resultsEl.innerHTML = '';
        if (!results.length) {
            resultsEl.innerHTML = '<p style="padding:10px 14px;color:#aaa;font-size:13px;">ไม่พบผลลัพธ์</p>';
            return;
        }
        results.forEach(r => {
            const div = document.createElement('div');
            div.style.cssText = 'padding:10px 14px; cursor:pointer; font-size:13px; font-family:Prompt,sans-serif; border-bottom:1px solid #f5f2ee; display:flex; align-items:flex-start; gap:8px;';
            div.innerHTML = `<span style="flex-shrink:0;color:#8b7355;margin-top:1px;">📍</span><span style="line-height:1.4;">${r.display_name}</span>`;
            div.onmouseover = () => { div.style.background = '#faf7f2'; };
            div.onmouseout  = () => { div.style.background = ''; };
            div.onclick = () => {
                const lat = parseFloat(r.lat), lng = parseFloat(r.lon);
                if (editMap) editMap.setMarker(lat, lng);
                document.getElementById('mapPinX').value = lng;
                document.getElementById('mapPinY').value = lat;
                document.getElementById('mapSearchInput').value = r.display_name;
                resultsEl.style.display = 'none';
                onPinPlacedEdit(lat, lng); // อัพเดต dropdown จังหวัด/อำเภอ/ตำบล
            };
            resultsEl.appendChild(div);
        });
    } catch (e) {
        resultsEl.innerHTML = '<p style="padding:10px 14px;color:red;font-size:13px;">เกิดข้อผิดพลาด</p>';
    }
}

async function searchMapLocation() {
    onMapSearchInput(document.getElementById('mapSearchInput')?.value || '');
}

// ----------------------------------------
// Images
// ----------------------------------------
function handleImageUpload(event) {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (!files.length) return;
    files.forEach(file => {
        const reader   = new FileReader();
        reader.onload  = e => { newImages.push(e.target.result); renderImagePreviews(); };
        reader.onerror = () => console.error('FileReader error:', file.name);
        reader.readAsDataURL(file);
    });
}

async function removeExistingImage(imageId) {
    const ok = await customConfirm('ลบรูป', 'ต้องการลบรูปภาพนี้ใช่หรือไม่?', '🗑️');
    if (!ok) return;
    if (imageId) deleteImageIds.push(imageId);
    existingImages = existingImages.filter(img => img.imageId !== imageId);
    renderImagePreviews();
}

async function removeNewImage(b64) {
    const ok = await customConfirm('ลบรูป', 'ต้องการลบรูปภาพนี้ใช่หรือไม่?', '🗑️');
    if (!ok) return;
    newImages = newImages.filter(img => img !== b64);
    renderImagePreviews();
}

function renderImagePreviews() {
    const grid = document.getElementById('imagePreviewGrid');
    while (grid.firstChild) grid.removeChild(grid.firstChild);

    existingImages.forEach(img => {
        const wrap = document.createElement('div'); wrap.className = 'preview-item';
        const image = document.createElement('img'); image.src = img.imageUrl;
        image.onerror = () => { image.src = 'https://placehold.co/80?text=Err'; };
        const btn = document.createElement('button');
        btn.type = 'button'; btn.className = 'remove-img-btn'; btn.innerText = '✕';
        btn.onclick = () => removeExistingImage(img.imageId);
        wrap.appendChild(image); wrap.appendChild(btn); grid.appendChild(wrap);
    });

    newImages.forEach(b64 => {
        const wrap = document.createElement('div');
        wrap.className = 'preview-item'; wrap.style.border = '2px solid #28a745';
        const image = document.createElement('img'); image.src = b64;
        const btn = document.createElement('button');
        btn.type = 'button'; btn.className = 'remove-img-btn'; btn.innerText = '✕';
        btn.onclick = () => removeNewImage(b64);
        const badge = document.createElement('span');
        badge.style.cssText = 'position:absolute;bottom:3px;left:3px;background:#28a745;color:#fff;font-size:9px;padding:1px 5px;border-radius:3px;pointer-events:none;';
        badge.innerText = 'ใหม่';
        wrap.appendChild(image); wrap.appendChild(btn); wrap.appendChild(badge); grid.appendChild(wrap);
    });

    if (!existingImages.length && !newImages.length) {
        const p = document.createElement('p');
        p.style.cssText = 'color:#aaa;grid-column:1/-1;text-align:center;padding:16px 0;font-size:13px;';
        p.innerText = 'ยังไม่มีรูปภาพ — กดปุ่มด้านบนเพื่อเพิ่มรูปภาพ';
        grid.appendChild(p);
    }
}

// ----------------------------------------
// Save -> PUT /api/properties/:id
// ----------------------------------------
async function saveProperty(event) {
    event.preventDefault();

    if (existingImages.length + newImages.length === 0) {
        await customAlert('ต้องมีรูปภาพ', 'กรุณาอัปโหลดรูปภาพอย่างน้อย 1 รูป', '⚠️');
        document.getElementById('section-images').scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
    }

    const ok = await customConfirm('บันทึกการแก้ไข', 'ต้องการบันทึกการเปลี่ยนแปลงทั้งหมดใช่หรือไม่?', '💾');
    if (!ok) return;

    const roomAmenities     = [...document.querySelectorAll('.room-amenity:checked')].map(cb => cb.value);
    const buildingAmenities = [...document.querySelectorAll('.bldg-amenity:checked')].map(cb => cb.value);

    const payload = {
        ownerEmail   : propertyOwnerEmail || activeUser,
        title        : document.getElementById('propName').value,
        propertyType : document.getElementById('propType').value,
        pinX         : document.getElementById('mapPinX').value || null,
        pinY         : document.getElementById('mapPinY').value || null,
        province     : document.getElementById('locProvince').value,
        district     : document.getElementById('locAmphur').value,
        subdistrict  : document.getElementById('locTambon').value,
        address      : document.getElementById('locAddress').value,
        priceDaily   : document.getElementById('priceDaily').value   || 0,
        priceMonthly : document.getElementById('priceMonthly').value || 0,
        priceYearly  : document.getElementById('priceYearly').value  || 0,
        priceTerm    : document.getElementById('priceTerm').value    || 0,
        areaSqm      : document.getElementById('areaSqm').value   || 0,
        bedCount     : document.getElementById('bedCount').value  || 0,
        bedSize      : document.getElementById('bedSize').value   || null,
        bedRooms     : document.getElementById('bedRooms').value  || 1,
        bathRooms    : document.getElementById('bathRooms').value || 1,
        roomAmenities, buildingAmenities,
        newImages, deleteImageIds
    };

    try {
        const res = await fetch(`${API_BASE}/properties/${propertyIdToEdit}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const ct = res.headers.get('content-type');
        if (!ct || !ct.includes('application/json')) {
            await customAlert('เกิดข้อผิดพลาด', `Server ตอบกลับผิดพลาด (${res.status})`, '❌'); return;
        }
        const result = await res.json();
        if (result.success) {
            const urlParams    = new URLSearchParams(window.location.search);
            const sectionParam = urlParams.get('section');
            const fromAdmin    = urlParams.get('from') === 'admin';
            if (sectionParam) {
                try {
                    await fetch(`${API_BASE}/reports/mark-done`, {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email: activeUser, propertyId: parseInt(propertyIdToEdit) })
                    });
                } catch (e) { /* ไม่ block */ }
            }
            await customAlert(
                'สำเร็จ',
                'บันทึกการแก้ไขเรียบร้อยแล้ว!' + (sectionParam ? '\n📋 แจ้ง Admin โดยอัตโนมัติแล้ว' : ''),
                '✅'
            );
            window.location.href = fromAdmin ? 'admin.html' : 'profile.html';
        } else {
            await customAlert('เกิดข้อผิดพลาด', result.message || 'ไม่สามารถบันทึกได้', '❌');
        }
    } catch (err) {
        console.error(err);
        await customAlert('เกิดข้อผิดพลาด', 'ไม่สามารถเชื่อมต่อ Backend ได้ กรุณารัน node server.js', '❌');
    }
}

// ════════════════════════════════════════════════════════
// END OF FILE
// ════════════════════════════════════════════════════════
