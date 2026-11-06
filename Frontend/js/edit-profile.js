var API_BASE = 'http://localhost:5000/api';
let activeUser = '';
let targetEmail = '';   // email ของ user ที่กำลังแก้ไข (อาจเป็น user อื่นถ้า admin เข้ามา)
let isAdminMode = false;
let pendingProfileImage = null; // base64 รูปที่รอบันทึก

// ==========================================
// Custom Popup
// ==========================================
function customAlert(title, message, icon = 'ℹ️') {
    return new Promise(resolve => {
        document.getElementById('popupIcon').innerText = icon;
        document.getElementById('popupTitle').innerText = title;
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

// ==========================================
// Init
// ==========================================
window.onload = async function () {
    activeUser = localStorage.getItem('activeUser');
    if (!activeUser) {
        await customAlert('ไม่ได้เข้าสู่ระบบ', 'กรุณาเข้าสู่ระบบก่อน', '🔒');
        window.location.href = 'index.html';
        return;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const emailParam = urlParams.get('email');
    const fromAdmin  = urlParams.get('from') === 'admin';

    isAdminMode = activeUser === 'admin' && emailParam && fromAdmin;
    targetEmail = isAdminMode ? emailParam : activeUser;

    // แสดง banner แจ้ง admin mode และซ่อนส่วนเปลี่ยนรหัสผ่าน
    if (isAdminMode) {
        const banner = document.getElementById('admin-banner');
        const emailLabel = document.getElementById('admin-target-email');
        if (banner) { banner.style.display = 'flex'; }
        if (emailLabel) { emailLabel.innerText = targetEmail; }
        const pwSection = document.getElementById('section-password');
        if (pwSection) pwSection.style.display = 'none';
    }

    await loadUserData();
};

// ==========================================
// โหลดข้อมูลจาก API
// ==========================================
async function loadUserData() {
    try {
        const res = await fetch(`${API_BASE}/users/me?email=${encodeURIComponent(targetEmail)}`);
        const result = await res.json();
        if (!result.success) {
            await customAlert('เกิดข้อผิดพลาด', result.message, '❌');
            return;
        }

        const u = result.data;
        const fullName = `${u.firstName || ''} ${u.lastName || ''}`.trim() || targetEmail;

        // Header
        const nameEl = document.getElementById('userDisplayName');
        if (nameEl) nameEl.innerText = fullName;

        // Form fields
        document.getElementById('userEmail').value = u.email;
        document.getElementById('firstName').value = u.firstName || '';
        document.getElementById('lastName').value  = u.lastName  || '';
        document.getElementById('phone').value     = u.phone     || '';

        // รูปโปรไฟล์
        if (u.profileImage) {
            document.getElementById('profilePicPreview').src = u.profileImage;
        }

        // sync localStorage เฉพาะตัวเอง
        if (!isAdminMode) {
            localStorage.setItem('userProfile_' + activeUser, JSON.stringify({
                email: u.email, fullName,
                firstName: u.firstName, lastName: u.lastName,
                phone: u.phone, role: u.role, profileImage: u.profileImage
            }));
        }

    } catch (err) {
        console.error('loadUserData error:', err);
        await customAlert('เกิดข้อผิดพลาด', 'โหลดข้อมูลไม่ได้ กรุณาตรวจสอบ Backend ด้วย', '❌');
    }
}

// ==========================================
// เลือกรูปโปรไฟล์
// ==========================================
function previewProfilePic(event) {
    const file = event.target.files[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) {
        customAlert('ไฟล์ใหญ่เกินไป', 'กรุณาเลือกรูปขนาดไม่เกิน 3MB', '⚠️');
        return;
    }
    const reader = new FileReader();
    reader.onload = e => {
        pendingProfileImage = e.target.result;
        document.getElementById('profilePicPreview').src = pendingProfileImage;
    };
    reader.readAsDataURL(file);
    event.target.value = '';
}

// ==========================================
// บันทึกข้อมูลพื้นฐาน
// ==========================================
async function saveBasicProfile(e) {
    e.preventDefault();

    const firstName    = document.getElementById('firstName').value.trim();
    const lastName     = document.getElementById('lastName').value.trim();
    const phone        = document.getElementById('phone').value.trim();
    const profileImage = pendingProfileImage;

    if (!firstName || !lastName) {
        await customAlert('ข้อมูลไม่ครบ', 'กรุณากรอกชื่อและนามสกุล', '⚠️');
        return;
    }

    try {
        const payload = { email: targetEmail, firstName, lastName, phone };
        if (profileImage) payload.profileImage = profileImage;

        const res = await fetch(`${API_BASE}/users/me`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const result = await res.json();

        if (result.success) {
            pendingProfileImage = null;

            const fullName = `${firstName} ${lastName}`.trim();

            // sync localStorage เฉพาะตัวเอง
            if (!isAdminMode) {
                const cached = JSON.parse(localStorage.getItem('userProfile_' + activeUser) || '{}');
                cached.fullName = fullName;
                cached.firstName = firstName;
                cached.lastName = lastName;
                cached.phone = phone;
                if (profileImage) cached.profileImage = profileImage;
                localStorage.setItem('userProfile_' + activeUser, JSON.stringify(cached));
            }

            const nameEl = document.getElementById('userDisplayName');
            if (nameEl) nameEl.innerText = fullName;

            await customAlert('สำเร็จ', 'บันทึกข้อมูลเรียบร้อยแล้ว!', '✅');

            // ถ้า admin กลับไปหน้า admin
            if (isAdminMode) {
                window.location.href = 'admin.html';
            }
        } else {
            await customAlert('เกิดข้อผิดพลาด', result.message || 'ไม่สามารถบันทึกได้', '❌');
        }
    } catch (err) {
        console.error('saveBasicProfile error:', err);
        await customAlert('เกิดข้อผิดพลาด', 'ไม่สามารถเชื่อมต่อ Backend ได้', '❌');
    }
}

// ==========================================
// เปลี่ยนรหัสผ่าน
// ==========================================
async function changePassword(e) {
    e.preventDefault();

    const oldPassword = document.getElementById('oldPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmPw   = document.getElementById('confirmPassword').value;

    if (newPassword !== confirmPw) {
        await customAlert('ไม่ตรงกัน', 'รหัสผ่านใหม่และยืนยันรหัสผ่านไม่ตรงกัน!', '❌');
        return;
    }
    if (newPassword.length < 6) {
        await customAlert('รหัสผ่านสั้นเกินไป', 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร', '⚠️');
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/users/me/password`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: targetEmail, oldPassword, newPassword })
        });
        const result = await res.json();

        if (result.success) {
            document.getElementById('oldPassword').value     = '';
            document.getElementById('newPassword').value     = '';
            document.getElementById('confirmPassword').value = '';
            await customAlert('สำเร็จ', 'เปลี่ยนรหัสผ่านเรียบร้อยแล้ว!', '✅');
        } else {
            await customAlert('เกิดข้อผิดพลาด', result.message || 'ไม่สามารถเปลี่ยนรหัสผ่านได้', '❌');
        }
    } catch (err) {
        console.error('changePassword error:', err);
        await customAlert('เกิดข้อผิดพลาด', 'ไม่สามารถเชื่อมต่อ Backend ได้', '❌');
    }
}
