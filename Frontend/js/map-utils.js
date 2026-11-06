/**
 * map-utils.js — Leaflet + OpenStreetMap utilities
 */

// โหลด Leaflet CSS + JS — ถ้าโหลดไว้ใน <head> แล้วก็ callback ทันที
function loadLeaflet(cb) {
    if (window.L) { if (cb) cb(); return; }

    // โหลด CSS ก่อน
    if (!document.querySelector('link[href*="leaflet"]')) {
        const css = document.createElement('link');
        css.rel = 'stylesheet';
        css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(css);
    }

    const js = document.createElement('script');
    js.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    js.onload = () => { if (cb) cb(); };
    js.onerror = () => {
        const js2 = document.createElement('script');
        js2.src = 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js';
        js2.onload = () => { if (cb) cb(); };
        document.head.appendChild(js2);
    };
    document.head.appendChild(js);
}

/**
 * สร้างแผนที่ปักหมุด สำหรับ add/edit property
 */
function createPinMap(containerId, initLat, initLng, onPin) {
    const el = document.getElementById(containerId);
    if (!el) { console.error('Map container not found:', containerId); return null; }

    // Force height ให้ชัดเจนก่อน Leaflet init
    el.style.height = '400px';
    el.style.minHeight = '400px';
    el.style.display = 'block';

    const lat = (initLat && !isNaN(initLat)) ? initLat : 13.7563;
    const lng = (initLng && !isNaN(initLng)) ? initLng : 100.5018;
    const zoom = (initLat && !isNaN(initLat)) ? 15 : 11;

    const map = L.map(containerId, { zoomControl: true }).setView([lat, lng], zoom);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19
    }).addTo(map);

    let marker = null;

    if (initLat && initLng && !isNaN(initLat) && !isNaN(initLng)) {
        marker = L.marker([initLat, initLng], { draggable: true }).addTo(map);
        marker.bindPopup('ตำแหน่งที่พัก').openPopup();
        marker.on('dragend', () => {
            const pos = marker.getLatLng();
            if (onPin) onPin(pos.lat, pos.lng);
        });
    }

    map.on('click', (e) => {
        const { lat, lng } = e.latlng;
        // moveMarker: ย้ายหมุดตามจุดที่คลิก โดยไม่ pan/setView ใดๆ
        // ป้องกันหมุดวาร์ปกลับตำแหน่งเดิมทุกครั้งที่คลิก
        if (marker) {
            marker.setLatLng([lat, lng]);
        } else {
            marker = L.marker([lat, lng], { draggable: true }).addTo(map);
            marker.bindPopup('ตำแหน่งที่พัก');
            marker.on('dragend', () => {
                const pos = marker.getLatLng();
                if (onPin) onPin(pos.lat, pos.lng);
            });
        }
        marker.openPopup();
        if (onPin) onPin(lat, lng);
    });

    // invalidateSize หลัง render เพื่อแก้ปัญหาขาว
    setTimeout(() => map.invalidateSize(), 100);
    setTimeout(() => map.invalidateSize(), 400);

    /**
     * setMarker — ย้ายหมุด + pan แผนที่ไปหาหมุด
     * ใช้เมื่อต้องการ "บินไป" หาตำแหน่งนั้น (เช่น search, geolocation)
     */
    function setMarker(lat, lng) {
        if (isNaN(lat) || isNaN(lng)) return;
        if (marker) {
            marker.setLatLng([lat, lng]);
        } else {
            marker = L.marker([lat, lng], { draggable: true }).addTo(map);
            marker.on('dragend', () => {
                const pos = marker.getLatLng();
                if (onPin) onPin(pos.lat, pos.lng);
            });
        }
        map.setView([lat, lng], 15);
        setTimeout(() => map.invalidateSize(), 100);
    }

    /**
     * moveMarker — ย้ายหมุดเงียบๆ โดยไม่ pan แผนที่
     * ใช้เมื่อต้องการอัปเดตตำแหน่งหมุดโดยไม่รบกวน viewport ที่ user กำลังดูอยู่
     */
    function moveMarker(lat, lng) {
        if (isNaN(lat) || isNaN(lng)) return;
        if (marker) {
            marker.setLatLng([lat, lng]);
        } else {
            marker = L.marker([lat, lng], { draggable: true }).addTo(map);
            marker.on('dragend', () => {
                const pos = marker.getLatLng();
                if (onPin) onPin(pos.lat, pos.lng);
            });
        }
    }

    return { map, marker: () => marker, setMarker, moveMarker };
}

/**
 * Reverse Geocoding — แปลง lat/lng → จังหวัด อำเภอ ตำบล
 */
async function reverseGeocode(lat, lng) {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=th&zoom=18&addressdetails=1`;
    const res = await fetch(url, { headers: { 'User-Agent': 'OakStay-App/1.0' } });
    const data = await res.json();
    const addr = data.address || {};

    // log เพื่อ debug
    console.log('[reverseGeocode] raw:', addr);

    // ตรวจว่าเป็นกรุงเทพหรือไม่ (Nominatim ไม่มี state สำหรับกรุงเทพ)
    const isBangkok = !addr.state && !!addr.city && addr.city.includes('กรุงเทพ');

    // จังหวัด: กรุงเทพใช้ city, จังหวัดอื่นใช้ state
    const province = (addr.state || addr.province || addr.city || '')
        .replace(/^จังหวัด/, '').trim();

    // อำเภอ/เขต: กรุงเทพใช้ suburb (เขต...), จังหวัดอื่นใช้ county/city_district/district/town
    const district = isBangkok
        ? (addr.suburb || addr.city_district || '').replace(/^เขต/, '').trim()
        : (addr.county || addr.city_district || addr.district || addr.town || '').replace(/^อำเภอ/, '').replace(/^เขต/, '').trim();

    // ตำบล/แขวง: กรุงเทพใช้ quarter (แขวง...), จังหวัดอื่นใช้ subdistrict/suburb
    const subdistrict = isBangkok
        ? (addr.quarter || addr.subdistrict || addr.neighbourhood || '').replace(/^แขวง/, '').trim()
        : (addr.subdistrict || addr.suburb || addr.quarter || addr.neighbourhood || addr.residential || addr.village || addr.hamlet || '').replace(/^ตำบล/, '').replace(/^แขวง/, '').trim();

    const road = addr.road || addr.pedestrian || addr.path || '';

    console.log('[reverseGeocode] parsed:', { province, district, subdistrict });
    return { province, district, subdistrict, road, raw: addr };
}

/**
 * Geocoding search ด้วย Nominatim
 */
async function geocodeSearch(query) {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=th&limit=5&accept-language=th`;
    const res = await fetch(url, { headers: { 'User-Agent': 'OakStay-App/1.0' } });
    return await res.json();
}

/**
 * แผนที่แสดงผล (view-property) — read-only
 */
function createViewMap(containerId, lat, lng, title) {
    const el = document.getElementById(containerId);
    if (!el) return null;
    if (!el.style.height || el.style.height === '0px') el.style.height = '300px';

    const map = L.map(containerId).setView([lat, lng], 15);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19
    }).addTo(map);

    const marker = L.marker([lat, lng]).addTo(map);
    if (title) marker.bindPopup(`<b>${title}</b>`).openPopup();

    setTimeout(() => map.invalidateSize(), 100);
    setTimeout(() => map.invalidateSize(), 500);
    return map;
}

/**
 * แผนที่ค้นหา (index) — แสดง pin ที่พักทั้งหมด
 */
function createSearchMap(containerId, properties, onMarkerClick) {
    const el = document.getElementById(containerId);
    if (!el) return null;
    if (!el.style.height || el.style.height === '0px') el.style.height = '100%';

    const map = L.map(containerId).setView([13.7563, 100.5018], 6);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19
    }).addTo(map);

    let markerLayer = L.layerGroup().addTo(map);

    function buildMarkers(props) {
        markerLayer.clearLayers();
        const addedMarkers = [];
        props.forEach(p => {
            if (!p.latitude || !p.longitude) return;
            const lat = parseFloat(p.latitude);
            const lng = parseFloat(p.longitude);
            if (isNaN(lat) || isNaN(lng) || lat === 0) return;

            const price = p.priceMonthly > 0 ? `฿${Number(p.priceMonthly).toLocaleString()}/เดือน`
                        : p.priceDaily   > 0 ? `฿${Number(p.priceDaily).toLocaleString()}/วัน` : '';

            const coverImg = p.coverImage
                ? `<img src="${p.coverImage}" style="width:100%;height:80px;object-fit:cover;border-radius:6px;margin-bottom:6px;" onerror="this.style.display='none'">`
                : '';

            const typeLabels = { DORMITORY:'หอพัก', APARTMENT:'อพาร์ตเมนต์', HOUSE:'บ้านเช่า', CONDO:'คอนโด' };
            const typeName = typeLabels[p.propertyType] || '';

            const m = L.marker([lat, lng]).addTo(markerLayer);
            m.bindPopup(`
                <div style="font-family:Prompt,sans-serif;min-width:190px;max-width:220px;">
                    ${coverImg}
                    <b style="font-size:13px;display:block;margin-bottom:3px;">${p.title || '-'}</b>
                    ${typeName ? `<span style="font-size:11px;background:#f5f0e6;color:#8b7355;padding:2px 7px;border-radius:10px;">${typeName}</span><br>` : ''}
                    <span style="color:#e74c3c;font-weight:600;font-size:14px;">${price || 'ไม่ระบุราคา'}</span><br>
                    <span style="color:#888;font-size:12px;">📍 จ.${p.province || ''} ${p.district ? `อ.${p.district}` : ''}</span><br>
                    <a href="view-property.html?id=${p.propertyId}"
                       onclick="window.top.location.href='view-property.html?id=${p.propertyId}'; return false;"
                       style="display:inline-block;margin-top:6px;background:#8b7355;color:white;padding:5px 12px;border-radius:6px;font-size:12px;font-weight:600;text-decoration:none;">
                       👁️ ดูรายละเอียด
                    </a>
                </div>
            `, { maxWidth: 240 });
            if (onMarkerClick) m.on('click', () => onMarkerClick(p.propertyId));
            addedMarkers.push(m);
        });
        return addedMarkers;
    }

    const markers = buildMarkers(properties);

    if (markers.length > 0) {
        const group = L.featureGroup(markers);
        map.fitBounds(group.getBounds().pad(0.1));
    }

    setTimeout(() => map.invalidateSize(), 200);

    return {
        map,
        markers,
        // อัปเดต markers เมื่อ filter เปลี่ยน
        updateMarkers(newProps) {
            const newMarkers = buildMarkers(newProps);
            if (newMarkers.length > 0) {
                const group = L.featureGroup(newMarkers);
                map.fitBounds(group.getBounds().pad(0.15));
            } else {
                map.setView([13.7563, 100.5018], 6);
            }
            map.invalidateSize();
        }
    };
}

/**
 * initPinMapGeolocation — เพิ่มปุ่ม "ตำแหน่งของฉัน" บนแผนที่ปักหมุด
 * และดึงตำแหน่งอัตโนมัติเมื่อเปิด modal ครั้งแรก (ถ้ายังไม่มีพิกัดเดิม)
 */
function initPinMapGeolocation(pinMapInstance, onPin, hasExistingPin = false) {
    if (!pinMapInstance?.map) return;
    const map = pinMapInstance.map;

    // ── invalidateSize เพิ่มเติมเมื่อ modal เปิด (แก้ปัญหา desktop แสดงขาว) ──
    setTimeout(() => map.invalidateSize(), 150);
    setTimeout(() => map.invalidateSize(), 500);
    setTimeout(() => map.invalidateSize(), 1000);

    // ── สร้าง Custom Control ปุ่ม "ตำแหน่งของฉัน" ─────────────
    const MyLocationControl = L.Control.extend({
        options: { position: 'topleft' },
        onAdd() {
            const btn = L.DomUtil.create('button', 'leaflet-bar leaflet-control my-location-btn');
            btn.type      = 'button';
            btn.title     = 'ไปยังตำแหน่งของฉัน';
            btn.innerHTML = '📍';
            btn.style.cssText = [
                'width:36px', 'height:36px', 'background:white', 'border:none',
                'font-size:18px', 'cursor:pointer', 'border-radius:4px',
                'display:flex', 'align-items:center', 'justify-content:center',
                'box-shadow:0 1px 5px rgba(0,0,0,0.4)', 'transition:background 0.15s',
                'outline:none', '-webkit-user-select:none', 'user-select:none',
            ].join(';');
            btn.onmouseover = () => { btn.style.background = '#f5f0e6'; };
            btn.onmouseout  = () => { btn.style.background = 'white'; };

            // stopPropagation ป้องกัน click ทะลุไปที่ map
            L.DomEvent.disableClickPropagation(btn);
            L.DomEvent.on(btn, 'click', () => {
                _gotoMyLocation(pinMapInstance, onPin, btn);
            });
            return btn;
        }
    });
    new MyLocationControl().addTo(map);

    // ── Auto-locate เมื่อเปิด modal ครั้งแรก (ไม่มีพิกัดเดิม) ──────────────
    if (!hasExistingPin) {
        _autoLocate(pinMapInstance, onPin);
    }
}

// ── auto-locate เงียบๆ (ไม่แสดง error ให้ user เห็น) ─────────────────────
function _autoLocate(pinMapInstance, onPin) {
    if (!navigator.geolocation) return;

    // ตรวจ protocol — Geolocation ต้องการ HTTPS (ยกเว้น localhost)
    const isSecure = location.protocol === 'https:' ||
                     location.hostname === 'localhost' ||
                     location.hostname === '127.0.0.1';
    if (!isSecure) {
        console.warn('[PinMap] Geolocation ต้องใช้ HTTPS หรือ localhost');
        return;
    }

    navigator.geolocation.getCurrentPosition(
        (pos) => {
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;
            console.log('[PinMap] Auto-locate success:', lat, lng);

            // setView ก่อน แล้วค่อย invalidateSize หลายรอบเพื่อแก้ปัญหา desktop render
            if (pinMapInstance.map) {
                pinMapInstance.map.setView([lat, lng], 15);
                pinMapInstance.map.invalidateSize();
                setTimeout(() => pinMapInstance.map?.invalidateSize(), 150);
                setTimeout(() => pinMapInstance.map?.invalidateSize(), 500);
            }
            pinMapInstance.setMarker(lat, lng);
            if (onPin) onPin(lat, lng);
        },
        (err) => {
            // auto-locate ล้มเหลวเงียบๆ — user ยังกดปุ่มเองได้
            console.warn('[PinMap] Auto-locate failed:', err.code, err.message);
            // แจ้งเตือนเบาๆ เฉพาะกรณีปฏิเสธสิทธิ์
            if (err.code === 1 /* PERMISSION_DENIED */) {
                console.info('[PinMap] ผู้ใช้ไม่อนุญาต Geolocation — แผนที่แสดง default view');
            }
        },
        {
            enableHighAccuracy: true,  // รองรับทั้ง Desktop (Network/IP) และ Mobile (GPS)
            timeout:            10000, // 10 วินาที
            maximumAge:         0,     // ห้ามใช้ cache เก่า
        }
    );
}

// ── ปุ่ม "ไปยังตำแหน่งของฉัน" กด manual ────────────────────────────────────
function _gotoMyLocation(pinMapInstance, onPin, btn) {
    if (!navigator.geolocation) {
        _showGeoToast('เบราว์เซอร์นี้ไม่รองรับ Geolocation ครับ');
        return;
    }

    const isSecure = location.protocol === 'https:' ||
                     location.hostname === 'localhost' ||
                     location.hostname === '127.0.0.1';
    if (!isSecure) {
        _showGeoToast('Geolocation ต้องใช้งานบน HTTPS ครับ');
        return;
    }

    const origHtml = btn.innerHTML;
    btn.innerHTML  = '⏳';
    btn.disabled   = true;

    navigator.geolocation.getCurrentPosition(
        (pos) => {
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;
            console.log('[PinMap] _gotoMyLocation success:', lat, lng);

            // setView ก่อนแล้วค่อย invalidateSize หลายรอบ เพื่อแก้ปัญหา Desktop render
            if (pinMapInstance.map) {
                pinMapInstance.map.setView([lat, lng], 15);
                pinMapInstance.map.invalidateSize();
                setTimeout(() => pinMapInstance.map?.invalidateSize(), 150);
                setTimeout(() => pinMapInstance.map?.invalidateSize(), 500);
            }
            pinMapInstance.setMarker(lat, lng);
            if (onPin) onPin(lat, lng);
            btn.innerHTML       = '📍';
            btn.disabled        = false;
            btn.style.color     = '#2196f3';
            btn.title           = 'ตำแหน่งของฉัน ✓';
        },
        (err) => {
            btn.innerHTML = origHtml;
            btn.disabled  = false;
            console.warn('[PinMap] _gotoMyLocation error:', err.code, err.message);
            // แสดง toast แจ้งเหตุผลชัดเจน
            if (err.code === 1 /* PERMISSION_DENIED */) {
                _showGeoToast('ถูกปฏิเสธสิทธิ์ตำแหน่ง — กรุณาคลิก 🔒 บน address bar แล้วอนุญาต Location ครับ');
            } else if (err.code === 3 /* TIMEOUT */) {
                _showGeoToast('หมดเวลาดึงตำแหน่ง — กรุณาลองใหม่อีกครั้งครับ');
            } else {
                _showGeoToast('ไม่สามารถระบุตำแหน่งได้ (' + err.message + ')');
            }
        },
        {
            enableHighAccuracy: true,   // true = รองรับทั้ง Desktop (Network/IP) และ Mobile (GPS)
            timeout:            10000,
            maximumAge:         0,
        }
    );
}

// ── Toast แจ้งเตือนเล็กๆ (ไม่ block UI เหมือน alert) ──────────────────────
function _showGeoToast(msg) {
    // ลบ toast เก่า
    const old = document.getElementById('_geoToast');
    if (old) old.remove();

    const toast = document.createElement('div');
    toast.id    = '_geoToast';
    toast.textContent = '📍 ' + msg;
    toast.style.cssText = [
        'position:fixed', 'bottom:24px', 'left:50%',
        'transform:translateX(-50%)',
        'background:rgba(44,33,22,0.88)', 'color:#fff',
        'padding:10px 20px', 'border-radius:8px',
        'font-family:Prompt,sans-serif', 'font-size:13px',
        'z-index:99999', 'pointer-events:none',
        'box-shadow:0 4px 16px rgba(0,0,0,0.25)',
        'max-width:90vw', 'text-align:center',
        'animation:_geoFadeIn 0.2s ease',
    ].join(';');

    // inject keyframes ครั้งเดียว
    if (!document.getElementById('_geoToastStyle')) {
        const s = document.createElement('style');
        s.id = '_geoToastStyle';
        s.textContent = '@keyframes _geoFadeIn{from{opacity:0;transform:translateX(-50%) translateY(10px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}';
        document.head.appendChild(s);
    }

    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 5000);
}
