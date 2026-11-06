const mysql = require('mysql2/promise');

// ตั้งค่าการเชื่อมต่อ MySQL (XAMPP)
const db = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'project',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    charset: 'utf8mb4',          // รองรับภาษาไทยและ Emoji
    // บังคับให้ทุก connection ใช้ utf8mb4 ทันทีเมื่อเชื่อมต่อ
    // แก้ปัญหาภาษาไทยแสดงผลผิดหรือเป็น ??
    multipleStatements: false,
    // รองรับรูปภาพ base64 ขนาดใหญ่
    maxAllowedPacket: 64 * 1024 * 1024  // 64MB
});

// ฟังก์ชันทดสอบการเชื่อมต่อ
async function testConnection() {
    try {
        const connection = await db.getConnection();
        console.log('✅ เชื่อมต่อฐานข้อมูล MySQL สำเร็จ!');
        connection.release();
    } catch (error) {
        console.error('❌ เชื่อมต่อฐานข้อมูลไม่สำเร็จ:', error.message);
    }
}

testConnection();

module.exports = db;