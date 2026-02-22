import express from 'express';
import multer from 'multer';
import {
  getWhatsAppSettings,
  saveWhatsAppSettings,
  getMessageHistory,
  rechargeMessages,
  sendTestMessage,
  sendDocument,
  getMessageStats,
  disconnectWhatsApp,
  verifyConnection
} from '../controller/whatsappController.js';

const whatsappRouter = express.Router();

// Configure multer for file uploads (memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allowed mime types
    const allowedMimes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain',
      'application/vnd.oasis.opendocument.text',
      'application/vnd.oasis.opendocument.spreadsheet',
      'application/rtf'
    ];

    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only documents are allowed.'), false);
    }
  }
});

// Verification route
whatsappRouter.post('/verify', verifyConnection);

// Settings routes
whatsappRouter.route('/settings/:clinicId')
  .get(getWhatsAppSettings);

whatsappRouter.route('/settings')
  .post(saveWhatsAppSettings);

// Message history routes
whatsappRouter.route('/history/:clinicId')
  .get(getMessageHistory);

// Stats routes
whatsappRouter.route('/stats/:clinicId')
  .get(getMessageStats);

// Recharge route
whatsappRouter.route('/recharge')
  .post(rechargeMessages);

// Test message route
whatsappRouter.route('/send-test')
  .post(sendTestMessage);

// Document send route with file upload
whatsappRouter.route('/send-document')
  .post(upload.single('file'), sendDocument);

// Disconnect route
whatsappRouter.route('/disconnect/:clinicId')
  .post(disconnectWhatsApp);

// Error handling middleware for multer
whatsappRouter.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File too large. Maximum size is 100MB.'
      });
    }
  }
  
  if (error.message) {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
  
  next(error);
});

export default whatsappRouter;