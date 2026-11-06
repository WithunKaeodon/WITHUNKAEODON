const db = require('../config/db');
const bcrypt = require('bcrypt');

const SALT_ROUNDS = 10;

// POST /api/auth/register
const register = async (req, res) => {
    try {
        const { firstName, lastName, email, password, phone } = req.body;

        if (!firstName || !lastName || !email || !password) {
            return res.status(400).json({ success: false, message: 'กรุณากรอกข้อมูลให้ครบถ้วน' });
        }

        if (password.length < 6) {
            return res.status(400).json({ success: false, message: 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร' });
        }

        // ตรวจสอบว่า email ซ้ำหรือไม่
        const [existing] = await db.query('SELECT email FROM user WHERE email = ?', [email]);
        if (existing.length > 0) {
            return res.status(409).json({ success: false, message: 'อีเมลนี้ถูกใช้งานแล้ว' });
        }

        // เข้ารหัส password
        const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

        await db.query(
            `INSERT INTO user (email, password, firstName, lastName, phone, role, status, createdAt)
             VALUES (?, ?, ?, ?, ?, 'USER', 'ACTIVE', NOW())`,
            [email, hashedPassword, firstName, lastName, phone || null]
        );

        res.json({ success: true, message: 'สมัครสมาชิกสำเร็จ!' });

    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// POST /api/auth/login
const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ success: false, message: 'กรุณากรอกอีเมลและรหัสผ่าน' });
        }

        // ดึงข้อมูล user จาก DB
        const [rows] = await db.query('SELECT * FROM user WHERE email = ?', [email]);
        if (rows.length === 0) {
            return res.status(401).json({ success: false, message: 'ไม่พบบัญชีผู้ใช้นี้ในระบบ' });
        }

        const user = rows[0];

        // ตรวจสอบ suspendAt — ถ้าถึงเวลาแล้วให้ ban อัตโนมัติ
        if (user.suspendAt && new Date() >= new Date(user.suspendAt)) {
            await db.query("UPDATE user SET status='BANNED', suspendAt=NULL, banReason=IFNULL(banReason,'ระงับอัตโนมัติตามกำหนดเวลาที่กำหนด') WHERE email=?", [email]);
            return res.status(403).json({
                success: false,
                banned: true,
                banReason: user.banReason || 'ระงับอัตโนมัติตามกำหนดเวลาที่กำหนด',
                message: 'บัญชีของคุณถูกระงับการใช้งานตามกำหนดเวลา กรุณาติดต่อ Admin'
            });
        }

        // ตรวจสอบสถานะบัญชี
        if (user.status === 'BANNED') {
            return res.status(403).json({
                success: false,
                banned: true,
                banReason: user.banReason || 'ไม่ระบุเหตุผล',
                message: 'บัญชีของคุณถูกระงับการใช้งาน'
            });
        }
        if (user.status === 'INACTIVE') {
            return res.status(403).json({ success: false, message: 'บัญชีของคุณยังไม่ได้เปิดใช้งาน' });
        }

        // ตรวจสอบรหัสผ่าน
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ success: false, message: 'รหัสผ่านไม่ถูกต้อง' });
        }

        // ส่งข้อมูล user กลับ (ไม่ส่ง password)
        res.json({
            success: true,
            message: 'เข้าสู่ระบบสำเร็จ!',
            user: {
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                fullName: `${user.firstName} ${user.lastName}`,
                phone: user.phone,
                role: user.role,
                profileImage: user.profileImage
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// POST /api/auth/appeal — ผู้ใช้ที่ถูกระงับส่งคำร้องโต้แย้ง
const submitAppeal = async (req, res) => {
    try {
        const { email, appealMessage } = req.body;

        if (!email || !appealMessage || !appealMessage.trim()) {
            return res.status(400).json({ success: false, message: 'กรุณากรอกข้อมูลให้ครบถ้วน' });
        }

        // ตรวจสอบว่า user มีอยู่จริงและถูกระงับ
        const [rows] = await db.query('SELECT email, status, banReason FROM user WHERE email = ?', [email]);
        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: 'ไม่พบบัญชีผู้ใช้นี้ในระบบ' });
        }
        if (rows[0].status !== 'BANNED') {
            return res.status(400).json({ success: false, message: 'บัญชีของคุณไม่ได้ถูกระงับ ไม่จำเป็นต้องยื่นคำร้อง' });
        }

        const banReason = rows[0].banReason || 'ไม่ระบุเหตุผล';

        // บันทึกคำร้องลงในตาราง userappeal
        await db.query(
            `INSERT INTO userappeal (userEmail, banReason, appealMessage, status, submittedAt)
             VALUES (?, ?, ?, 'PENDING', NOW())`,
            [email, banReason, appealMessage.trim()]
        );

        res.json({ success: true, message: 'ส่งคำร้องโต้แย้งเรียบร้อยแล้ว เจ้าหน้าที่จะตรวจสอบโดยเร็ว' });

    } catch (error) {
        console.error('submitAppeal error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = { register, login, submitAppeal };
