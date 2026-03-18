// controller/bulkUploadController.js
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import xlsx from 'xlsx';
import uploadQueue from '../utils/queueService.js';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure multer for file upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads/temp');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `bulk-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv'
  ];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only Excel and CSV files are allowed.'));
  }
};

export const upload = multer({ 
  storage, 
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Download Excel template
export const downloadTemplate = async (req, res) => {
  try {
    // Create template data
    const templateData = [
      {
        name: 'John Doe',
        phone: '9876543210',
        email: 'john@example.com',
        age: 30,
        gender: 'Male',
        conditions: 'Diabetes,Hypertension',
        surgeries: 'Appendectomy',
        allergies: 'Penicillin',
        familyHistory: 'Heart Disease'
      }
    ];

    // Create workbook
    const wb = xlsx.utils.book_new();
    const ws = xlsx.utils.json_to_sheet(templateData, {
      header: ['name', 'phone', 'email', 'age', 'gender', 'conditions', 'surgeries', 'allergies', 'familyHistory']
    });

    // Set column widths
    ws['!cols'] = [
      { wch: 20 }, // name
      { wch: 15 }, // phone
      { wch: 25 }, // email
      { wch: 5 },  // age
      { wch: 8 },  // gender
      { wch: 30 }, // conditions
      { wch: 20 }, // surgeries
      { wch: 20 }, // allergies
      { wch: 20 }  // familyHistory
    ];

    xlsx.utils.book_append_sheet(wb, ws, 'Patients');

    // Add instructions sheet
    const instructionsData = [
      { Field: 'name', Required: 'Yes', Description: 'Patient full name (2-50 characters)' },
      { Field: 'phone', Required: 'Yes', Description: '10 digit mobile number' },
      { Field: 'email', Required: 'No', Description: 'Valid email address' },
      { Field: 'age', Required: 'Yes', Description: 'Number between 0-150' },
      { Field: 'gender', Required: 'Yes', Description: 'Male, Female, or Other' },
      { Field: 'conditions', Required: 'No', Description: 'Comma-separated list' },
      { Field: 'surgeries', Required: 'No', Description: 'Comma-separated list' },
      { Field: 'allergies', Required: 'No', Description: 'Comma-separated list' },
      { Field: 'familyHistory', Required: 'No', Description: 'Comma-separated list' }
    ];

    const wsInstructions = xlsx.utils.json_to_sheet(instructionsData);
    xlsx.utils.book_append_sheet(wb, wsInstructions, 'Instructions');

    // Write to buffer
    const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Disposition', 'attachment; filename=patient_upload_template.xlsx');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
  } catch (error) {
    console.error('Template download error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to generate template',
      error: error.message 
    });
  }
};

// Preview Excel data
export const previewUpload = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        message: 'No file uploaded' 
      });
    }

    const filePath = req.file.path;
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // Convert to JSON
    const data = xlsx.utils.sheet_to_json(worksheet, { 
      header: ['name', 'phone', 'email', 'age', 'gender', 'conditions', 'surgeries', 'allergies', 'familyHistory'],
      range: 1 // Skip header row
    });

    // Validate and process preview
    const previewData = data.map((row, index) => {
      const errors = [];
      
      // Basic validation
      if (!row.name) errors.push('Name is required');
      if (!row.phone) errors.push('Phone is required');
      else if (!/^\d{10}$/.test(String(row.phone))) errors.push('Invalid phone format');
      
      if (!row.age) errors.push('Age is required');
      else if (isNaN(row.age) || row.age < 0 || row.age > 150) errors.push('Invalid age');
      
      if (row.gender && !['Male', 'Female', 'Other'].includes(row.gender)) {
        errors.push('Gender must be Male, Female, or Other');
      }

      return {
        rowNumber: index + 2,
        data: row,
        isValid: errors.length === 0,
        errors
      };
    });

    // Clean up temp file
    fs.unlinkSync(filePath);

    res.json({
      success: true,
      data: previewData,
      summary: {
        total: previewData.length,
        valid: previewData.filter(r => r.isValid).length,
        invalid: previewData.filter(r => !r.isValid).length
      }
    });
  } catch (error) {
    // Clean up temp file if exists
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({ 
      success: false, 
      message: 'Failed to preview file',
      error: error.message 
    });
  }
};

// processBulkUpload function - update to return only valid rows count


export const processBulkUpload = async (req, res) => {
  try {
    const { clinicId } = req.params;
    const { userId, userRole, duplicateMode = 'skip' } = req.body;

    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        message: 'No file uploaded' 
      });
    }

    if (!clinicId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Clinic ID is required' 
      });
    }

    // Map userRole from number to string if needed
    let mappedUserRole = userRole;
    if (userRole === '700' || userRole === 'admin'|| userRole === '760'|| userRole === '500' || userRole === 'receptionist' || userRole === '300' || userRole === 'patient') {
      // If it's a numeric role from your auth system, map it to the expected string
      if (userRole === '700') mappedUserRole = 'admin';
      else if (userRole === '500') mappedUserRole = 'receptionist';
      else if (userRole === '300') mappedUserRole = 'patient';
      // If it's already a string role, keep it as is
    }

    console.log('Original userRole:', userRole, 'Mapped to:', mappedUserRole);

    const filePath = req.file.path;
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // Convert to JSON
    const data = xlsx.utils.sheet_to_json(worksheet, { 
      header: ['name', 'phone', 'email', 'age', 'gender', 'conditions', 'surgeries', 'allergies', 'familyHistory'],
      range: 1 // Skip header row
    });

    // Clear any existing queue for this clinic
    uploadQueue.clearQueue(clinicId);
    
    // Queue jobs
    const jobIds = [];
    let validCount = 0;
    let invalidCount = 0;
    let duplicateCount = 0;
    
    // First pass: validate all rows
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      
      // Basic validation
      const errors = [];
      if (!row.name || String(row.name).trim() === '') errors.push('Name is required');
      if (!row.phone) errors.push('Phone is required');
      else if (!/^\d{10}$/.test(String(row.phone))) errors.push('Invalid phone format (must be 10 digits)');
      if (!row.age && row.age !== 0) errors.push('Age is required');
      else if (isNaN(row.age) || row.age < 0 || row.age > 150) errors.push('Invalid age (0-150)');
      
      if (errors.length > 0) {
        invalidCount++;
        uploadQueue.addInvalidRow(clinicId, {
          rowNumber: i + 2,
          data: row,
          errors
        });
        continue;
      }

      // Valid row - add to queue with mapped userRole
      const jobId = uploadQueue.addJob(clinicId, {
        userId,
        userRole: mappedUserRole, // Use the mapped role
        patientData: {
          name: String(row.name).trim(),
          phone: String(row.phone).trim(),
          email: row.email ? String(row.email).trim() : '',
          age: parseInt(row.age),
          gender: row.gender || 'Other',
          conditions: row.conditions || '',
          surgeries: row.surgeries || '',
          allergies: row.allergies || '',
          familyHistory: row.familyHistory || ''
        },
        rowNumber: i + 2,
        duplicateMode
      });

      jobIds.push(jobId);
      validCount++;
    }

    // Clean up temp file
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // Start processing the queue
    if (validCount > 0) {
      // Start processing in background
      setImmediate(() => {
        uploadQueue.processQueue(clinicId).catch(err => {
          console.error('Queue processing error:', err);
        });
      });
    }

    res.json({
      success: true,
      message: `Bulk upload started with ${validCount} valid patients (${invalidCount} invalid)`,
      jobIds,
      clinicId,
      summary: {
        total: data.length,
        valid: validCount,
        invalid: invalidCount,
        duplicates: duplicateCount
      }
    });
  } catch (error) {
    // Clean up temp file if exists
    if (req.file && req.file.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    console.error('Bulk upload error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to process bulk upload',
      error: error.message 
    });
  }
};
// Get upload status
export const getUploadStatus = async (req, res) => {
  try {
    const { clinicId } = req.params;
    
    const status = uploadQueue.getQueueStatus(clinicId);
    
    if (!status) {
      return res.json({
        success: true,
        processing: false,
        stats: {
          total: 0,
          processed: 0,
          succeeded: 0,
          failed: 0,
          failedRows: []
        }
      });
    }

    res.json({
      success: true,
      ...status
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get upload status',
      error: error.message 
    });
  }
};

// Get failed rows CSV
export const downloadFailedRows = async (req, res) => {
  try {
    const { clinicId } = req.params;
    
    const failedRows = uploadQueue.getFailedRows(clinicId);
    
    if (failedRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No failed rows found'
      });
    }

    // Create CSV
    const headers = ['Row', 'Error', ...Object.keys(failedRows[0].data)];
    const csvRows = [headers.join(',')];

    failedRows.forEach(row => {
      const values = [
        row.row,
        `"${row.error}"`,
        ...Object.values(row.data).map(val => `"${val || ''}"`)
      ];
      csvRows.push(values.join(','));
    });

    const csv = csvRows.join('\n');

    res.setHeader('Content-Disposition', 'attachment; filename=failed_rows.csv');
    res.setHeader('Content-Type', 'text/csv');
    res.send(csv);
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Failed to generate failed rows file',
      error: error.message 
    });
  }
};

// Cancel upload
export const cancelUpload = async (req, res) => {
  try {
    const { clinicId } = req.params;
    
    uploadQueue.clearQueue(clinicId);
    
    res.json({
      success: true,
      message: 'Upload cancelled successfully'
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Failed to cancel upload',
      error: error.message 
    });
  }
};