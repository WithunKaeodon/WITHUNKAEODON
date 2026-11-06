const express = require('express');
const router = express.Router();
const {
    getReports, getReportsByProperty, resolveReports,
    getProperties, togglePropertyPublish, deleteProperty,
    getPropertyDetail, updatePropertyAdmin, deleteImage,
    getUsers, getUserDetail, setUserStatus, updateUser, deleteUser,
    warnUser,
    getAppeals, resolveAppeal
} = require('../controllers/admin');

// Reports
router.get('/reports',              getReports);
router.get('/reports/:propertyId',  getReportsByProperty);
router.patch('/reports/resolve',    resolveReports);
router.patch('/reports/resolve-one', async (req, res) => {
    try {
        const { reportId, status } = req.body;
        if (!reportId || !status) return res.status(400).json({ success: false, message: 'ข้อมูลไม่ครบ' });
        const valid = ['RESOLVED','DISMISSED','IN_PROGRESS','PENDING','OWNER_FIXED'];
        if (!valid.includes(status)) return res.status(400).json({ success: false, message: 'status ไม่ถูกต้อง' });
        const db = require('../config/db');
        await db.query('UPDATE issuereport SET status=? WHERE reportId=?', [status, reportId]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Properties
router.get('/properties',                    getProperties);
router.get('/properties/:id',                getPropertyDetail);
router.patch('/properties/:id',              updatePropertyAdmin);
router.patch('/properties/:id/publish',      togglePropertyPublish);
router.delete('/properties/:id',             deleteProperty);

// Images
router.delete('/images/:imageId',            deleteImage);

// Users
router.get('/users',                         getUsers);
router.get('/users/:email',                  getUserDetail);
router.patch('/users/:email/status',         setUserStatus);
router.patch('/users/:email',                updateUser);
router.delete('/users/:email',               deleteUser);

// Warn
router.post('/warn', warnUser);

// Appeals (คำร้องโต้แย้งการระงับบัญชี)
router.get('/appeals',                getAppeals);
router.patch('/appeals/:id',          resolveAppeal);

module.exports = router;
