// routes/bulkUploadRoutes.js
import express from 'express';
import { 
  upload,
  downloadTemplate,
  previewUpload,
  processBulkUpload,
  getUploadStatus,
  downloadFailedRows,
  cancelUpload
} from '../controller/bulkUploadController.js';

const bulkUploadRouter = express.Router();

// Download template
bulkUploadRouter.get('/template/download', downloadTemplate);

// Preview upload data
bulkUploadRouter.post('/preview', upload.single('file'), previewUpload);

// Process bulk upload
bulkUploadRouter.post('/upload/:clinicId', upload.single('file'), processBulkUpload);

// Get upload status
bulkUploadRouter.get('/status/:clinicId', getUploadStatus);

// Download failed rows
bulkUploadRouter.get('/failed-rows/:clinicId', downloadFailedRows);

// Cancel upload
bulkUploadRouter.post('/cancel/:clinicId', cancelUpload);

export default bulkUploadRouter;