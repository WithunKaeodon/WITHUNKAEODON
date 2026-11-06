const express = require('express');
const cors    = require('cors');
const path    = require('path');
const db = require('./config/db');
const propertyRoutes = require('./routes/propertyRoutes');
const authRoutes     = require('./routes/authRoutes');
const userRoutes     = require('./routes/userRoutes');
const chatRoutes     = require('./routes/chatRoutes');
const adminRoutes    = require('./routes/adminRoutes');
const favoriteRoutes  = require('./routes/favoriteRoutes');
const reviewRoutes    = require('./routes/reviewRoutes');
const roomtypeRoutes  = require('./routes/roomtypeRoutes');
const groupRoutes     = require('./routes/groupRoutes');

const app  = express();
const PORT = 5000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Serve Frontend folder เป็น static files
// ป้องกัน browser caching ของ HTML และ JS (บังคับโหลดเวอร์ชั่นล่าสุดเสมอ)
app.use(express.static(path.join(__dirname, '../Frontend'), {
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('.html') || filePath.endsWith('.js')) {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
        }
    }
}));

app.use('/api/auth',       authRoutes);
app.use('/api/users',      userRoutes);
app.use('/api/chat',       chatRoutes);
app.use('/api/admin',      adminRoutes);
app.use('/api/favorites',  favoriteRoutes);
app.use('/api/reviews',    reviewRoutes);
app.use('/api/roomtypes',  roomtypeRoutes);
app.use('/api/groups',     groupRoutes);
app.use('/api/properties', propertyRoutes);

// POST /api/reports/mark-fixing — เจ้าของกดแจ้ง admin ว่ากำลังแก้ไข
app.post('/api/reports/mark-fixing', async (req, res) => {
    try {
        const { email, propertyId } = req.body;
        if (!email || !propertyId) return res.status(400).json({ success: false, message: 'ข้อมูลไม่ครบ' });

        const [propRows] = await db.query(
            'SELECT title, ownerEmail FROM property WHERE propertyId=?', [propertyId]
        );
        if (!propRows.length || propRows[0].ownerEmail !== email) {
            return res.status(403).json({ success: false, message: 'ไม่มีสิทธิ์' });
        }
        const propTitle = propRows[0].title;

        await db.query(
            `UPDATE issuereport SET status='IN_PROGRESS'
             WHERE propertyId=? AND status='PENDING'`,
            [propertyId]
        );

        const msg = `[🔧 กำลังแก้ไข] เจ้าของหอ "${email}" กำลังดำเนินการแก้ไขประกาศ "${propTitle}" (ID: ${propertyId}) — กรุณารอตรวจสอบ`;
        await db.query(
            `INSERT INTO chatmessage (senderEmail, receiverEmail, messageText, isRead, sentAt)
             VALUES (?, 'admin', ?, 0, NOW())`,
            [email, msg]
        );

        res.json({ success: true });
    } catch (err) {
        console.error('mark-fixing error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// POST /api/reports/mark-done — เจ้าของบันทึกแก้ไขแล้ว รอ admin ตรวจสอบ
app.post('/api/reports/mark-done', async (req, res) => {
    try {
        const { email, propertyId } = req.body;
        if (!email || !propertyId) return res.status(400).json({ success: false, message: 'ข้อมูลไม่ครบ' });

        const [propRows] = await db.query(
            'SELECT title, ownerEmail FROM property WHERE propertyId=?', [propertyId]
        );
        if (!propRows.length || propRows[0].ownerEmail !== email) {
            return res.status(403).json({ success: false, message: 'ไม่มีสิทธิ์' });
        }
        const propTitle = propRows[0].title;

        // เปลี่ยน status เป็น IN_PROGRESS + บันทึกเวลาที่แก้ไข
        await db.query(
            `UPDATE issuereport SET status='IN_PROGRESS', description=CONCAT(IFNULL(description,''), ' [✅ เจ้าของแก้ไขแล้ว รอตรวจสอบ]')
             WHERE propertyId=? AND (status='PENDING' OR status='IN_PROGRESS')`,
            [propertyId]
        );

        // ส่งแชทแจ้ง admin
        const msg = `[✅ แก้ไขแล้ว รอตรวจสอบ] เจ้าของ "${email}" ได้บันทึกการแก้ไขประกาศ "${propTitle}" (ID: ${propertyId}) เรียบร้อยแล้ว — กรุณาตรวจสอบและอัปเดตสถานะรายงาน`;
        await db.query(
            `INSERT INTO chatmessage (senderEmail, receiverEmail, messageText, propertyId, isRead, sentAt)
             VALUES (?, 'admin', ?, ?, 0, NOW())`,
            [email, msg, propertyId]
        );

        res.json({ success: true });
    } catch (err) {
        console.error('mark-done error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// GET /api/reports/owner?email=xxx — ดึงรายงานที่โพสของ user โดนรายงาน
app.get('/api/reports/owner', async (req, res) => {
    try {
        const { email } = req.query;
        if (!email) return res.status(400).json({ success: false, message: 'ไม่ระบุ email' });

        const [rows] = await db.query(`
            SELECT
                ir.reportId, ir.propertyId, ir.reportType,
                ir.description, ir.status, ir.reportedAt,
                p.title AS propTitle,
                (SELECT pi.imageUrl FROM propertyimage pi
                 WHERE pi.propertyId = p.propertyId
                 ORDER BY pi.imageId ASC LIMIT 1) AS coverImage
            FROM issuereport ir
            LEFT JOIN property p ON ir.propertyId = p.propertyId
            WHERE p.ownerEmail = ?
            ORDER BY ir.reportedAt DESC
        `, [email]);

        // จัดกลุ่มตาม propertyId
        const groups = {};
        rows.forEach(r => {
            const key = r.propertyId;
            if (!groups[key]) {
                groups[key] = {
                    propertyId: r.propertyId,
                    propTitle:  r.propTitle || 'ที่พักที่ถูกลบ',
                    coverImage: r.coverImage || null,
                    reports:    [],
                    pendingCount: 0,
                    latestAt:   r.reportedAt
                };
            }
            groups[key].reports.push({
                reportId:    r.reportId,
                reportType:  r.reportType,
                description: r.description,
                status:      r.status,
                reportedAt:  r.reportedAt
            });
            if (r.status === 'PENDING' || r.status === 'IN_PROGRESS') {
                groups[key].pendingCount++;
            }
        });

        res.json({ success: true, data: Object.values(groups) });
    } catch (err) {
        console.error('GET /api/reports/owner error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// POST /api/reports — user ส่งรายงานที่พัก
app.post('/api/reports', async (req, res) => {
    try {
        const { reporterEmail, propertyId, reasons, description } = req.body;
        if (!reporterEmail || !propertyId || !reasons || reasons.length === 0) {
            return res.status(400).json({ success: false, message: 'ข้อมูลไม่ครบ' });
        }

        // Map reason text -> ENUM ที่ DB รับได้
        const REASON_MAP = {
            'ข้อมูลที่พักไม่ถูกต้อง/หลอกลวง': 'SCAM',
            'รูปภาพไม่เหมาะสม/ไม่ตรงปก':      'INAPPROPRIATE_CONTENT',
            'ติดต่อเจ้าของไม่ได้':               'SPAM',
            'เนื้อหาผิดกฎหมาย/อนาจาร':          'OTHER',
        };

        // INSERT ทีละ reason
        for (const reason of reasons) {
            const reportType = REASON_MAP[reason] || 'OTHER';
            const desc = reason.startsWith('อื่นๆ:') ? reason.replace('อื่นๆ:', '').trim() : (description || reason);
            await db.query(
                `INSERT INTO issuereport (reporterEmail, propertyId, reportType, description, status, reportedAt)
                 VALUES (?, ?, ?, ?, 'PENDING', NOW())`,
                [reporterEmail, propertyId, reportType, desc]
            );
        }

        res.json({ success: true, message: 'ส่งรายงานเรียบร้อยแล้ว' });
    } catch (err) {
        console.error('submitReport error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// GET /api/properties -> ดึงข้อมูลที่พักทั้งหมด (อยู่ใน propertyRoutes แล้ว)
// แต่เก็บไว้ที่นี่เผื่อใช้ debug
app.get('/health', (req, res) => {
    res.json({ status: 'ok', message: 'Server กำลังทำงานอยู่ครับ' });
});

app.listen(PORT, () => {
    console.log(`🚀 API Server กำลังทำงานที่ http://localhost:${PORT}`);
});
