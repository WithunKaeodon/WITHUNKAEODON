CREATE TABLE `user` (
  `email` varchar(255) NOT NULL,
  `password` varchar(255) NOT NULL,
  `firstName` varchar(100) NOT NULL,
  `lastName` varchar(100) NOT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `lineId` varchar(100) DEFAULT NULL,
  `facebook` varchar(200) DEFAULT NULL,
  `profileImage` longtext DEFAULT NULL,
  `role` enum('USER','ADMIN','OWNER') DEFAULT 'USER',
  `status` enum('ACTIVE','INACTIVE','BANNED') DEFAULT 'ACTIVE',
  `createdAt` datetime DEFAULT current_timestamp(),
  `suspendAt` datetime DEFAULT NULL,
  PRIMARY KEY (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `property` (
  `propertyId` int(11) NOT NULL AUTO_INCREMENT,
  `ownerEmail` varchar(255) NOT NULL,
  `title` varchar(255) NOT NULL,
  `propertyType` enum('APARTMENT','CONDO','HOUSE','DORMITORY') NOT NULL,
  `priceDaily` decimal(10,2) DEFAULT NULL,
  `priceMonthly` decimal(10,2) DEFAULT NULL,
  `priceYearly` decimal(10,2) DEFAULT NULL,
  `priceSemester` decimal(10,2) DEFAULT NULL,
  `roomSize` decimal(10,2) DEFAULT NULL,
  `bedCount` int(11) DEFAULT NULL,
  `bedSize` varchar(50) DEFAULT NULL,
  `bedrooms` int(11) DEFAULT 1,
  `bathrooms` int(11) DEFAULT 1,
  `province` varchar(100) DEFAULT NULL,
  `district` varchar(100) DEFAULT NULL,
  `subdistrict` varchar(100) DEFAULT NULL,
  `addressDetail` text DEFAULT NULL,
  `latitude` decimal(10,8) DEFAULT NULL,
  `longitude` decimal(11,8) DEFAULT NULL,
  `isPublished` tinyint(1) DEFAULT 0,
  `createdAt` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`propertyId`),
  KEY `ownerEmail` (`ownerEmail`),
  CONSTRAINT `property_ibfk_1` FOREIGN KEY (`ownerEmail`) REFERENCES `user` (`email`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=14 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `propertyimage` (
  `imageId` int(11) NOT NULL AUTO_INCREMENT,
  `propertyId` int(11) NOT NULL,
  `imageUrl` longtext DEFAULT NULL,
  PRIMARY KEY (`imageId`),
  KEY `propertyId` (`propertyId`),
  CONSTRAINT `propertyimage_ibfk_1` FOREIGN KEY (`propertyId`) REFERENCES `property` (`propertyId`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=20 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `roomfacility` (
  `roomFacilityId` int(11) NOT NULL AUTO_INCREMENT,
  `propertyId` int(11) NOT NULL,
  `hasAirConditioner` tinyint(1) DEFAULT 0,
  `hasFan` tinyint(1) DEFAULT 0,
  `hasCableTV` tinyint(1) DEFAULT 0,
  `hasRefrigerator` tinyint(1) DEFAULT 0,
  `hasWaterHeater` tinyint(1) DEFAULT 0,
  `hasInRoomWifi` tinyint(1) DEFAULT 0,
  `isPetAllowed` tinyint(1) DEFAULT 0,
  `isSmokingAllowed` tinyint(1) DEFAULT 0,
  `hasSofa` tinyint(1) DEFAULT 0,
  `hasWorkDeskChair` tinyint(1) DEFAULT 0,
  `hasStove` tinyint(1) DEFAULT 0,
  PRIMARY KEY (`roomFacilityId`),
  KEY `propertyId` (`propertyId`),
  CONSTRAINT `roomfacility_ibfk_1` FOREIGN KEY (`propertyId`) REFERENCES `property` (`propertyId`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `buildingfacilities` (
  `buildingFacilityId` int(11) NOT NULL AUTO_INCREMENT,
  `propertyId` int(11) NOT NULL,
  `hasKeycardAccess` tinyint(1) DEFAULT 0,
  `hasFingerprintAccess` tinyint(1) DEFAULT 0,
  `hasSecurityGuard` tinyint(1) DEFAULT 0,
  `hasCCTV` tinyint(1) DEFAULT 0,
  `hasBikeParking` tinyint(1) DEFAULT 0,
  `hasCarParking` tinyint(1) DEFAULT 0,
  `hasSwimmingPool` tinyint(1) DEFAULT 0,
  `hasFitness` tinyint(1) DEFAULT 0,
  `hasLaundry` tinyint(1) DEFAULT 0,
  `hasElevator` tinyint(1) DEFAULT 0,
  `hasShop` tinyint(1) DEFAULT 0,
  `hasRestaurant` tinyint(1) DEFAULT 0,
  `hasEvCharger` tinyint(1) DEFAULT 0,
  PRIMARY KEY (`buildingFacilityId`),
  KEY `propertyId` (`propertyId`),
  CONSTRAINT `buildingfacilities_ibfk_1` FOREIGN KEY (`propertyId`) REFERENCES `property` (`propertyId`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `chatmessage` (
  `chatId` int(11) NOT NULL AUTO_INCREMENT,
  `senderEmail` varchar(255) NOT NULL,
  `receiverEmail` varchar(255) NOT NULL,
  `propertyId` int(11) DEFAULT NULL,
  `messageText` longtext NOT NULL,
  `isRead` tinyint(1) DEFAULT 0,
  `sentAt` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`chatId`),
  KEY `senderEmail` (`senderEmail`),
  KEY `receiverEmail` (`receiverEmail`),
  KEY `propertyId` (`propertyId`),
  CONSTRAINT `chatmessage_ibfk_1` FOREIGN KEY (`senderEmail`) REFERENCES `user` (`email`) ON DELETE CASCADE,
  CONSTRAINT `chatmessage_ibfk_2` FOREIGN KEY (`receiverEmail`) REFERENCES `user` (`email`) ON DELETE CASCADE,
  CONSTRAINT `chatmessage_ibfk_3` FOREIGN KEY (`propertyId`) REFERENCES `property` (`propertyId`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=85 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `favorite` (
  `favoriteId` int(11) NOT NULL AUTO_INCREMENT,
  `userEmail` varchar(255) NOT NULL,
  `propertyId` int(11) NOT NULL,
  `addedAt` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`favoriteId`),
  KEY `userEmail` (`userEmail`),
  KEY `propertyId` (`propertyId`),
  CONSTRAINT `favorite_ibfk_1` FOREIGN KEY (`userEmail`) REFERENCES `user` (`email`) ON DELETE CASCADE,
  CONSTRAINT `favorite_ibfk_2` FOREIGN KEY (`propertyId`) REFERENCES `property` (`propertyId`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=21 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `issuereport` (
  `reportId` int(11) NOT NULL AUTO_INCREMENT,
  `reporterEmail` varchar(255) NOT NULL,
  `propertyId` int(11) NOT NULL,
  `reportType` enum('INAPPROPRIATE_CONTENT','SPAM','SCAM','INACCURATE_INFO','OTHER') NOT NULL,
  `description` text DEFAULT NULL,
  `status` enum('PENDING','IN_PROGRESS','RESOLVED','REJECTED') DEFAULT 'PENDING',
  `reportedAt` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`reportId`),
  KEY `reporterEmail` (`reporterEmail`),
  KEY `propertyId` (`propertyId`),
  CONSTRAINT `issuereport_ibfk_1` FOREIGN KEY (`reporterEmail`) REFERENCES `user` (`email`) ON DELETE CASCADE,
  CONSTRAINT `issuereport_ibfk_2` FOREIGN KEY (`propertyId`) REFERENCES `property` (`propertyId`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=14 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `review` (
  `reviewId` int(11) NOT NULL AUTO_INCREMENT,
  `userEmail` varchar(255) NOT NULL,
  `propertyId` int(11) NOT NULL,
  `ratingScore` int(11) DEFAULT NULL CHECK (`ratingScore` >= 1 and `ratingScore` <= 5),
  `comment` text DEFAULT NULL,
  `createdAt` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`reviewId`),
  KEY `userEmail` (`userEmail`),
  KEY `propertyId` (`propertyId`),
  CONSTRAINT `review_ibfk_1` FOREIGN KEY (`userEmail`) REFERENCES `user` (`email`) ON DELETE CASCADE,
  CONSTRAINT `review_ibfk_2` FOREIGN KEY (`propertyId`) REFERENCES `property` (`propertyId`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `admin` (
  `email` varchar(255) NOT NULL,
  `adminLevel` enum('SUPER_ADMIN','MODERATOR') DEFAULT 'MODERATOR',
  `lastLogin` datetime DEFAULT NULL,
  PRIMARY KEY (`email`),
  CONSTRAINT `admin_ibfk_1` FOREIGN KEY (`email`) REFERENCES `user` (`email`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


CREATE TABLE `roomtype` (
  `roomTypeId` int(11) NOT NULL AUTO_INCREMENT,
  `propertyId` int(11) NOT NULL,
  `typeName` varchar(100) NOT NULL,
  `priceMonthly` decimal(10,2) DEFAULT NULL,
  `priceDaily` decimal(10,2) DEFAULT NULL,
  `priceYearly` decimal(10,2) DEFAULT NULL,
  `priceSemester` decimal(10,2) DEFAULT NULL,
  `roomSize` decimal(10,2) DEFAULT NULL,
  `bedCount` int(11) DEFAULT NULL,
  `bedSize` varchar(50) DEFAULT NULL,
  `totalRooms` int(11) DEFAULT NULL,
  `hasAirConditioner` tinyint(1) DEFAULT 0,
  `hasFan` tinyint(1) DEFAULT 0,
  `hasWaterHeater` tinyint(1) DEFAULT 0,
  `hasCableTV` tinyint(1) DEFAULT 0,
  `hasRefrigerator` tinyint(1) DEFAULT 0,
  `hasInRoomWifi` tinyint(1) DEFAULT 0,
  `hasSofa` tinyint(1) DEFAULT 0,
  `hasWorkDeskChair` tinyint(1) DEFAULT 0,
  `hasStove` tinyint(1) DEFAULT 0,
  `isPetAllowed` tinyint(1) DEFAULT 0,
  `isSmokingAllowed` tinyint(1) DEFAULT 0,
  `createdAt` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`roomTypeId`),
  KEY `propertyId` (`propertyId`),
  CONSTRAINT `roomtype_ibfk_1` FOREIGN KEY (`propertyId`) REFERENCES `property` (`propertyId`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- กลุ่มที่พัก (เจ้าของจัดกลุ่มโพสต์ของตัวเองเพื่อแสดงปุ่มสลับใน view-property)
CREATE TABLE `propertygroup` (
  `groupId` int(11) NOT NULL AUTO_INCREMENT,
  `ownerEmail` varchar(255) NOT NULL,
  PRIMARY KEY (`groupId`),
  KEY `ownerEmail` (`ownerEmail`),
  CONSTRAINT `propertygroup_ibfk_1` FOREIGN KEY (`ownerEmail`) REFERENCES `user` (`email`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `propertygroupmember` (
  `groupId` int(11) NOT NULL,
  `propertyId` int(11) NOT NULL,
  PRIMARY KEY (`groupId`, `propertyId`),
  KEY `propertyId` (`propertyId`),
  CONSTRAINT `pgm_ibfk_1` FOREIGN KEY (`groupId`) REFERENCES `propertygroup` (`groupId`) ON DELETE CASCADE,
  CONSTRAINT `pgm_ibfk_2` FOREIGN KEY (`propertyId`) REFERENCES `property` (`propertyId`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- เพิ่ม groupName ใน propertygroup (ถ้ายังไม่มี)
ALTER TABLE `propertygroup` ADD COLUMN IF NOT EXISTS `groupName` varchar(100) DEFAULT NULL;

-- คอลัมน์ banReason ในตาราง user (สำหรับเก็บเหตุผลการระงับบัญชี)
ALTER TABLE `user` ADD COLUMN IF NOT EXISTS `banReason` VARCHAR(500) DEFAULT NULL AFTER `suspendAt`;

-- ตารางสำหรับเก็บคำร้องโต้แย้งการระงับบัญชี
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
