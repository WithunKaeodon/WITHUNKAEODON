const express = require('express');
const router = express.Router();
const { getConversations, getMessages, sendMessage, markAsRead, getUnreadCount } = require('../controllers/chat');

router.get('/conversations', getConversations);
router.get('/messages',      getMessages);
router.get('/unread',        getUnreadCount);
router.post('/send',         sendMessage);
router.patch('/read',        markAsRead);

module.exports = router;
