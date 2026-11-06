const db = require('../config/db');
const bcrypt = require('bcrypt');

// GET /api/users/me?email=xxx -> ดึงข้อมูล user
const getMe = async (req, res) => {
    try {
        const email = req.query.email;
        if (!email) return res.status(400).json({ success: false, message: 'ไม่ระบุ email' });

        const [rows] = await db.query(
            'SELECT email, firstName, lastName, phone, lineId, facebook, profileImage, role, status, createdAt FROM user WHERE email = ?',
            [email]
        );
        if (rows.length === 0) return res.status(404).json({ success: false, message: 'ไม่พบผู้ใช้' });

        res.json({ success: true, data: rows[0] });
    } catch (err) {
        console.error('getMe error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
};

// GET /api/users/me/properties?email=xxx -> ดึงประกาศทั้งหมดของ user พร้อมรูปแรก
const getMyProperties = async (req, res) => {
    try {
        const email = req.query.email;
        if (!email) return res.status(400).json({ success: false, message: 'ไม่ระบุ email' });

        const [rows] = await db.query(`
            SELECT
                p.*,
                (SELECT pi.imageUrl FROM propertyimage pi
                 WHERE pi.propertyId = p.propertyId
                 ORDER BY pi.imageId ASC LIMIT 1) AS coverImage
            FROM property p
            WHERE p.ownerEmail = ?
            ORDER BY p.createdAt DESC
        `, [email]);

        res.json({ success: true, data: rows });
    } catch (err) {
        console.error('getMyProperties error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
};

// PATCH /api/users/me -> อัปเดตข้อมูล user
const updateMe = async (req, res) => {
    try {
        const { email, firstName, lastName, phone, lineId, facebook, profileImage } = req.body;
        if (!email) return res.status(400).json({ success: false, message: 'ไม่ระบุ email' });

        // build dynamic SET ตาม field ที่ส่งมา — ไม่ overwrite field ที่ไม่ได้ส่ง
        const fields = [];
        const values = [];

        if (firstName   !== undefined) { fields.push('firstName=?');   values.push(firstName); }
        if (lastName    !== undefined) { fields.push('lastName=?');    values.push(lastName); }
        if (phone       !== undefined) { fields.push('phone=?');       values.push(phone || null); }
        if (lineId      !== undefined) { fields.push('lineId=?');      values.push(lineId || null); }
        if (facebook    !== undefined) { fields.push('facebook=?');    values.push(facebook || null); }
        if (profileImage !== undefined) { fields.push('profileImage=?'); values.push(profileImage || null); }

        if (fields.length === 0) return res.json({ success: true, message: 'ไม่มีข้อมูลที่ต้องอัปเดต' });

        values.push(email);
        await db.query(`UPDATE user SET ${fields.join(', ')} WHERE email=?`, values);

        res.json({ success: true, message: 'อัปเดตข้อมูลสำเร็จ' });
    } catch (err) {
        console.error('updateMe error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
};

// PATCH /api/users/me/password -> เปลี่ยนรหัสผ่าน
const changePassword = async (req, res) => {
    try {
        const { email, oldPassword, newPassword } = req.body;
        if (!email || !oldPassword || !newPassword)
            return res.status(400).json({ success: false, message: 'กรุณากรอกข้อมูลให้ครบ' });

        const [rows] = await db.query('SELECT password FROM user WHERE email = ?', [email]);
        if (rows.length === 0) return res.status(404).json({ success: false, message: 'ไม่พบผู้ใช้' });

        const isMatch = await bcrypt.compare(oldPassword, rows[0].password);
        if (!isMatch) return res.status(401).json({ success: false, message: 'รหัสผ่านเดิมไม่ถูกต้อง' });

        const hashed = await bcrypt.hash(newPassword, 10);
        await db.query('UPDATE user SET password = ? WHERE email = ?', [hashed, email]);

        res.json({ success: true, message: 'เปลี่ยนรหัสผ่านสำเร็จ' });
    } catch (err) {
        console.error('changePassword error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
};

module.exports = { getMe, getMyProperties, updateMe, changePassword };
