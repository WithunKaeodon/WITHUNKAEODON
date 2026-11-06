let uploadedImagesArray = [];
let geoData = [];
let addMap  = null;

// Thai collator สำหรับเรียงลำดับตามหลักพจนานุกรมราชบัณฑิตยสถาน
const thaiCollator = new Intl.Collator('th', { sensitivity: 'base', usage: 'sort' });

// ════════════════════════════════════════
// Geography cascade
// ════════════════════════════════════════
async function loadGeoData() {
    try {
        const res = await fetch('thailand-geography.json');
        geoData   = await res.json();
        geoData.sort((a, b) => thaiCollator.compare(a.name_th, b.name_th));
        const sel = document.getElementById('locProvince');
        geoData.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.name_th; opt.text = p.name_th;
            sel.appendChild(opt);
        });
    } catch (e) { console.error('โหลดจังหวัดไม่ได้:', e); }
}

function onProvinceChange() {
    const pName   = document.getElementById('locProvince').value;
    const amphSel = document.getElementById('locAmphur');
    const tambSel = document.getElementById('locTambon');
    amphSel.innerHTML = '<option value="">-- เลือกอำเภอ/เขต --</option>';
    tambSel.innerHTML = '<option value="">-- เลือกตำบล/แขวง --</option>';
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
    const pName   = document.getElementById('locProvince').value;
    const aName   = document.getElementById('locAmphur').value;
    const tambSel = document.getElementById('locTambon');
    tambSel.innerHTML = '<option value="">-- เลือกตำบล/แขวง --</option>';
    tambSel.disabled  = true;
    if (!pName || !aName) return;
    const prov = geoData.find(p => p.name_th === pName);
    if (!prov) return;
    // fuzzy match อำเภอ — เผื่อชื่อไม่ตรงพอดี
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

// ════════════════════════════════════════
// Custom Popup
// ════════════════════════════════════════
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
            <button class="btn-popup btn-popup-cancel"  id="popupCancelBtn">ยกเลิก</button>
            <button class="btn-popup btn-popup-danger"  id="popupConfirmBtn">ยืนยัน</button>`;
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
    const ok = await customConfirm('ยกเลิก', 'ข้อมูลที่กรอกไว้จะหายทั้งหมด ต้องการกลับหรือไม่?', '⚠️');
    if (ok) window.location.href = 'index.html';
}

// ════════════════════════════════════════
// Init
// ════════════════════════════════════════
window.onload = async function () {
    const activeUser = localStorage.getItem('activeUser');
    if (!activeUser) {
        await customAlert('ปฏิเสธการเข้าถึง', 'กรุณาเข้าสู่ระบบก่อนดำเนินการ', '🔒');
        window.location.href = 'index.html'; return;
    }
    await loadGeoData();
};

// ════════════════════════════════════════
// Images
// ════════════════════════════════════════
function handleImageUpload(event) {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (!files.length) return;

    files.forEach(file => {
        const reader  = new FileReader();
        reader.onload = e => {
            uploadedImagesArray.push(e.target.result);
            renderPreviews();
        };
        reader.readAsDataURL(file);
    });
}

function renderPreviews() {
    const grid    = document.getElementById('imagePreviews');
    const clearBtn = document.getElementById('clearImagesBtn');
    grid.innerHTML = '';

    uploadedImagesArray.forEach((b64, idx) => {
        const img = document.createElement('img');
        img.src   = b64;
        img.title = `รูปที่ ${idx + 1} — คลิกเพื่อลบ`;
        img.style.cursor = 'pointer';
        img.onclick = () => removeSingleImage(idx);
        grid.appendChild(img);
    });

    clearBtn.style.display = uploadedImagesArray.length ? 'inline-block' : 'none';
}

async function removeSingleImage(idx) {
    const ok = await customConfirm('ลบรูปภาพ', 'ต้องการลบรูปนี้ใช่หรือไม่?', '🗑️');
    if (!ok) return;
    uploadedImagesArray.splice(idx, 1);
    renderPreviews();
}

function clearImages() {
    uploadedImagesArray = [];
    renderPreviews();
}

// ════════════════════════════════════════
// Map (Leaflet)
// ════════════════════════════════════════
function openPinMapModal() {
    const modal = document.getElementById('mapModal');
    modal.style.display = 'flex';
    _initModalProvince();

    // รอให้ modal layout เสร็จก่อน init แผนที่ (requestAnimationFrame x2 ดีกว่า setTimeout เดิม)
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            const existingLng = parseFloat(document.getElementById('mapPinX').value) || null;
            const existingLat = parseFloat(document.getElementById('mapPinY').value) || null;
            const hasPin = !!(existingLat && existingLng);

            if (addMap) {
                // แผนที่มีอยู่แล้ว — setView กลับไปตำแหน่งเดิม (ถ้ามี) แล้ว invalidateSize
                if (hasPin) {
                    addMap.map.setView([existingLat, existingLng], 15);
                }
                addMap.map.invalidateSize();
                setTimeout(() => addMap.map?.invalidateSize(), 200);
                setTimeout(() => addMap.map?.invalidateSize(), 500);
                return;
            }

            // สร้างแผนที่ใหม่
            addMap = createPinMap('leafletMapAdd', existingLat, existingLng, onPinPlaced);

            // invalidateSize ทันที + หลายรอบ เพื่อแก้ปัญหา Desktop render ขาว
            addMap?.map.invalidateSize();
            setTimeout(() => addMap?.map.invalidateSize(), 200);
            setTimeout(() => addMap?.map.invalidateSize(), 600);

            // เพิ่มปุ่ม Geolocation + auto-locate (เฉพาะครั้งแรก ถ้าไม่มีพิกัดเดิม)
            // delay เล็กน้อยให้ tile โหลดก่อน
            if (typeof initPinMapGeolocation === 'function') {
                setTimeout(() => initPinMapGeolocation(addMap, onPinPlaced, hasPin), 400);
            }
        });
    });
}

// ── Modal cascade dropdown ───────────────
function _initModalProvince() {
    const sel = document.getElementById('modalProvince');
    if (!sel || sel.options.length > 1) return; // โหลดแล้ว
    const sortedGeo = [...geoData].sort((a, b) => thaiCollator.compare(a.name_th, b.name_th));
    sortedGeo.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.name_th; opt.text = p.name_th;
        sel.appendChild(opt);
    });
}

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
    // geocode จังหวัด → เลื่อนแผนที่ไป
    _geocodeAndFly(pName + ' ประเทศไทย');
}

function onModalAmphurChange() {
    const pName   = document.getElementById('modalProvince').value;
    const aName   = document.getElementById('modalAmphur').value;
    const tambSel = document.getElementById('modalTambon');
    tambSel.innerHTML = '<option value="">ตำบล / แขวง</option>';
    tambSel.disabled = true;
    if (!pName || !aName) return;
    const prov = geoData.find(p => p.name_th === pName);
    const dist = prov?.districts?.find(d => d.name_th === aName);
    if (!dist?.sub_districts) return;
    const sortedSubs = [...dist.sub_districts].sort((a, b) => thaiCollator.compare(a.name_th, b.name_th));
    sortedSubs.forEach(t => {
        const opt = document.createElement('option');
        opt.value = t.name_th; opt.text = t.name_th;
        tambSel.appendChild(opt);
    });
    tambSel.disabled = false;
    _geocodeAndFly(aName + ' ' + pName + ' ประเทศไทย');
}

function onModalTambonChange() {
    const pName = document.getElementById('modalProvince').value;
    const aName = document.getElementById('modalAmphur').value;
    const tName = document.getElementById('modalTambon').value;
    if (!tName) return;
    _geocodeAndFly(tName + ' ' + aName + ' ' + pName + ' ประเทศไทย');
}

async function _geocodeAndFly(query) {
    try {
        const results = await geocodeSearch(query);
        if (!results.length) return;
        const lat = parseFloat(results[0].lat);
        const lng = parseFloat(results[0].lon);
        if (addMap) {
            addMap.map.setView([lat, lng], 13);
            addMap.setMarker(lat, lng);
            document.getElementById('mapPinX').value = lng;
            document.getElementById('mapPinY').value = lat;
        }
    } catch (e) { console.error('_geocodeAndFly:', e); }
}

async function onPinPlaced(lat, lng) {
    document.getElementById('mapPinX').value = lng;
    document.getElementById('mapPinY').value = lat;
    document.getElementById('pinStatus').innerText     = '📍 กำลังดึงที่อยู่...';
    document.getElementById('pinStatus').style.display = 'block';
    try {
        const addr = await reverseGeocode(lat, lng);
        await setLocationValuesFromPin(addr.province, addr.district, addr.subdistrict);
        document.getElementById('pinStatus').innerText =
            `✅ จ.${addr.province||'-'} อ.${addr.district||'-'} ต.${addr.subdistrict||'-'}`;
    } catch (e) {
        document.getElementById('pinStatus').innerText = '✅ ปักหมุดตำแหน่งแล้ว!';
    }
}

async function setLocationValuesFromPin(province, district, subdistrict) {
    if (geoData.length === 0) await loadGeoData();
    const provSel = document.getElementById('locProvince');
    const amphSel = document.getElementById('locAmphur');
    const tambSel = document.getElementById('locTambon');

    // ── helper: fuzzy match ชื่อ (ตัดคำนำหน้าและ trim) ──────────────
    function normalize(s) {
        return (s || '').replace(/^(จังหวัด|อำเภอ|เขต|ตำบล|แขวง|แม่แจ่ม)/, '').trim();
    }
    function findOption(sel, raw) {
        const n = normalize(raw).toLowerCase();
        return Array.from(sel.options).find(o => normalize(o.value).toLowerCase() === n);
    }

    // ── 1. จังหวัด ──────────────────────────────────────────────────
    if (province) {
        const normProv = normalize(province);
        provSel.value = normProv;
        if (!provSel.value) {
            // ลอง fuzzy จาก geoData
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

    // ── 2. อำเภอ ──────────────────────────────────────────────────
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

    // ── 3. ตำบล ──────────────────────────────────────────────────
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

function closePinMapModal() {
    document.getElementById('mapModal').style.display = 'none';
}

function savePinAndClose() {
    if (document.getElementById('mapPinY').value)
        document.getElementById('pinStatus').style.display = 'block';
    closePinMapModal();
}

// ════════════════════════════════════════
// Map search — debounced dropdown
// ════════════════════════════════════════
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
            resultsEl.innerHTML = '<p style="padding:10px 14px;color:#aaa;font-size:13px;">ไม่พบสถานที่</p>';
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
                if (addMap) addMap.setMarker(lat, lng);
                document.getElementById('mapPinX').value = lng;
                document.getElementById('mapPinY').value = lat;
                document.getElementById('mapSearchInput').value = r.display_name;
                resultsEl.style.display = 'none';
                onPinPlaced(lat, lng); // อัพเดต dropdown จังหวัด/อำเภอ/ตำบล
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

// ════════════════════════════════════════
// Submit → POST /api/properties
// ════════════════════════════════════════
async function submitProperty(event) {
    event.preventDefault();

    const activeUser = localStorage.getItem('activeUser');
    if (!activeUser) return;

    const roomAmenities = [...document.querySelectorAll('.room-amenity:checked')].map(cb => cb.value);
    const bldgAmenities = [...document.querySelectorAll('.bldg-amenity:checked')].map(cb => cb.value);

    const payload = {
        ownerEmail       : activeUser,
        title            : document.getElementById('propName').value,
        propertyType     : document.getElementById('propType').value,
        pinX             : document.getElementById('mapPinX').value || null,
        pinY             : document.getElementById('mapPinY').value || null,
        province         : document.getElementById('locProvince').value || '',
        district         : document.getElementById('locAmphur').value  || '',
        subdistrict      : document.getElementById('locTambon').value  || '',
        address          : document.getElementById('locAddress').value || '',
        priceDaily       : document.getElementById('priceDaily').value   || 0,
        priceMonthly     : document.getElementById('priceMonthly').value || 0,
        priceYearly      : document.getElementById('priceYearly').value  || 0,
        priceTerm        : document.getElementById('priceTerm').value    || 0,
        bedRooms         : document.getElementById('bedRooms').value  || 0,
        bathRooms        : document.getElementById('bathRooms').value || 0,
        areaSqm          : document.getElementById('areaSqm').value   || 0,
        bedCount         : document.getElementById('bedCount').value  || 0,
        bedSize          : document.getElementById('bedSize').value   || 0,
        roomAmenities    : roomAmenities,
        buildingAmenities: bldgAmenities,
        images           : uploadedImagesArray
    };

    try {
        const res = await fetch('http://localhost:5000/api/properties', {
            method  : 'POST',
            headers : { 'Content-Type': 'application/json' },
            body    : JSON.stringify(payload)
        });

        const ct = res.headers.get('content-type');
        if (!ct || !ct.includes('application/json')) {
            await customAlert('ข้อผิดพลาด', `Server ตอบผิดรูปแบบ (${res.status}) — ตรวจสอบว่ารัน Backend อยู่`, '❌');
            return;
        }

        const result = await res.json();
        if (result.success) {
            await customAlert('สำเร็จ', '🎉 ลงประกาศที่พักเรียบร้อยแล้ว!', '✅');
            window.location.href = 'index.html';
        } else {
            await customAlert('ข้อผิดพลาด', result.message || 'ไม่สามารถบันทึกได้', '❌');
        }
    } catch (err) {
        console.error(err);
        await customAlert('ข้อผิดพลาด', 'ไม่สามารถเชื่อมต่อ Backend ได้ กรุณาตรวจสอบว่ารัน node server.js', '❌');
    }
}
