const express = require('express');
const router = express.Router();
const { getRequests, getRequest, createRequest, updateRequest, uploadRequestPhotos } = require('../controllers/maintenanceController');
const { verifyToken, requireRole } = require('../middleware/auth');
const { maintenancePhotoUpload, wrapUpload } = require('../middleware/upload');

router.get('/', verifyToken, getRequests);
router.get('/:id', verifyToken, getRequest);
router.post('/', verifyToken, requireRole('tenant'), wrapUpload(maintenancePhotoUpload.array('maintenance_images', 5)), createRequest);
router.put('/:id', verifyToken, requireRole('admin'), updateRequest);
router.post('/:id/photos', verifyToken, requireRole('tenant'), wrapUpload(maintenancePhotoUpload.array('photos', 5)), uploadRequestPhotos);

module.exports = router;
