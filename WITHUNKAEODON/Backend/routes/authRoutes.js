const express = require('express');
const router = express.Router();
const { register, login, submitAppeal } = require('../controllers/auth');

// POST /api/auth/register
router.post('/register', register);

// POST /api/auth/login
router.post('/login', login);

// POST /api/auth/appeal — ผู้ใช้ที่ถูกระงับส่งคำร้องโต้แย้ง
router.post('/appeal', submitAppeal);

module.exports = router;
