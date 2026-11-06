const express = require('express');
const router  = express.Router();
const db      = require('../config/db');

// GET /api/reviews/:propertyId — ดึงรีวิวทั้งหมดของที่พัก
router.get('/:propertyId', async (req, res) => {
    try {
        const { propertyId } = req.params;
        const [rows] = await db.query(`
            SELECT r.reviewId, r.userEmail, r.propertyId, r.ratingScore, r.comment, r.createdAt,
                   CONCAT(u.firstName, ' ', u.lastName) AS reviewerName,
                   u.profileImage AS reviewerImg
            FROM review r
            LEFT JOIN user u ON r.userEmail = u.email
            WHERE r.propertyId = ?
            ORDER BY r.createdAt DESC
        `, [propertyId]);
        res.json({ success: true, data: rows });
    } catch (err) {
        console.error('GET reviews error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// POST /api/reviews — บันทึกรีวิว
router.post('/', async (req, res) => {
    try {
        const { userEmail, propertyId, ratingScore, comment } = req.body;
        if (!userEmail || !propertyId || !ratingScore) {
            return res.status(400).json({ success: false, message: 'ข้อมูลไม่ครบ' });
        }
        if (ratingScore < 1 || ratingScore > 5) {
            return res.status(400).json({ success: false, message: 'คะแนนต้องอยู่ระหว่าง 1-5' });
        }

        // เช็คว่าเคยรีวิวแล้วหรือยัง
        const [existing] = await db.query(
            'SELECT reviewId FROM review WHERE userEmail=? AND propertyId=?',
            [userEmail, propertyId]
        );
        if (existing.length > 0) {
            // อัปเดตแทน
            await db.query(
                'UPDATE review SET ratingScore=?, comment=?, createdAt=NOW() WHERE userEmail=? AND propertyId=?',
                [ratingScore, comment || '', userEmail, propertyId]
            );
            return res.json({ success: true, message: 'อัปเดตรีวิวแล้ว', action: 'updated' });
        }

        await db.query(
            'INSERT INTO review (userEmail, propertyId, ratingScore, comment, createdAt) VALUES (?,?,?,?,NOW())',
            [userEmail, propertyId, ratingScore, comment || '']
        );
        res.json({ success: true, message: 'บันทึกรีวิวแล้ว', action: 'created' });
    } catch (err) {
        console.error('POST review error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
