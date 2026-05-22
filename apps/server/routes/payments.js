const express = require('express');
const router = express.Router();
const {
  getPayments, getPaymentSummary, createPayment, updatePayment, getCurrentMonthStatus,
  declarePayment, getPendingDeclarations, getTenantDeclarations, approvePayment, rejectPayment,
} = require('../controllers/paymentsController');
const { verifyToken, requireRole } = require('../middleware/auth');
const { paymentProofUpload, wrapUpload } = require('../middleware/upload');

router.get('/', verifyToken, getPayments);
router.get('/summary', verifyToken, getPaymentSummary);
router.get('/current-month', verifyToken, requireRole('tenant'), getCurrentMonthStatus);
router.get('/pending', verifyToken, requireRole('admin'), getPendingDeclarations);
router.get('/my-declarations', verifyToken, requireRole('tenant'), getTenantDeclarations);
router.post('/', verifyToken, requireRole('admin'), createPayment);
router.post('/declare', verifyToken, requireRole('tenant'), wrapUpload(paymentProofUpload.array('proof_images', 3)), declarePayment);
router.put('/:id', verifyToken, requireRole('admin'), updatePayment);
router.put('/:id/approve', verifyToken, requireRole('admin'), approvePayment);
router.put('/:id/reject', verifyToken, requireRole('admin'), rejectPayment);

module.exports = router;
