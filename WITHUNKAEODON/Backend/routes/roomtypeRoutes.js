const express = require('express');
const router  = express.Router();
const db      = require('../config/db');

// GET /api/roomtypes/:propertyId
router.get('/:propertyId', async (req, res) => {
    try {
        const [rows] = await db.query(
            'SELECT * FROM roomtype WHERE propertyId = ? ORDER BY roomTypeId ASC',
            [req.params.propertyId]
        );
        res.json({ success: true, data: rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// POST /api/roomtypes
router.post('/', async (req, res) => {
    try {
        const {
            propertyId, typeName,
            priceMonthly, priceDaily, priceYearly, priceSemester,
            roomSize, bedCount, bedSize, totalRooms,
            hasAirConditioner, hasFan, hasWaterHeater, hasCableTV,
            hasRefrigerator, hasInRoomWifi, hasSofa, hasWorkDeskChair,
            hasStove, isPetAllowed, isSmokingAllowed,
        } = req.body;

        if (!propertyId || !typeName)
            return res.status(400).json({ success: false, message: 'กรุณาระบุ propertyId และชื่อประเภทห้อง' });

        const [result] = await db.query(
            `INSERT INTO roomtype (
                propertyId, typeName,
                priceMonthly, priceDaily, priceYearly, priceSemester,
                roomSize, bedCount, bedSize, totalRooms,
                hasAirConditioner, hasFan, hasWaterHeater, hasCableTV,
                hasRefrigerator, hasInRoomWifi, hasSofa, hasWorkDeskChair,
                hasStove, isPetAllowed, isSmokingAllowed
            ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
            [
                propertyId, typeName,
                parseFloat(priceMonthly)  || null,
                parseFloat(priceDaily)    || null,
                parseFloat(priceYearly)   || null,
                parseFloat(priceSemester) || null,
                parseFloat(roomSize)      || null,
                parseInt(bedCount)        || null,
                bedSize || null,
                parseInt(totalRooms)      || null,
                hasAirConditioner  ? 1 : 0, hasFan           ? 1 : 0,
                hasWaterHeater     ? 1 : 0, hasCableTV        ? 1 : 0,
                hasRefrigerator    ? 1 : 0, hasInRoomWifi     ? 1 : 0,
                hasSofa            ? 1 : 0, hasWorkDeskChair  ? 1 : 0,
                hasStove           ? 1 : 0, isPetAllowed      ? 1 : 0,
                isSmokingAllowed   ? 1 : 0,
            ]
        );
        res.json({ success: true, roomTypeId: result.insertId, message: 'เพิ่มประเภทห้องเรียบร้อยแล้ว' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// PUT /api/roomtypes/:roomTypeId
router.put('/:roomTypeId', async (req, res) => {
    try {
        const { roomTypeId } = req.params;
        const {
            typeName,
            priceMonthly, priceDaily, priceYearly, priceSemester,
            roomSize, bedCount, bedSize, totalRooms,
            hasAirConditioner, hasFan, hasWaterHeater, hasCableTV,
            hasRefrigerator, hasInRoomWifi, hasSofa, hasWorkDeskChair,
            hasStove, isPetAllowed, isSmokingAllowed,
        } = req.body;

        await db.query(
            `UPDATE roomtype SET
                typeName=?,
                priceMonthly=?, priceDaily=?, priceYearly=?, priceSemester=?,
                roomSize=?, bedCount=?, bedSize=?, totalRooms=?,
                hasAirConditioner=?, hasFan=?, hasWaterHeater=?, hasCableTV=?,
                hasRefrigerator=?, hasInRoomWifi=?, hasSofa=?, hasWorkDeskChair=?,
                hasStove=?, isPetAllowed=?, isSmokingAllowed=?
             WHERE roomTypeId=?`,
            [
                typeName,
                parseFloat(priceMonthly)  || null,
                parseFloat(priceDaily)    || null,
                parseFloat(priceYearly)   || null,
                parseFloat(priceSemester) || null,
                parseFloat(roomSize)      || null,
                parseInt(bedCount)        || null,
                bedSize || null,
                parseInt(totalRooms)      || null,
                hasAirConditioner  ? 1 : 0, hasFan           ? 1 : 0,
                hasWaterHeater     ? 1 : 0, hasCableTV        ? 1 : 0,
                hasRefrigerator    ? 1 : 0, hasInRoomWifi     ? 1 : 0,
                hasSofa            ? 1 : 0, hasWorkDeskChair  ? 1 : 0,
                hasStove           ? 1 : 0, isPetAllowed      ? 1 : 0,
                isSmokingAllowed   ? 1 : 0,
                roomTypeId,
            ]
        );
        res.json({ success: true, message: 'แก้ไขประเภทห้องเรียบร้อยแล้ว' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// DELETE /api/roomtypes/:roomTypeId
router.delete('/:roomTypeId', async (req, res) => {
    try {
        await db.query('DELETE FROM roomtype WHERE roomTypeId = ?', [req.params.roomTypeId]);
        res.json({ success: true, message: 'ลบประเภทห้องเรียบร้อยแล้ว' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
