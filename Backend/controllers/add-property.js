const db = require('../config/db');

// mapping ชื่อ checkbox value -> column ใน roomfacility
const ROOM_FACILITY_MAP = {
    'เครื่องปรับอากาศ':          'hasAirConditioner',
    'พัดลม':                     'hasFan',
    'เครื่องทำน้ำอุ่น':           'hasWaterHeater',
    'เคเบิลทีวี/ดาวเทียม':       'hasCableTV',
    'ตู้เย็น':                   'hasRefrigerator',
    'อินเทอร์เน็ตในห้อง (Wi-Fi)': 'hasInRoomWifi',
    'โซฟา':                      'hasSofa',
    'โต๊ะทำงาน':                  'hasWorkDeskChair',
    'เตาปรุงอาหาร':               'hasStove',
    'สัตว์เลี้ยง':                'isPetAllowed',
    'สูบบุหรี่':                  'isSmokingAllowed',
};

// mapping ชื่อ checkbox value -> column ใน buildingfacilities
const BUILDING_FACILITY_MAP = {
    'คีย์การ์ด':       'hasKeycardAccess',
    'ลายนิ้วมือ':     'hasFingerprintAccess',
    'รปภ':            'hasSecurityGuard',
    'CCTV':           'hasCCTV',
    'ที่จอดมอเตอร์ไซค์': 'hasBikeParking',
    'ที่จอดรถยนต์':   'hasCarParking',
    'สระว่ายน้ำ':     'hasSwimmingPool',
    'ฟิตเนส':         'hasFitness',
    'ร้านซักรีด':     'hasLaundry',
    'ลิฟต์':          'hasElevator',
    'ร้านค้า':         'hasShop',
    'ร้านอาหาร':      'hasRestaurant',
    'EV Charger':     'hasEvCharger',
};

// mapping propertyType จาก form value -> ENUM ใน DB
const TYPE_MAP = {
    'room':      'DORMITORY',
    'house':     'HOUSE',
    'apartment': 'APARTMENT',
    'condo':     'CONDO',
};

const createProperty = async (req, res) => {
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        const {
            ownerEmail,
            title, propertyType,
            pinX, pinY,
            province, district, subdistrict, address,
            priceDaily, priceMonthly, priceYearly, priceTerm,
            bedRooms, bathRooms, areaSqm, bedCount, bedSize,
            roomAmenities = [], buildingAmenities = [], images = []
        } = req.body;

        if (!title || !propertyType) {
            await conn.rollback();
            conn.release();
            return res.status(400).json({ success: false, message: 'กรุณากรอกชื่อที่พักและประเภทให้ครบถ้วน' });
        }

        if (!ownerEmail) {
            await conn.rollback();
            conn.release();
            return res.status(400).json({ success: false, message: 'ไม่พบข้อมูลผู้ใช้ กรุณาเข้าสู่ระบบก่อน' });
        }

        // 1. INSERT ลงตาราง property
        const dbType = TYPE_MAP[propertyType] || 'APARTMENT';
        const [propResult] = await conn.query(
            `INSERT INTO property (
                ownerEmail, title, propertyType,
                priceDaily, priceMonthly, priceYearly, priceSemester,
                roomSize, bedCount, bedSize, bedrooms, bathrooms,
                province, district, subdistrict, addressDetail,
                latitude, longitude,
                isPublished, createdAt
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, NOW())`,
            [
                ownerEmail, title, dbType,
                priceDaily || 0, priceMonthly || 0, priceYearly || 0, priceTerm || 0,
                areaSqm || 0, bedCount || 0, bedSize || null,
                bedRooms || 1, bathRooms || 1,
                province || '', district || '', subdistrict || '', address || '',
                pinY || null, pinX || null,
            ]
        );
        const propertyId = propResult.insertId;

        // 2. INSERT roomfacility
        const roomCols = Object.values(ROOM_FACILITY_MAP);
        const roomVals = roomCols.map(col => {
            const matchedKey = Object.keys(ROOM_FACILITY_MAP).find(k => ROOM_FACILITY_MAP[k] === col);
            return roomAmenities.includes(matchedKey) ? 1 : 0;
        });
        await conn.query(
            `INSERT INTO roomfacility (propertyId, ${roomCols.join(', ')}) VALUES (?, ${roomCols.map(() => '?').join(', ')})`,
            [propertyId, ...roomVals]
        );

        // 3. INSERT buildingfacilities
        const bldgCols = Object.values(BUILDING_FACILITY_MAP);
        const bldgVals = bldgCols.map(col => {
            const matchedKey = Object.keys(BUILDING_FACILITY_MAP).find(k => BUILDING_FACILITY_MAP[k] === col);
            return buildingAmenities.includes(matchedKey) ? 1 : 0;
        });
        await conn.query(
            `INSERT INTO buildingfacilities (propertyId, ${bldgCols.join(', ')}) VALUES (?, ${bldgCols.map(() => '?').join(', ')})`,
            [propertyId, ...bldgVals]
        );

        // 4. INSERT รูปภาพ ทีละรูป (ป้องกัน packet size เกิน)
        if (images.length > 0) {
            for (const img of images) {
                await conn.query(
                    `INSERT INTO propertyimage (propertyId, imageUrl) VALUES (?, ?)`,
                    [propertyId, img]
                );
            }
        }

        await conn.commit();
        conn.release();

        res.json({
            success: true,
            message: 'เพิ่มข้อมูลเรียบร้อยแล้ว!',
            propertyId
        });

    } catch (error) {
        await conn.rollback();
        conn.release();
        console.error('Error adding property:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = { createProperty };
