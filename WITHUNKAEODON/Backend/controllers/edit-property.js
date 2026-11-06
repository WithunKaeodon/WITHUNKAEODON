const db = require('../config/db');

const ROOM_FACILITY_MAP = {
    'เครื่องปรับอากาศ':           'hasAirConditioner',
    'พัดลม':                      'hasFan',
    'เครื่องทำน้ำอุ่น':            'hasWaterHeater',
    'เคเบิลทีวี/ดาวเทียม':        'hasCableTV',
    'ตู้เย็น':                    'hasRefrigerator',
    'อินเทอร์เน็ตในห้อง (Wi-Fi)':  'hasInRoomWifi',
    'โซฟา':                       'hasSofa',
    'โต๊ะทำงาน':                   'hasWorkDeskChair',
    'เตาปรุงอาหาร':                'hasStove',
    'สัตว์เลี้ยง':                 'isPetAllowed',
    'สูบบุหรี่':                   'isSmokingAllowed',
};

const BUILDING_FACILITY_MAP = {
    'คีย์การ์ด':          'hasKeycardAccess',
    'ลายนิ้วมือ':         'hasFingerprintAccess',
    'รปภ':               'hasSecurityGuard',
    'CCTV':              'hasCCTV',
    'ที่จอดมอเตอร์ไซค์':  'hasBikeParking',
    'ที่จอดรถยนต์':       'hasCarParking',
    'สระว่ายน้ำ':         'hasSwimmingPool',
    'ฟิตเนส':            'hasFitness',
    'ร้านซักรีด':         'hasLaundry',
    'ลิฟต์':             'hasElevator',
    'ร้านค้า':            'hasShop',
    'ร้านอาหาร':          'hasRestaurant',
    'EV Charger':        'hasEvCharger',
};

const TYPE_MAP = {
    'room':      'DORMITORY',
    'house':     'HOUSE',
    'apartment': 'APARTMENT',
    'condo':     'CONDO',
};

// PUT /api/properties/:id — อัปเดตข้อมูลที่พักทั้งหมด
const updateProperty = async (req, res) => {
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        const propertyId = req.params.id;
        const {
            ownerEmail,
            title, propertyType,
            pinX, pinY,
            province, district, subdistrict, address,
            priceDaily, priceMonthly, priceYearly, priceTerm,
            areaSqm, bedCount, bedSize, bedRooms, bathRooms,
            roomAmenities = [], buildingAmenities = [],
            newImages = [],
            deleteImageIds = []
        } = req.body;

        // ตรวจสอบเจ้าของ (admin ข้ามได้)
        const [rows] = await conn.query('SELECT ownerEmail FROM property WHERE propertyId = ?', [propertyId]);
        if (rows.length === 0) {
            await conn.rollback(); conn.release();
            return res.status(404).json({ success: false, message: 'ไม่พบที่พัก' });
        }
        if (ownerEmail !== 'admin' && rows[0].ownerEmail !== ownerEmail) {
            await conn.rollback(); conn.release();
            return res.status(403).json({ success: false, message: 'ไม่มีสิทธิ์แก้ไขประกาศนี้' });
        }

        // 1. UPDATE ตาราง property
        const dbType = TYPE_MAP[propertyType] || 'APARTMENT';
        await conn.query(
            `UPDATE property SET
                title=?, propertyType=?,
                priceDaily=?, priceMonthly=?, priceYearly=?, priceSemester=?,
                roomSize=?, bedCount=?, bedSize=?, bedrooms=?, bathrooms=?,
                province=?, district=?, subdistrict=?, addressDetail=?,
                latitude=?, longitude=?
             WHERE propertyId=?`,
            [
                title, dbType,
                priceDaily || 0, priceMonthly || 0, priceYearly || 0, priceTerm || 0,
                areaSqm || 0, bedCount || 0, bedSize || null,
                bedRooms || 1, bathRooms || 1,
                province || '', district || '', subdistrict || '', address || '',
                pinY || null, pinX || null,
                propertyId
            ]
        );

        // 2. UPDATE roomfacility (REPLACE ทั้ง row)
        const roomCols = Object.values(ROOM_FACILITY_MAP);
        const roomVals = roomCols.map(col => {
            const key = Object.keys(ROOM_FACILITY_MAP).find(k => ROOM_FACILITY_MAP[k] === col);
            return roomAmenities.includes(key) ? 1 : 0;
        });
        // upsert: ถ้ายังไม่มี row ให้ insert ด้วย
        const [rfRows] = await conn.query('SELECT roomFacilityId FROM roomfacility WHERE propertyId=?', [propertyId]);
        if (rfRows.length > 0) {
            await conn.query(
                `UPDATE roomfacility SET ${roomCols.map(c => `${c}=?`).join(', ')} WHERE propertyId=?`,
                [...roomVals, propertyId]
            );
        } else {
            await conn.query(
                `INSERT INTO roomfacility (propertyId, ${roomCols.join(', ')}) VALUES (?, ${roomCols.map(() => '?').join(', ')})`,
                [propertyId, ...roomVals]
            );
        }

        // 3. UPDATE buildingfacilities
        const bldgCols = Object.values(BUILDING_FACILITY_MAP);
        const bldgVals = bldgCols.map(col => {
            const key = Object.keys(BUILDING_FACILITY_MAP).find(k => BUILDING_FACILITY_MAP[k] === col);
            return buildingAmenities.includes(key) ? 1 : 0;
        });
        const [bfRows] = await conn.query('SELECT buildingFacilityId FROM buildingfacilities WHERE propertyId=?', [propertyId]);
        if (bfRows.length > 0) {
            await conn.query(
                `UPDATE buildingfacilities SET ${bldgCols.map(c => `${c}=?`).join(', ')} WHERE propertyId=?`,
                [...bldgVals, propertyId]
            );
        } else {
            await conn.query(
                `INSERT INTO buildingfacilities (propertyId, ${bldgCols.join(', ')}) VALUES (?, ${bldgCols.map(() => '?').join(', ')})`,
                [propertyId, ...bldgVals]
            );
        }

        // 4. ลบรูปที่เลือกลบ
        if (deleteImageIds.length > 0) {
            await conn.query(
                `DELETE FROM propertyimage WHERE imageId IN (${deleteImageIds.map(() => '?').join(',')}) AND propertyId=?`,
                [...deleteImageIds, propertyId]
            );
        }

        // 5. เพิ่มรูปใหม่ (ทีละรูปป้องกัน packet size เกิน)
        if (newImages.length > 0) {
            for (const img of newImages) {
                await conn.query(
                    'INSERT INTO propertyimage (propertyId, imageUrl) VALUES (?, ?)',
                    [propertyId, img]
                );
            }
        }

        await conn.commit();
        conn.release();
        res.json({ success: true, message: 'บันทึกการแก้ไขเรียบร้อยแล้ว!' });

    } catch (error) {
        await conn.rollback();
        conn.release();
        console.error('updateProperty error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = { updateProperty };
