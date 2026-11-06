-- Migration: เพิ่มคอลัมน์ bedrooms และ bathrooms ในตาราง property
-- รัน SQL นี้บน Database ที่มีอยู่แล้วหนึ่งครั้ง

ALTER TABLE `property`
    ADD COLUMN `bedrooms`  INT DEFAULT 1 AFTER `bedSize`,
    ADD COLUMN `bathrooms` INT DEFAULT 1 AFTER `bedrooms`;
