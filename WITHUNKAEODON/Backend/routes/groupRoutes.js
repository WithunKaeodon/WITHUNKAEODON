const express = require('express');
const router  = express.Router();
const db      = require('../config/db');

// ── helper: ตรวจว่า propertyIds ใดที่อยู่ group อื่นแล้ว (Exclusive check)
// ส่งคืน array ของ { propertyId, groupId, groupName } ที่ conflict
async function findConflicts(conn, propertyIds, excludeGroupId = null) {
    if (!propertyIds.length) return [];
    let sql = `
        SELECT pgm.propertyId, pgm.groupId, pg.groupName, p.title
        FROM propertygroupmember pgm
        JOIN propertygroup pg ON pgm.groupId = pg.groupId
        JOIN property p ON pgm.propertyId = p.propertyId
        WHERE pgm.propertyId IN (?)`;
    const params = [propertyIds];
    if (excludeGroupId) {
        sql += ' AND pgm.groupId != ?';
        params.push(excludeGroupId);
    }
    const [rows] = await conn.query(sql, params);
    return rows;
}

// ── GET /api/groups/owner/:email
// ดึงกลุ่มทั้งหมดของเจ้าของ พร้อมรายชื่อ property + flag ว่า property ไหนถูก group อื่นจอง
router.get('/owner/:email', async (req, res) => {
    try {
        const { email } = req.params;

        const [groups] = await db.query(
            'SELECT groupId, groupName FROM propertygroup WHERE ownerEmail = ? ORDER BY groupId ASC',
            [email]
        );

        if (!groups.length) return res.json({ success: true, data: [], groupedPropertyIds: [] });

        const groupIds = groups.map(g => g.groupId);
        const [members] = await db.query(`
            SELECT
                pgm.groupId,
                p.propertyId, p.title,
                p.priceMonthly, p.priceDaily,
                (SELECT pi.imageUrl FROM propertyimage pi
                 WHERE pi.propertyId = p.propertyId
                 ORDER BY pi.imageId ASC LIMIT 1) AS coverImage
            FROM propertygroupmember pgm
            JOIN property p ON pgm.propertyId = p.propertyId
            WHERE pgm.groupId IN (?)
            ORDER BY p.propertyId ASC
        `, [groupIds]);

        const membersByGroup = {};
        members.forEach(m => {
            if (!membersByGroup[m.groupId]) membersByGroup[m.groupId] = [];
            membersByGroup[m.groupId].push(m);
        });

        const data = groups.map(g => ({
            groupId:   g.groupId,
            groupName: g.groupName || '',
            members:   membersByGroup[g.groupId] || [],
        }));

        // รายการ propertyId ทั้งหมดที่อยู่ใน group ของ owner นี้
        const groupedPropertyIds = members.map(m => m.propertyId);

        res.json({ success: true, data, groupedPropertyIds });
    } catch (err) {
        console.error('GET groups/owner error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── GET /api/groups/all-grouped
// ดึงทุก group พร้อม members + ราคา สำหรับคำนวณ price range บนหน้าหลัก
router.get('/all-grouped', async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT
                pgm.groupId,
                p.propertyId,
                p.priceMonthly, p.priceDaily, p.priceSemester, p.priceYearly
            FROM propertygroupmember pgm
            JOIN property p ON pgm.propertyId = p.propertyId
            WHERE p.isPublished = 1
            ORDER BY pgm.groupId ASC, p.propertyId ASC
        `);

        // จัดกลุ่ม
        const groups = {};
        rows.forEach(r => {
            if (!groups[r.groupId]) groups[r.groupId] = [];
            groups[r.groupId].push(r);
        });

        // คำนวณ price range ต่อ group แล้ว map propertyId → range
        const priceMap = {}; // propertyId → { monthly, daily, semester, yearly }

        Object.values(groups).forEach(members => {
            if (members.length < 2) return;

            const types = [
                { key: 'monthly',  field: 'priceMonthly',  unit: '/เดือน' },
                { key: 'daily',    field: 'priceDaily',    unit: '/วัน'   },
                { key: 'semester', field: 'priceSemester', unit: '/เทอม'  },
                { key: 'yearly',   field: 'priceYearly',   unit: '/ปี'    },
            ];

            const range = {};
            types.forEach(({ key, field, unit }) => {
                const vals = members.map(m => parseFloat(m[field]) || 0).filter(v => v > 0);
                if (vals.length > 0) {
                    range[key] = { min: Math.min(...vals), max: Math.max(...vals), unit };
                }
            });

            members.forEach(m => { priceMap[m.propertyId] = range; });
        });

        res.json({ success: true, priceMap });
    } catch (err) {
        console.error('GET all-grouped error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── GET /api/groups/by-property/:propertyId
// ดึง property อื่นที่อยู่กลุ่มเดียวกัน (Bidirectional — สำหรับ view-property ปุ่มสลับ)
router.get('/by-property/:propertyId', async (req, res) => {
    try {
        const { propertyId } = req.params;

        const [membership] = await db.query(
            'SELECT groupId FROM propertygroupmember WHERE propertyId = ?',
            [propertyId]
        );
        if (!membership.length) return res.json({ success: true, groupName: null, data: [] });

        const groupId = membership[0].groupId;

        const [grpRow] = await db.query(
            'SELECT groupName FROM propertygroup WHERE groupId = ?',
            [groupId]
        );
        const groupName = grpRow[0]?.groupName || null;

        // ดึงสมาชิก ทุกคนในกลุ่ม ยกเว้นตัวเอง (Bidirectional: A เห็น B,C / B เห็น A,C / C เห็น A,B)
        const [rows] = await db.query(`
            SELECT
                p.propertyId, p.title, p.propertyType,
                p.priceMonthly, p.priceDaily, p.priceSemester, p.priceYearly,
                (SELECT pi.imageUrl FROM propertyimage pi
                 WHERE pi.propertyId = p.propertyId
                 ORDER BY pi.imageId ASC LIMIT 1) AS coverImage
            FROM propertygroupmember pgm
            JOIN property p ON pgm.propertyId = p.propertyId
            WHERE pgm.groupId = ? AND pgm.propertyId != ? AND p.isPublished = 1
            ORDER BY p.propertyId ASC
        `, [groupId, propertyId]);

        res.json({ success: true, groupName, data: rows });
    } catch (err) {
        console.error('GET by-property error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── GET /api/groups/my-group/:propertyId
// ดึง groupId + สมาชิกทั้งหมด (สำหรับ edit-property pre-populate)
router.get('/my-group/:propertyId', async (req, res) => {
    try {
        const { propertyId } = req.params;
        const [membership] = await db.query(
            'SELECT groupId FROM propertygroupmember WHERE propertyId = ?',
            [propertyId]
        );
        if (!membership.length) return res.json({ success: true, groupId: null, members: [] });
        const groupId = membership[0].groupId;
        const [members] = await db.query(
            'SELECT propertyId FROM propertygroupmember WHERE groupId = ?',
            [groupId]
        );
        res.json({ success: true, groupId, members: members.map(m => m.propertyId) });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── POST /api/groups
// สร้างกลุ่มใหม่ — ตรวจ Exclusive: ห้าม property ที่อยู่ group อื่นแล้ว
router.post('/', async (req, res) => {
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        const { ownerEmail, groupName = '', propertyIds = [] } = req.body;

        if (!ownerEmail || propertyIds.length < 2) {
            await conn.rollback(); conn.release();
            return res.status(400).json({ success: false, message: 'ต้องเลือกอย่างน้อย 2 ประกาศ' });
        }

        // ตรวจว่าเป็นเจ้าของทุก property
        const [propRows] = await conn.query(
            'SELECT propertyId FROM property WHERE propertyId IN (?) AND ownerEmail = ?',
            [propertyIds, ownerEmail]
        );
        if (propRows.length !== propertyIds.length) {
            await conn.rollback(); conn.release();
            return res.status(403).json({ success: false, message: 'ไม่มีสิทธิ์' });
        }

        // ── Exclusive check: ตรวจว่ามี property ที่อยู่ group อื่นแล้วไหม
        const conflicts = await findConflicts(conn, propertyIds, null);
        if (conflicts.length > 0) {
            await conn.rollback(); conn.release();
            const names = [...new Set(conflicts.map(c => `"${c.title}"`))].join(', ');
            return res.status(409).json({
                success: false,
                message: `ประกาศ ${names} อยู่ในกลุ่มอื่นแล้ว กรุณาถอดออกจากกลุ่มเดิมก่อน`,
                conflicts: conflicts.map(c => ({ propertyId: c.propertyId, groupId: c.groupId, title: c.title }))
            });
        }

        // สร้าง group
        const [grpResult] = await conn.query(
            'INSERT INTO propertygroup (ownerEmail, groupName) VALUES (?, ?)',
            [ownerEmail, groupName.trim() || null]
        );
        const newGroupId = grpResult.insertId;

        for (const pid of propertyIds) {
            await conn.query(
                'INSERT IGNORE INTO propertygroupmember (groupId, propertyId) VALUES (?,?)',
                [newGroupId, pid]
            );
        }

        await conn.commit();
        conn.release();
        res.json({ success: true, groupId: newGroupId, message: 'สร้างกลุ่มเรียบร้อยแล้ว' });
    } catch (err) {
        await conn.rollback(); conn.release();
        console.error('POST groups error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── PUT /api/groups/:groupId
// แก้ไขกลุ่ม — ตรวจ Exclusive เฉพาะ property ที่ไม่ได้อยู่ group นี้อยู่แล้ว
router.put('/:groupId', async (req, res) => {
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        const { groupId } = req.params;
        const { ownerEmail, groupName = '', propertyIds = [] } = req.body;

        if (!ownerEmail) {
            await conn.rollback(); conn.release();
            return res.status(400).json({ success: false, message: 'ข้อมูลไม่ครบ' });
        }
        if (propertyIds.length < 2) {
            await conn.rollback(); conn.release();
            return res.status(400).json({ success: false, message: 'ต้องเลือกอย่างน้อย 2 ประกาศ' });
        }

        // ตรวจ ownership
        const [grpRow] = await conn.query(
            'SELECT ownerEmail FROM propertygroup WHERE groupId = ?',
            [groupId]
        );
        if (!grpRow.length || grpRow[0].ownerEmail !== ownerEmail) {
            await conn.rollback(); conn.release();
            return res.status(403).json({ success: false, message: 'ไม่มีสิทธิ์' });
        }

        // ── Exclusive check: ตรวจ conflict กับ group อื่น (ยกเว้น group ตัวเอง)
        const conflicts = await findConflicts(conn, propertyIds, parseInt(groupId));
        if (conflicts.length > 0) {
            await conn.rollback(); conn.release();
            const names = [...new Set(conflicts.map(c => `"${c.title}"`))].join(', ');
            return res.status(409).json({
                success: false,
                message: `ประกาศ ${names} อยู่ในกลุ่มอื่นแล้ว กรุณาถอดออกจากกลุ่มเดิมก่อน`,
                conflicts: conflicts.map(c => ({ propertyId: c.propertyId, groupId: c.groupId, title: c.title }))
            });
        }

        // อัปชื่อกลุ่ม
        await conn.query(
            'UPDATE propertygroup SET groupName = ? WHERE groupId = ?',
            [groupName.trim() || null, groupId]
        );

        // แทนที่ members
        await conn.query('DELETE FROM propertygroupmember WHERE groupId = ?', [groupId]);
        for (const pid of propertyIds) {
            await conn.query(
                'INSERT IGNORE INTO propertygroupmember (groupId, propertyId) VALUES (?,?)',
                [groupId, pid]
            );
        }

        await conn.commit();
        conn.release();
        res.json({ success: true, message: 'อัปเดตกลุ่มเรียบร้อยแล้ว' });
    } catch (err) {
        await conn.rollback(); conn.release();
        console.error('PUT groups error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── DELETE /api/groups/:groupId
router.delete('/:groupId', async (req, res) => {
    try {
        const { groupId } = req.params;
        const { ownerEmail } = req.body;

        const [grpRow] = await db.query(
            'SELECT ownerEmail FROM propertygroup WHERE groupId = ?',
            [groupId]
        );
        if (!grpRow.length || grpRow[0].ownerEmail !== ownerEmail) {
            return res.status(403).json({ success: false, message: 'ไม่มีสิทธิ์' });
        }

        await db.query('DELETE FROM propertygroupmember WHERE groupId = ?', [groupId]);
        await db.query('DELETE FROM propertygroup WHERE groupId = ?', [groupId]);

        res.json({ success: true, message: 'ลบกลุ่มเรียบร้อยแล้ว' });
    } catch (err) {
        console.error('DELETE groups error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
