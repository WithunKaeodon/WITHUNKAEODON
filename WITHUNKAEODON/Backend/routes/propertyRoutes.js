const express = require('express');
const router = express.Router();
const { createProperty } = require('../controllers/add-property');
const { updateProperty } = require('../controllers/edit-property');
const db = require('../config/db');

// GET /api/properties -> ดึงข้อมูลที่พักทั้งหมด (พร้อมรูปแรก + facilities)
router.get('/', async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT
                p.*,
                (SELECT pi.imageUrl FROM propertyimage pi
                 WHERE pi.propertyId = p.propertyId
                 ORDER BY pi.imageId ASC LIMIT 1) AS coverImage
            FROM property p
            WHERE p.isPublished = 1
            ORDER BY p.createdAt DESC
        `);

        if (rows.length === 0) {
            return res.json({ success: true, data: [] });
        }

        // ดึง facilities ทั้งหมดในคราวเดียว
        const ids = rows.map(r => r.propertyId);
        const [roomFacs] = await db.query(
            `SELECT * FROM roomfacility WHERE propertyId IN (?)`, [ids]
        );
        const [bldgFacs] = await db.query(
            `SELECT * FROM buildingfacilities WHERE propertyId IN (?)`, [ids]
        );

        // map เป็น object เพื่อ lookup เร็ว
        const roomMap = {};
        roomFacs.forEach(r => { roomMap[r.propertyId] = r; });
        const bldgMap = {};
        bldgFacs.forEach(b => { bldgMap[b.propertyId] = b; });

        const data = rows.map(p => ({
            ...p,
            roomFacility:     roomMap[p.propertyId]     || null,
            buildingFacility: bldgMap[p.propertyId]     || null,
        }));

        res.json({ success: true, data });
    } catch (error) {
        console.error('Error fetching properties:', error);
        res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการดึงข้อมูล' });
    }
});

// GET /api/properties/:id -> ดึงข้อมูลที่พักตาม ID พร้อมรูปและ facilities
router.get('/:id', async (req, res) => {
    try {
        const propertyId = req.params.id;

        // ดึงข้อมูลหลัก
        const [rows] = await db.query('SELECT * FROM property WHERE propertyId = ?', [propertyId]);
        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: 'ไม่พบข้อมูลที่พัก' });
        }
        const prop = rows[0];

        // ── ป้องกันการเข้าถึงประกาศที่ถูกปิดการมองเห็น ──────────────────────────
        // อนุญาต: เจ้าของเอง (query ?viewerEmail=...) และ Admin (header x-admin-email: admin)
        // ใช้ !prop.isPublished เพื่อรองรับทั้ง 0 (number) และ false (boolean) จาก MySQL
        if (!prop.isPublished) {
            const viewerEmail   = req.query.viewerEmail  || '';
            const adminEmail    = req.headers['x-admin-email'] || '';
            const isOwner       = viewerEmail && viewerEmail === prop.ownerEmail;
            const callerIsAdmin = adminEmail === 'admin';

            if (!isOwner && !callerIsAdmin) {
                return res.status(404).json({
                    success: false,
                    message: 'ไม่พบประกาศนี้ หรือประกาศถูกปิดการมองเห็นแล้ว',
                    blocked: true
                });
            }
        }

        // ดึงรูปทั้งหมด
        const [images] = await db.query(
            'SELECT imageUrl FROM propertyimage WHERE propertyId = ? ORDER BY imageId ASC',
            [propertyId]
        );

        // ดึง room facility
        const [roomFac] = await db.query('SELECT * FROM roomfacility WHERE propertyId = ?', [propertyId]);

        // ดึง building facility
        const [bldgFac] = await db.query('SELECT * FROM buildingfacilities WHERE propertyId = ?', [propertyId]);

        // ดึงข้อมูลเจ้าของ
        const [ownerRows] = await db.query(
            'SELECT firstName, lastName, phone, profileImage FROM user WHERE email = ?',
            [prop.ownerEmail]
        );

        // ดึง roomtypes
        let roomTypes = [];
        try {
            const [rtRows] = await db.query(
                'SELECT * FROM roomtype WHERE propertyId = ? ORDER BY roomTypeId ASC',
                [propertyId]
            );
            roomTypes = rtRows;
        } catch (e) { /* table อาจยังไม่มี — ไม่ crash */ }

        res.json({
            success: true,
            data: {
                ...prop,
                images: images.map(i => i.imageUrl),
                roomFacility: roomFac[0] || null,
                buildingFacility: bldgFac[0] || null,
                owner: ownerRows[0] || null,
                roomTypes,
            }
        });
    } catch (error) {
        console.error('Error fetching property detail:', error);
        res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการดึงข้อมูล' });
    }
});

// GET /api/properties/:id/images -> ดึงรูปทั้งหมดพร้อม imageId
router.get('/:id/images', async (req, res) => {
    try {
        const [rows] = await db.query(
            'SELECT imageId, imageUrl FROM propertyimage WHERE propertyId = ? ORDER BY imageId ASC',
            [req.params.id]
        );
        res.json({ success: true, data: rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// POST /api/properties -> บันทึกข้อมูลที่พักใหม่
router.post('/', createProperty);

// PUT /api/properties/:id -> แก้ไขข้อมูลที่พัก
router.put('/:id', updateProperty);

// PATCH /api/properties/:id/publish -> toggle เปิด/ปิดการเผยแพร่
router.patch('/:id/publish', async (req, res) => {
    try {
        const { id } = req.params;
        const { isPublished, ownerEmail } = req.body;

        // ตรวจสอบว่าเป็นเจ้าของจริง
        const [rows] = await db.query('SELECT ownerEmail FROM property WHERE propertyId = ?', [id]);
        if (rows.length === 0) return res.status(404).json({ success: false, message: 'ไม่พบที่พัก' });
        if (rows[0].ownerEmail !== ownerEmail)
            return res.status(403).json({ success: false, message: 'ไม่มีสิทธิ์แก้ไขประกาศนี้' });

        await db.query('UPDATE property SET isPublished = ? WHERE propertyId = ?', [isPublished ? 1 : 0, id]);
        res.json({ success: true, message: isPublished ? 'เปิดเผยแพร่แล้ว' : 'ปิดการมองเห็นแล้ว' });
    } catch (err) {
        console.error('toggle publish error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// DELETE /api/properties/:id -> ลบที่พักและข้อมูลที่เกี่ยวข้อง
router.delete('/:id', async (req, res) => {
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();
        const { id } = req.params;
        const { ownerEmail } = req.body;

        const [rows] = await conn.query('SELECT ownerEmail FROM property WHERE propertyId = ?', [id]);
        if (rows.length === 0) { await conn.rollback(); conn.release(); return res.status(404).json({ success: false, message: 'ไม่พบที่พัก' }); }
        if (rows[0].ownerEmail !== ownerEmail) { await conn.rollback(); conn.release(); return res.status(403).json({ success: false, message: 'ไม่มีสิทธิ์ลบประกาศนี้' }); }

        // ลบ child tables ก่อน เพราะมี FK
        await conn.query('DELETE FROM propertyimage WHERE propertyId = ?', [id]);
        await conn.query('DELETE FROM roomfacility WHERE propertyId = ?', [id]);
        await conn.query('DELETE FROM buildingfacilities WHERE propertyId = ?', [id]);
        await conn.query('DELETE FROM property WHERE propertyId = ?', [id]);

        await conn.commit();
        conn.release();
        res.json({ success: true, message: 'ลบประกาศเรียบร้อยแล้ว' });
    } catch (err) {
        await conn.rollback();
        conn.release();
        console.error('delete property error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
