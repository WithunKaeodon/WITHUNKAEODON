const db = require('../config/db');

// ── helper: ตรวจสิทธิ์ admin ──────────────────────────────────────
function requireAdmin(req, res) {
    const caller = req.headers['x-admin-email'] || req.query.adminEmail || req.body?.adminEmail;
    if (caller !== 'admin') {
        res.status(403).json({ success: false, message: 'ไม่มีสิทธิ์เข้าถึง' });
        return false;
    }
    return true;
}

// ══════════════════════════════════════════════════════
//  REPORTS
// ══════════════════════════════════════════════════════

// GET /api/admin/reports  — ดึงรายงานทั้งหมด จัดกลุ่มตาม propertyId
const getReports = async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT
                ir.reportId, ir.reporterEmail, ir.propertyId,
                ir.reportType, ir.description, ir.status, ir.reportedAt,
                p.title        AS propTitle,
                p.ownerEmail   AS ownerEmail
            FROM issuereport ir
            LEFT JOIN property p ON ir.propertyId = p.propertyId
            ORDER BY ir.reportedAt DESC
        `);

        // จัดกลุ่มตาม propertyId
        const groups = {};
        rows.forEach(r => {
            const key = r.propertyId;
            if (!groups[key]) {
                groups[key] = {
                    propertyId: r.propertyId,
                    propTitle:  r.propTitle  || 'ไม่มีชื่อที่พัก',
                    ownerEmail: r.ownerEmail || 'ไม่ระบุ',
                    count:      0,
                    pendingCount: 0,
                    reasons:    new Set(),
                    reportIds:  []
                };
            }
            groups[key].count++;
            if (r.status === 'PENDING' || r.status === 'IN_PROGRESS') {
                groups[key].pendingCount++;
            }
            groups[key].reasons.add(`[${r.status}] ${r.reportType}${r.description ? ': ' + r.description : ''}`);
            groups[key].reportIds.push(r.reportId);
        });

        const result = Object.values(groups).map(g => ({
            ...g,
            reasons: [...g.reasons]
        }));

        res.json({ success: true, data: result });
    } catch (err) {
        console.error('getReports error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
};

// GET /api/admin/reports/:propertyId  — ดูรายงานแต่ละรายการของที่พัก
const getReportsByProperty = async (req, res) => {
    try {
        const { propertyId } = req.params;
        const [rows] = await db.query(`
            SELECT ir.reportId, ir.reporterEmail, ir.reportType,
                   ir.description, ir.status, ir.reportedAt
            FROM issuereport ir
            WHERE ir.propertyId = ?
            ORDER BY ir.reportedAt DESC
        `, [propertyId]);
        res.json({ success: true, data: rows });
    } catch (err) {
        console.error('getReportsByProperty error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
};
const resolveReports = async (req, res) => {
    try {
        if (!requireAdmin(req, res)) return;
        const { propertyId, status } = req.body;
        const validStatus = ['IN_PROGRESS', 'RESOLVED', 'REJECTED'];
        const newStatus = validStatus.includes(status) ? status : 'RESOLVED';
        await db.query(
            `UPDATE issuereport SET status=? WHERE propertyId=? AND (status='PENDING' OR status='IN_PROGRESS')`,
            [newStatus, propertyId]
        );
        res.json({ success: true });
    } catch (err) {
        console.error('resolveReports error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
};

// ══════════════════════════════════════════════════════
//  PROPERTIES
// ══════════════════════════════════════════════════════

// GET /api/admin/properties
const getProperties = async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT propertyId, title, ownerEmail, propertyType, isPublished, createdAt
            FROM property
            ORDER BY createdAt DESC
        `);
        res.json({ success: true, data: rows });
    } catch (err) {
        console.error('getProperties error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
};

// PATCH /api/admin/properties/:id/publish
const togglePropertyPublish = async (req, res) => {
    try {
        if (!requireAdmin(req, res)) return;
        const { id } = req.params;
        const { isPublished } = req.body;
        await db.query('UPDATE property SET isPublished=? WHERE propertyId=?', [isPublished ? 1 : 0, id]);
        res.json({ success: true });
    } catch (err) {
        console.error('togglePropertyPublish error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
};

// DELETE /api/admin/properties/:id
const deleteProperty = async (req, res) => {
    const conn = await db.getConnection();
    try {
        if (!requireAdmin(req, res)) { conn.release(); return; }
        await conn.beginTransaction();
        const { id } = req.params;
        await conn.query('DELETE FROM propertyimage WHERE propertyId=?', [id]);
        await conn.query('DELETE FROM roomfacility WHERE propertyId=?', [id]);
        await conn.query('DELETE FROM buildingfacilities WHERE propertyId=?', [id]);
        await conn.query('DELETE FROM issuereport WHERE propertyId=?', [id]);
        await conn.query('DELETE FROM property WHERE propertyId=?', [id]);
        await conn.commit();
        conn.release();
        res.json({ success: true });
    } catch (err) {
        await conn.rollback(); conn.release();
        console.error('deleteProperty error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
};

// ══════════════════════════════════════════════════════
//  USERS
// ══════════════════════════════════════════════════════

// GET /api/admin/users
const getUsers = async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT email, firstName, lastName, phone, lineId, facebook, profileImage, role, status, createdAt, suspendAt, banReason
            FROM user
            ORDER BY createdAt DESC
        `);
        res.json({ success: true, data: rows });
    } catch (err) {
        console.error('getUsers error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
};

// GET /api/admin/users/:email — ดูข้อมูล user คนเดียว
const getUserDetail = async (req, res) => {
    try {
        const { email } = req.params;
        const [rows] = await db.query(
            'SELECT email, firstName, lastName, phone, lineId, facebook, profileImage, role, status, createdAt, suspendAt, banReason FROM user WHERE email=?',
            [email]
        );
        if (rows.length === 0)
            return res.status(404).json({ success: false, message: 'ไม่พบผู้ใช้' });
        res.json({ success: true, data: rows[0] });
    } catch (err) {
        console.error('getUserDetail error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
};

// PATCH /api/admin/users/:email/status  — ban / unban
const setUserStatus = async (req, res) => {
    try {
        if (!requireAdmin(req, res)) return;
        const { email } = req.params;
        const { status, banReason } = req.body; // 'ACTIVE' | 'BANNED' | 'INACTIVE'
        if (!['ACTIVE', 'BANNED', 'INACTIVE'].includes(status)) {
            return res.status(400).json({ success: false, message: 'status ไม่ถูกต้อง' });
        }

        // ถ้า BANNED และมี banReason ให้บันทึกเหตุผลด้วย
        // ถ้า ACTIVE (ปลดล็อก) ให้ล้าง banReason ด้วย
        if (status === 'BANNED' && banReason) {
            await db.query('UPDATE user SET status=?, banReason=? WHERE email=?', [status, banReason, email]);
        } else if (status === 'ACTIVE') {
            await db.query('UPDATE user SET status=?, banReason=NULL, suspendAt=NULL WHERE email=?', [status, email]);
        } else {
            await db.query('UPDATE user SET status=?, banReason=IFNULL(?, banReason) WHERE email=?', [status, banReason || null, email]);
        }
        res.json({ success: true });
    } catch (err) {
        console.error('setUserStatus error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
};

// DELETE /api/admin/users/:email
const deleteUser = async (req, res) => {
    const conn = await db.getConnection();
    try {
        if (!requireAdmin(req, res)) { conn.release(); return; }
        await conn.beginTransaction();
        const { email } = req.params;

        // ลบ property และ child tables ทั้งหมดของ user ก่อน
        const [props] = await conn.query('SELECT propertyId FROM property WHERE ownerEmail=?', [email]);
        for (const p of props) {
            await conn.query('DELETE FROM propertyimage WHERE propertyId=?', [p.propertyId]);
            await conn.query('DELETE FROM roomfacility WHERE propertyId=?', [p.propertyId]);
            await conn.query('DELETE FROM buildingfacilities WHERE propertyId=?', [p.propertyId]);
            await conn.query('DELETE FROM issuereport WHERE propertyId=?', [p.propertyId]);
        }
        await conn.query('DELETE FROM property WHERE ownerEmail=?', [email]);
        await conn.query('DELETE FROM chatmessage WHERE senderEmail=? OR receiverEmail=?', [email, email]);
        await conn.query('DELETE FROM user WHERE email=?', [email]);

        await conn.commit(); conn.release();
        res.json({ success: true });
    } catch (err) {
        await conn.rollback(); conn.release();
        console.error('deleteUser error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
};

// POST /api/admin/warn  — ส่งข้อความเตือนผ่านแชท + กำหนดมาตรการ
const warnUser = async (req, res) => {
    try {
        if (!requireAdmin(req, res)) return;
        const { ownerEmail, propTitle, message, action, deadlineDays, propertyId } = req.body;

        // คำนวณวันหมดเขต
        const now = new Date();
        let suspendDate = null;
        if (action === 'auto_days' && deadlineDays > 0) {
            suspendDate = new Date(now.getTime() + deadlineDays * 24 * 60 * 60 * 1000);
        }

        // ข้อความท้ายแจ้งเตือน
        let actionNote = '';
        if (action === 'suspend_now') {
            actionNote = '\n🚫 บัญชีของคุณถูกระงับการใช้งานทันที';
        } else if (action === 'auto_days' && suspendDate) {
            const deadlineStr = suspendDate.toLocaleDateString('th-TH', {
                year: 'numeric', month: 'long', day: 'numeric',
                hour: '2-digit', minute: '2-digit'
            });
            actionNote = `\n⏰ กรุณาแก้ไขภายใน ${deadlineDays} วัน (ภายในวันที่ ${deadlineStr})\nหากไม่ดำเนินการ บัญชีจะถูกระงับอัตโนมัติ`;
        }

        // ดึง reportTypes ของที่พักนี้จาก DB
        const [reportRows] = await db.query(
            `SELECT DISTINCT reportType FROM issuereport
             WHERE propertyId = ? AND (status = 'PENDING' OR status = 'IN_PROGRESS')`,
            [propertyId]
        );
        const reasonTypes = reportRows.map(r => r.reportType).filter(Boolean);

        const warnMsg = `[⚠️ แจ้งเตือนจาก Admin - ที่พัก: ${propTitle}]\n${message}${actionNote}\n[REPORT_TYPES:${reasonTypes.join(',')}]`;
        await db.query(
            `INSERT INTO chatmessage (senderEmail, receiverEmail, messageText, propertyId, isRead, sentAt)
             VALUES ('admin', ?, ?, ?, 0, NOW())`,
            [ownerEmail, warnMsg, propertyId || null]
        );

        // อัปเดตสถานะบัญชี
        if (action === 'suspend_now') {
            const banReasonText = reasonTypes.length > 0
                ? `ระงับจากรายงาน: ${reasonTypes.join(', ')}${message ? ' — ' + message.substring(0, 300) : ''}`
                : (message ? message.substring(0, 500) : 'ระงับโดย Admin');
            await db.query('UPDATE user SET status=?, suspendAt=NULL, banReason=? WHERE email=?', ['BANNED', banReasonText, ownerEmail]);
        } else if (action === 'auto_days' && suspendDate) {
            await db.query('UPDATE user SET status=?, suspendAt=? WHERE email=?', ['ACTIVE', suspendDate, ownerEmail]);
        }
        // action === 'none' ไม่แตะสถานะ

        // เปลี่ยนสถานะรายงานเป็น IN_PROGRESS
        if (propertyId) {
            await db.query(
                `UPDATE issuereport SET status='IN_PROGRESS' WHERE propertyId=? AND status='PENDING'`,
                [propertyId]
            );
        }

        res.json({ success: true });
    } catch (err) {
        console.error('warnUser error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
};

// PATCH /api/admin/users/:email  — แก้ไขข้อมูล user (ชื่อ, โทร, role)
const updateUser = async (req, res) => {
    try {
        if (!requireAdmin(req, res)) return;
        const { email } = req.params;
        const { firstName, lastName, phone, role } = req.body;
        const validRoles = ['USER', 'OWNER', 'ADMIN'];
        if (role && !validRoles.includes(role))
            return res.status(400).json({ success: false, message: 'role ไม่ถูกต้อง' });
        await db.query(
            'UPDATE user SET firstName=?, lastName=?, phone=?, role=? WHERE email=?',
            [firstName, lastName, phone || null, role || 'USER', email]
        );
        res.json({ success: true });
    } catch (err) {
        console.error('updateUser error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
};

// GET /api/admin/properties/:id  — ดูรายละเอียดที่พัก (admin bypass owner check)
const getPropertyDetail = async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await db.query('SELECT * FROM property WHERE propertyId=?', [id]);
        if (rows.length === 0)
            return res.status(404).json({ success: false, message: 'ไม่พบที่พัก' });
        const prop = rows[0];
        const [images]  = await db.query('SELECT imageId, imageUrl FROM propertyimage WHERE propertyId=? ORDER BY imageId ASC', [id]);
        const [roomFac] = await db.query('SELECT * FROM roomfacility WHERE propertyId=?', [id]);
        const [bldgFac] = await db.query('SELECT * FROM buildingfacilities WHERE propertyId=?', [id]);
        res.json({ success: true, data: { ...prop, images, roomFacility: roomFac[0]||null, buildingFacility: bldgFac[0]||null } });
    } catch (err) {
        console.error('getPropertyDetail error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
};

// PATCH /api/admin/properties/:id  — admin แก้ไขชื่อ/สถานะที่พัก (ไม่ต้องเช็ค ownerEmail)
const updatePropertyAdmin = async (req, res) => {
    try {
        if (!requireAdmin(req, res)) return;
        const { id } = req.params;
        const { title, isPublished } = req.body;
        await db.query(
            'UPDATE property SET title=?, isPublished=? WHERE propertyId=?',
            [title, isPublished ? 1 : 0, id]
        );
        res.json({ success: true });
    } catch (err) {
        console.error('updatePropertyAdmin error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
};

// DELETE /api/admin/images/:imageId  — ลบรูปเดียวโดย admin
const deleteImage = async (req, res) => {
    try {
        if (!requireAdmin(req, res)) return;
        const { imageId } = req.params;
        await db.query('DELETE FROM propertyimage WHERE imageId=?', [imageId]);
        res.json({ success: true });
    } catch (err) {
        console.error('deleteImage error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
};

// ══════════════════════════════════════════════════════
//  APPEALS (คำร้องโต้แย้งการระงับบัญชี)
// ══════════════════════════════════════════════════════

// GET /api/admin/appeals — ดึงคำร้องโต้แย้งทั้งหมด
const getAppeals = async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT
                a.appealId, a.userEmail, a.banReason, a.appealMessage,
                a.status, a.adminNote, a.submittedAt, a.reviewedAt,
                u.firstName, u.lastName, u.role, u.status AS userStatus,
                u.profileImage
            FROM userappeal a
            LEFT JOIN user u ON a.userEmail = u.email
            ORDER BY
                CASE WHEN a.status = 'PENDING' THEN 0
                     WHEN a.status = 'REVIEWING' THEN 1
                     WHEN a.status = 'REJECTED' THEN 2
                     WHEN a.status = 'APPROVED' THEN 3
                END,
                a.submittedAt DESC
        `);
        res.json({ success: true, data: rows });
    } catch (err) {
        console.error('getAppeals error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
};

// PATCH /api/admin/appeals/:id — อนุมัติ (ปลดล็อก) หรือ ปฏิเสธ คำร้อง
const resolveAppeal = async (req, res) => {
    try {
        if (!requireAdmin(req, res)) return;
        const { id } = req.params;
        const { action, adminNote } = req.body; // 'APPROVED' | 'REJECTED'

        if (!['APPROVED', 'REJECTED'].includes(action)) {
            return res.status(400).json({ success: false, message: 'action ไม่ถูกต้อง (APPROVED หรือ REJECTED)' });
        }

        // ดึงคำร้องเพื่อหา userEmail
        const [appealRows] = await db.query('SELECT userEmail, status FROM userappeal WHERE appealId=?', [id]);
        if (appealRows.length === 0) {
            return res.status(404).json({ success: false, message: 'ไม่พบคำร้องนี้' });
        }

        const userEmail = appealRows[0].userEmail;

        // อัปเดตสถานะคำร้อง
        await db.query(
            'UPDATE userappeal SET status=?, adminNote=?, reviewedAt=NOW() WHERE appealId=?',
            [action, adminNote || null, id]
        );

        // ถ้าอนุมัติ → ปลดล็อกบัญชี
        if (action === 'APPROVED') {
            await db.query(
                'UPDATE user SET status=?, banReason=NULL, suspendAt=NULL WHERE email=?',
                ['ACTIVE', userEmail]
            );
        }

        res.json({ success: true });
    } catch (err) {
        console.error('resolveAppeal error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
};

module.exports = {
    getReports, getReportsByProperty, resolveReports,
    getProperties, togglePropertyPublish, deleteProperty,
    getPropertyDetail, updatePropertyAdmin, deleteImage,
    getUsers, getUserDetail, setUserStatus, updateUser, deleteUser,
    warnUser,
    getAppeals, resolveAppeal
};
