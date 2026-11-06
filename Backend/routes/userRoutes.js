const express = require('express');
const router = express.Router();
const { getMe, getMyProperties, updateMe, changePassword } = require('../controllers/user');

router.get('/me', getMe);
router.get('/me/properties', getMyProperties);
router.patch('/me', updateMe);
router.patch('/me/password', changePassword);

module.exports = router;
