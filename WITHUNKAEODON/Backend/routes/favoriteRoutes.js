const express = require('express');
const router  = express.Router();
const db      = require('../config/db');

// GET /api/favorites?email=xxx — ดึงรายการโปรดทั้งหมดของ user
router.get('/', async (req, res) => {
    try {
        const { email } = req.query;
        if (!email) return res.status(400).json({ success: false, message: 'ไม่ระบุ email' });

        const [rows] = await db.query(
            `SELECT f.favoriteId, f.propertyId, f.addedAt,
                    p.title, p.propertyType, p.ownerEmail,
                    p.priceMonthly, p.priceDaily, p.province,
                    (SELECT pi.imageUrl FROM propertyimage pi
                     WHERE pi.propertyId = f.propertyId
                     ORDER BY pi.imageId ASC LIMIT 1) AS coverImage
             FROM favorite f
             LEFT JOIN property p ON f.propertyId = p.propertyId
             WHERE f.userEmail = ?
             ORDER BY f.addedAt DESC`,
            [email]
        );
        res.json({ success: true, data: rows });
    } catch (err) {
        console.error('GET favorites error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// POST /api/favorites — เพิ่มรายการโปรด
router.post('/', async (req, res) => {
    try {
        const { email, propertyId } = req.body;
        if (!email || !propertyId) return res.status(400).json({ success: false, message: 'ข้อมูลไม่ครบ' });

        // เช็คว่ามีอยู่แล้วไหม
        const [existing] = await db.query(
            'SELECT favoriteId FROM favorite WHERE userEmail=? AND propertyId=?',
            [email, propertyId]
        );
        if (existing.length > 0) {
            return res.json({ success: true, action: 'already_exists' });
        }

        await db.query(
            'INSERT INTO favorite (userEmail, propertyId, addedAt) VALUES (?, ?, NOW())',
            [email, propertyId]
        );
        res.json({ success: true, action: 'added' });
    } catch (err) {
        console.error('POST favorite error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// DELETE /api/favorites — ลบออกจากรายการโปรด
router.delete('/', async (req, res) => {
    try {
        const { email, propertyId } = req.body;
        if (!email || !propertyId) return res.status(400).json({ success: false, message: 'ข้อมูลไม่ครบ' });

        await db.query(
            'DELETE FROM favorite WHERE userEmail=? AND propertyId=?',
            [email, propertyId]
        );
        res.json({ success: true, action: 'removed' });
    } catch (err) {
        console.error('DELETE favorite error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
