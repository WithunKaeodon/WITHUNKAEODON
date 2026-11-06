-- Migration: เพิ่ม banReason ในตาราง user + สร้างตาราง userappeal
-- รัน 1 ครั้ง: mysql -u root -p project < migrations/add_ban_reason.sql

-- 1. เพิ่มคอลัมน์ banReason (ถ้ายังไม่มี)
ALTER TABLE `user`
  ADD COLUMN IF NOT EXISTS `banReason` VARCHAR(500) DEFAULT NULL AFTER `suspendAt`;

-- 2. สร้างตารางสำหรับเก็บคำร้องโต้แย้งการระงับบัญชี
CREATE TABLE IF NOT EXISTS `userappeal` (
  `appealId` int(11) NOT NULL AUTO_INCREMENT,
  `userEmail` varchar(255) NOT NULL,
  `banReason` varchar(500) DEFAULT NULL,
  `appealMessage` text NOT NULL,
  `status` enum('PENDING','REVIEWING','APPROVED','REJECTED') DEFAULT 'PENDING',
  `adminNote` text DEFAULT NULL,
  `submittedAt` datetime DEFAULT current_timestamp(),
  `reviewedAt` datetime DEFAULT NULL,
  PRIMARY KEY (`appealId`),
  KEY `userEmail` (`userEmail`),
  CONSTRAINT `userappeal_ibfk_1` FOREIGN KEY (`userEmail`) REFERENCES `user` (`email`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ตรวจสอบ
-- SELECT email, status, banReason FROM user LIMIT 5;
-- SELECT * FROM userappeal;
