const db = require('../config/db');

// GET /api/chat/conversations?email=xxx
// ดึงรายชื่อคนที่เคยคุยด้วย พร้อมข้อความล่าสุดและจำนวนข้อความที่ยังไม่อ่าน
const getConversations = async (req, res) => {
    try {
        const { email } = req.query;
        if (!email) return res.status(400).json({ success: false, message: 'ไม่ระบุ email' });

        // ดึง distinct contact ทั้งหมดที่เคยคุยด้วย
        const [contactRows] = await db.query(`
            SELECT DISTINCT
                CASE WHEN senderEmail = ? THEN receiverEmail ELSE senderEmail END AS contact
            FROM chatmessage
            WHERE senderEmail = ? OR receiverEmail = ?
        `, [email, email, email]);

        if (contactRows.length === 0) {
            return res.json({ success: true, data: [] });
        }

        const result = [];

        for (const row of contactRows) {
            const contact = row.contact;

            // ข้อความล่าสุดระหว่างคู่นี้
            const [[lastMsg]] = await db.query(`
                SELECT messageText, senderEmail, sentAt
                FROM chatmessage
                WHERE (senderEmail = ? AND receiverEmail = ?)
                   OR (senderEmail = ? AND receiverEmail = ?)
                ORDER BY sentAt DESC LIMIT 1
            `, [email, contact, contact, email]);

            // นับ unread ที่ส่งมาหาเรา
            const [[{ unreadCount }]] = await db.query(`
                SELECT COUNT(*) AS unreadCount
                FROM chatmessage
                WHERE senderEmail = ? AND receiverEmail = ? AND isRead = 0
            `, [contact, email]);

            // ข้อมูล profile ของ contact
            const [userRows] = await db.query(
                'SELECT firstName, lastName, profileImage FROM user WHERE email = ?',
                [contact]
            );
            const u = userRows[0];
            const fullName = u ? `${u.firstName || ''} ${u.lastName || ''}`.trim() || contact : contact;

            result.push({
                contactEmail: contact,
                fullName,
                profileImage: u?.profileImage || null,
                lastMessage:  lastMsg?.messageText || '',
                lastSender:   lastMsg?.senderEmail || '',
                lastSentAt:   lastMsg?.sentAt || null,
                unreadCount:  unreadCount || 0
            });
        }

        // เรียงตามเวลาล่าสุด
        result.sort((a, b) => new Date(b.lastSentAt) - new Date(a.lastSentAt));

        res.json({ success: true, data: result });
    } catch (err) {
        console.error('getConversations error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
};

// GET /api/chat/messages?me=xxx&with=yyy
// ดึงข้อความทั้งหมดระหว่าง 2 คน
const getMessages = async (req, res) => {
    try {
        const { me, with: other } = req.query;
        if (!me || !other) return res.status(400).json({ success: false, message: 'ต้องระบุ me และ with' });

        const [rows] = await db.query(`
            SELECT chatId, senderEmail, receiverEmail, messageText, propertyId, isRead, sentAt
            FROM chatmessage
            WHERE (senderEmail = ? AND receiverEmail = ?)
               OR (senderEmail = ? AND receiverEmail = ?)
            ORDER BY sentAt ASC
        `, [me, other, other, me]);

        res.json({ success: true, data: rows });
    } catch (err) {
        console.error('getMessages error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
};

// POST /api/chat/send
// ส่งข้อความใหม่
const sendMessage = async (req, res) => {
    try {
        const { senderEmail, receiverEmail, messageText, propertyId } = req.body;
        if (!senderEmail || !receiverEmail || !messageText) {
            return res.status(400).json({ success: false, message: 'ข้อมูลไม่ครบ' });
        }

        const [result] = await db.query(
            `INSERT INTO chatmessage (senderEmail, receiverEmail, messageText, propertyId, isRead, sentAt)
             VALUES (?, ?, ?, ?, 0, NOW())`,
            [senderEmail, receiverEmail, messageText, propertyId || null]
        );

        res.json({ success: true, chatId: result.insertId });
    } catch (err) {
        console.error('sendMessage error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
};

// PATCH /api/chat/read?me=xxx&with=yyy
// มาร์คข้อความที่รับมาว่าอ่านแล้ว
const markAsRead = async (req, res) => {
    try {
        const { me, with: other } = req.query;
        if (!me || !other) return res.status(400).json({ success: false, message: 'ต้องระบุ me และ with' });

        await db.query(
            `UPDATE chatmessage SET isRead = 1
             WHERE receiverEmail = ? AND senderEmail = ? AND isRead = 0`,
            [me, other]
        );

        res.json({ success: true });
    } catch (err) {
        console.error('markAsRead error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
};

// GET /api/chat/unread?email=xxx
// นับข้อความที่ยังไม่อ่านทั้งหมด (สำหรับ badge)
const getUnreadCount = async (req, res) => {
    try {
        const { email } = req.query;
        if (!email) return res.status(400).json({ success: false, message: 'ไม่ระบุ email' });

        const [[{ count }]] = await db.query(
            'SELECT COUNT(*) AS count FROM chatmessage WHERE receiverEmail = ? AND isRead = 0',
            [email]
        );

        res.json({ success: true, count });
    } catch (err) {
        console.error('getUnreadCount error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
};

module.exports = { getConversations, getMessages, sendMessage, markAsRead, getUnreadCount };
