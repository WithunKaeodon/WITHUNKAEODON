var API_BASE = 'http://localhost:5000/api';
const ADMIN_HEADER = { 'Content-Type': 'application/json', 'x-admin-email': 'admin' };

let targetEmail = '';
let userData = {};

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
    const activeUser = localStorage.getItem('activeUser');
    if (activeUser !== 'admin') {
        await customAlert('ไม่มีสิทธิ์', 'หน้านี้สำหรับ Admin เท่านั้น', '🚫');
        window.location.href = 'index.html';
        return;
    }

    const urlParams = new URLSearchParams(window.location.search);
    targetEmail = urlParams.get('email');
    if (!targetEmail) {
        await customAlert('ไม่พบข้อมูล', 'ไม่พบอีเมลสมาชิกที่ต้องการแก้ไข', '❌');
        window.location.href = 'admin.html';
        return;
    }

    await loadUserData();
};

// ----------------------------------------
// โหลดข้อมูล User
// ----------------------------------------
async function loadUserData() {
    try {
        const res = await fetch(`${API_BASE}/users/me?email=${encodeURIComponent(targetEmail)}`, {
            headers: ADMIN_HEADER
        });
        const result = await res.json();
        if (!result.success) {
            await customAlert('เกิดข้อผิดพลาด', result.message, '❌');
            window.location.href = 'admin.html';
            return;
        }
        userData = result.data;
        renderUserData();
    } catch (err) {
        console.error(err);
        await customAlert('เกิดข้อผิดพลาด', 'ไม่สามารถโหลดข้อมูลได้ กรุณาตรวจสอบ Backend', '❌');
    }
}

function renderUserData() {
    const u = userData;
    const fullName = `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email;

    // Banner
    if (u.profileImage) document.getElementById('profilePic').src = u.profileImage;
    document.getElementById('dispFullName').innerText = fullName;
    document.getElementById('dispEmail').innerText    = u.email;
    document.getElementById('dispRole').innerText     = u.role || 'USER';

    // Fields
    document.getElementById('disp-name').innerText     = fullName;
    document.getElementById('disp-role').innerText     = u.role || 'USER';
    document.getElementById('disp-phone').innerText    = u.phone    || 'ยังไม่ได้ระบุ';
    document.getElementById('disp-line').innerText     = u.lineId   || 'ยังไม่ได้ระบุ';
    document.getElementById('disp-facebook').innerText = u.facebook || 'ยังไม่ได้ระบุ';

    // Pre-fill inputs
    document.getElementById('inp-firstName').value = u.firstName || '';
    document.getElementById('inp-lastName').value  = u.lastName  || '';
    document.getElementById('inp-phone').value     = u.phone     || '';
    document.getElementById('inp-line').value      = u.lineId    || '';
    document.getElementById('inp-facebook').value  = u.facebook  || '';
}

// ----------------------------------------
// Inline Edit Controls
// ----------------------------------------
function openField(field) {
    // ปิด field อื่นที่เปิดอยู่ก่อน
    ['name', 'phone', 'line', 'facebook'].forEach(f => {
        if (f !== field) closeField(f);
    });
    document.getElementById(`edit-${field}`).style.display = 'block';
    // focus input แรก
    const firstInput = document.getElementById(`edit-${field}`).querySelector('input, select');
    if (firstInput) setTimeout(() => firstInput.focus(), 50);
}

function closeField(field) {
    document.getElementById(`edit-${field}`).style.display = 'none';
}

// ----------------------------------------
// Save Field
// ----------------------------------------
async function saveField(field) {
    let payload = { email: targetEmail };

    if (field === 'name') {
        const firstName = document.getElementById('inp-firstName').value.trim();
        const lastName  = document.getElementById('inp-lastName').value.trim();
        if (!firstName || !lastName) {
            await customAlert('ข้อมูลไม่ครบ', 'กรุณากรอกชื่อและนามสกุล', '⚠️');
            return;
        }
        payload.firstName = firstName;
        payload.lastName  = lastName;
    } else if (field === 'phone') {
        payload.phone = document.getElementById('inp-phone').value.trim();
    } else if (field === 'line') {
        payload.lineId = document.getElementById('inp-line').value.trim();
    } else if (field === 'facebook') {
        payload.facebook = document.getElementById('inp-facebook').value.trim();
    }

    try {
        // ข้อมูลทุก field ใช้ users/me
        const res = await fetch(`${API_BASE}/users/me`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

        const result = await res.json();
        if (result.success) {
            // อัปเดต userData local
            if (field === 'name') {
                userData.firstName = payload.firstName;
                userData.lastName  = payload.lastName;
            } else if (field === 'phone')    { userData.phone    = payload.phone; }
            else if (field === 'line')       { userData.lineId   = payload.lineId; }
            else if (field === 'facebook')   { userData.facebook = payload.facebook; }

            closeField(field);
            renderUserData();
        } else {
            await customAlert('เกิดข้อผิดพลาด', result.message || 'ไม่สามารถบันทึกได้', '❌');
        }
    } catch (err) {
        console.error(err);
        await customAlert('เกิดข้อผิดพลาด', 'ไม่สามารถเชื่อมต่อ Backend ได้', '❌');
    }
}
