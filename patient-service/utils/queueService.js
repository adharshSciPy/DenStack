// utils/queueService.js
import EventEmitter from 'events';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class UploadQueue extends EventEmitter {
  constructor() {
    super();
    this.queues = new Map();
    this.results = new Map();
    this.jobCounter = 0;
    this.processingInterval = null;
  }

  // Add job to queue
  addJob(clinicId, jobData) {
    if (!this.queues.has(clinicId)) {
      this.queues.set(clinicId, {
        queue: [],
        processing: false,
        jobs: new Map(),
        stats: {
          total: 0,
          processed: 0,
          succeeded: 0,
          failed: 0,
          duplicate: 0,
          failedRows: [],
          duplicateRows: [],
          invalidRows: []
        }
      });
    }

    const jobId = `job_${Date.now()}_${++this.jobCounter}`;
    const queueData = this.queues.get(clinicId);
    
    const job = {
      id: jobId,
      data: jobData,
      status: 'pending',
      createdAt: new Date(),
      completedAt: null,
      result: null,
      error: null
    };

    queueData.queue.push(job);
    queueData.jobs.set(jobId, job);
    queueData.stats.total = queueData.queue.length;

    // Start processing if not already
    this.processQueue(clinicId);

    return jobId;
  }

  // Add invalid row for tracking
  addInvalidRow(clinicId, invalidRow) {
    if (!this.queues.has(clinicId)) {
      this.queues.set(clinicId, {
        queue: [],
        processing: false,
        jobs: new Map(),
        stats: {
          total: 0,
          processed: 0,
          succeeded: 0,
          failed: 0,
          duplicate: 0,
          failedRows: [],
          duplicateRows: [],
          invalidRows: []
        }
      });
    }

    const queueData = this.queues.get(clinicId);
    if (!queueData.stats.invalidRows) {
      queueData.stats.invalidRows = [];
    }
    queueData.stats.invalidRows.push(invalidRow);
  }

  // Add duplicate row for tracking
  addDuplicateRow(clinicId, duplicateRow) {
    if (!this.queues.has(clinicId)) {
      this.queues.set(clinicId, {
        queue: [],
        processing: false,
        jobs: new Map(),
        stats: {
          total: 0,
          processed: 0,
          succeeded: 0,
          failed: 0,
          duplicate: 0,
          failedRows: [],
          duplicateRows: [],
          invalidRows: []
        }
      });
    }

    const queueData = this.queues.get(clinicId);
    if (!queueData.stats.duplicateRows) {
      queueData.stats.duplicateRows = [];
    }
    queueData.stats.duplicateRows.push(duplicateRow);
    queueData.stats.duplicate++;
  }

  // Main queue processing function
  async processQueue(clinicId) {
    const queueData = this.queues.get(clinicId);
    
    // If already processing or no queue, return
    if (!queueData || queueData.processing || queueData.queue.length === 0) {
      return;
    }

    queueData.processing = true;

    // Process jobs sequentially
    while (queueData.queue.length > 0) {
      const job = queueData.queue.shift();
      
      try {
        job.status = 'processing';
        console.log(`Processing job ${job.id} for clinic ${clinicId}, row ${job.data.rowNumber}`);
        
        const result = await this.processJob(job, clinicId);
        
        job.status = 'completed';
        job.completedAt = new Date();
        job.result = result;
        
        queueData.stats.processed++;
        queueData.stats.succeeded++;
        
        console.log(`Job ${job.id} completed successfully`);
        this.emit('jobCompleted', { clinicId, jobId: job.id, result });
      } catch (error) {
        job.status = 'failed';
        job.completedAt = new Date();
        job.error = error.message;
        
        queueData.stats.processed++;
        
        // Check if it's a duplicate error
        if (error.message.includes('already exists')) {
          queueData.stats.duplicate++;
          
          if (!queueData.stats.duplicateRows) {
            queueData.stats.duplicateRows = [];
          }
          
          queueData.stats.duplicateRows.push({
            row: job.data.rowNumber,
            data: job.data.patientData,
            error: 'DUPLICATE: ' + error.message
          });
        } else {
          queueData.stats.failed++;
          
          if (!queueData.stats.failedRows) {
            queueData.stats.failedRows = [];
          }
          
          queueData.stats.failedRows.push({
            row: job.data.rowNumber,
            data: job.data.patientData,
            error: error.message
          });
        }
        
        console.error(`Job ${job.id} failed:`, error.message);
        this.emit('jobFailed', { clinicId, jobId: job.id, error: error.message });
      }
    }

    queueData.processing = false;
    console.log(`Queue processing completed for clinic ${clinicId}`);
  }

  // Process individual job with better error handling
  async processJob(job, clinicId) {
    const { patientData, rowNumber, duplicateMode, userId, userRole } = job.data;
    
    try {
      // Validate required fields
      this.validatePatientData(patientData);
      
      // Check for duplicates based on mode
      if (duplicateMode === 'skip') {
        const isDuplicate = await this.checkDuplicate(patientData, clinicId);
        if (isDuplicate) {
          // Instead of throwing error, we'll mark as duplicate and skip
          throw new Error(`DUPLICATE: Patient with name "${patientData.name}" and phone ${patientData.phone} already exists in this clinic`);
        }
      }
      
      // Try to import the registerPatient function
      let registerPatient;
      try {
        // Try to import from the correct path
        const module = await import('../controller/patientRegisterController.js');
        registerPatient = module.registerPatient;
        
        if (!registerPatient) {
          throw new Error('registerPatient function not found in module');
        }
        
        console.log(`Successfully imported registerPatient for row ${rowNumber}`);
      } catch (importError) {
        console.error(`Failed to import registerPatient for row ${rowNumber}:`, importError.message);
        // Fallback to direct creation
        console.log(`Using direct patient creation for row ${rowNumber}`);
        return await this.createPatientDirectly(patientData, clinicId, userId, userRole);
      }
      
      // Create a properly formatted request object
      const mockReq = {
        params: { id: clinicId },
        body: {
          userRole: userRole || 'admin',
          userId: userId,
          name: patientData.name,
          phone: patientData.phone,
          email: patientData.email || '',
          age: parseInt(patientData.age),
          gender: patientData.gender || 'Other',
          medicalHistory: {
            conditions: patientData.conditions ? patientData.conditions.split(',').map(c => c.trim()).filter(Boolean) : [],
            surgeries: patientData.surgeries ? patientData.surgeries.split(',').map(s => s.trim()).filter(Boolean) : [],
            allergies: patientData.allergies ? patientData.allergies.split(',').map(a => a.trim()).filter(Boolean) : [],
            familyHistory: patientData.familyHistory ? patientData.familyHistory.split(',').map(f => f.trim()).filter(Boolean) : []
          }
        }
      };

      // Create a promise-based response handler
      return new Promise((resolve, reject) => {
        const mockRes = {
          statusCode: null,
          responseData: null,
          status: function(code) {
            this.statusCode = code;
            return this;
          },
          json: function(data) {
            this.responseData = data;
            if (this.statusCode && this.statusCode >= 400) {
              // Check if it's a duplicate error from registerPatient
              if (data.message && data.message.includes('already exists')) {
                reject(new Error(`DUPLICATE: ${data.message}`));
              } else {
                reject(new Error(data.message || 'Registration failed'));
              }
            } else {
              resolve(data);
            }
            return this;
          }
        };

        // Call registerPatient and handle any synchronous errors
        try {
          const result = registerPatient(mockReq, mockRes);
          // If it returns a promise, handle it
          if (result && typeof result.then === 'function') {
            result.catch(error => {
              console.error('Register patient promise rejected:', error);
              // Check if it's a duplicate error
              if (error.message && error.message.includes('already exists')) {
                reject(new Error(`DUPLICATE: ${error.message}`));
              } else {
                reject(error);
              }
            });
          }
        } catch (error) {
          console.error('Error calling registerPatient:', error);
          // Check if it's a duplicate error
          if (error.message && error.message.includes('already exists')) {
            reject(new Error(`DUPLICATE: ${error.message}`));
          } else {
            reject(error);
          }
        }
      });
    } catch (error) {
      // Enhance error message but preserve DUPLICATE marker
      if (error.message.includes('DUPLICATE:')) {
        throw error; // Keep as is
      } else {
        throw new Error(`Row ${rowNumber}: ${error.message}`);
      }
    }
  }

  // Check for duplicate patient - EXACTLY matching registration controller logic
  async checkDuplicate(patientData, clinicId) {
    try {
      // Try to import Patient model
      let Patient;
      try {
        const modelPaths = [
          '../model/patientSchema.js',
        ];
        
        for (const modelPath of modelPaths) {
          try {
            const module = await import(modelPath);
            Patient = module.default || module;
            if (Patient) {
              console.log(`Successfully imported Patient model from ${modelPath}`);
              break;
            }
          } catch (e) {
            // Continue to next path
          }
        }
        
        if (!Patient) {
          console.log('Patient model not found, cannot check duplicates - will proceed without duplicate check');
          return false; // Don't block upload if model not found
        }
      } catch (importError) {
        console.log('Could not import Patient model, proceeding without duplicate check');
        return false;
      }

      const { phone, name } = patientData;
      
      if (!phone || !name) {
        console.log('Missing phone or name for duplicate check');
        return false;
      }

      // EXACTLY matching the registration controller logic:
      // First find by phone number
      const existingPatient = await Patient.findOne({ 
        clinicId: clinicId, 
        phone: phone 
      });
      
      // Then check if name matches (case insensitive)
      if (
        existingPatient &&
        existingPatient.name.trim().toLowerCase() === name.trim().toLowerCase()
      ) {
        console.log(`Duplicate found: Patient with name "${name}" and phone ${phone} already exists`);
        return true; // This is a duplicate
      }
      
      return false; // Not a duplicate
    } catch (error) {
      console.error('Duplicate check failed:', error);
      return false; // Don't block on error
    }
  }

  // Direct patient creation as fallback
  async createPatientDirectly(patientData, clinicId, userId, userRole) {
    try {
      // Try to import Patient model
      let Patient;
      try {
        const modelPaths = [
          '../models/patientModel.js',
          '../models/Patient.js',
          './models/patientModel.js',
          '../models/Patients.js',
          '../../../models/patientModel.js'
        ];
        
        for (const modelPath of modelPaths) {
          try {
            const module = await import(modelPath);
            Patient = module.default || module;
            if (Patient) {
              console.log(`Successfully imported Patient model from ${modelPath} for direct creation`);
              break;
            }
          } catch (e) {
            // Continue to next path
          }
        }
        
        if (!Patient) {
          throw new Error('Patient model not available for direct creation');
        }
      } catch (importError) {
        console.error('Failed to import Patient model:', importError.message);
        throw new Error('Cannot create patient - model unavailable');
      }

      // First check for duplicates again (safety check)
      const existingPatient = await Patient.findOne({ 
        clinicId: clinicId, 
        phone: patientData.phone 
      });
      
      if (
        existingPatient &&
        existingPatient.name.trim().toLowerCase() === patientData.name.trim().toLowerCase()
      ) {
        throw new Error(`DUPLICATE: Patient with name "${patientData.name}" and phone ${patientData.phone} already exists`);
      }

      // Create patient directly
      const patient = new Patient({
        name: patientData.name,
        phone: patientData.phone,
        email: patientData.email || '',
        age: parseInt(patientData.age),
        gender: patientData.gender || 'Other',
        clinicId: clinicId,
        createdBy: userId,
        createdByRole: userRole,
        medicalHistory: {
          conditions: patientData.conditions ? patientData.conditions.split(',').map(c => c.trim()).filter(Boolean) : [],
          surgeries: patientData.surgeries ? patientData.surgeries.split(',').map(s => s.trim()).filter(Boolean) : [],
          allergies: patientData.allergies ? patientData.allergies.split(',').map(a => a.trim()).filter(Boolean) : [],
          familyHistory: patientData.familyHistory ? patientData.familyHistory.split(',').map(f => f.trim()).filter(Boolean) : []
        }
      });

      await patient.save();
      
      return {
        success: true,
        message: 'Patient created successfully',
        patient
      };
    } catch (error) {
      throw error; // Pass through the error with DUPLICATE marker if present
    }
  }

  // Validate patient data
  validatePatientData(patientData) {
    if (!patientData.name || patientData.name.trim() === '') {
      throw new Error('Name is required');
    }
    
    if (!patientData.phone) {
      throw new Error('Phone number is required');
    }
    
    if (!/^\d{10}$/.test(String(patientData.phone))) {
      throw new Error('Invalid phone number format. Must be 10 digits');
    }
    
    if (!patientData.age && patientData.age !== 0) {
      throw new Error('Age is required');
    }
    
    const age = parseInt(patientData.age);
    if (isNaN(age) || age < 0 || age > 150) {
      throw new Error('Valid age is required (0-150)');
    }
    
    return true;
  }

  // Get queue status with complete stats
  getQueueStatus(clinicId) {
    const queueData = this.queues.get(clinicId);
    if (!queueData) return null;
    
    return {
      processing: queueData.processing,
      stats: {
        total: queueData.stats.total || 0,
        processed: Math.min(queueData.stats.processed || 0, queueData.stats.total || 0),
        succeeded: queueData.stats.succeeded || 0,
        failed: queueData.stats.failed || 0,
        duplicate: queueData.stats.duplicate || 0,
        failedRows: queueData.stats.failedRows || [],
        duplicateRows: queueData.stats.duplicateRows || [],
        invalidRows: queueData.stats.invalidRows || []
      },
      queueLength: queueData.queue.length
    };
  }

  // Get failed rows (including invalid and duplicates)
  getFailedRows(clinicId) {
    const queueData = this.queues.get(clinicId);
    if (!queueData) return [];
    
    const failedRows = [
      ...(queueData.stats.failedRows || []),
      ...(queueData.stats.duplicateRows || []),
      ...(queueData.stats.invalidRows || []).map(row => ({
        row: row.rowNumber,
        data: row.data,
        error: row.errors ? row.errors.join(', ') : 'Invalid data'
      }))
    ];
    
    return failedRows;
  }

  // Clear queue for a clinic
  clearQueue(clinicId) {
    if (this.queues.has(clinicId)) {
      console.log(`Clearing queue for clinic ${clinicId}`);
      this.queues.delete(clinicId);
    }
  }

  // Get all active queues
  getAllQueues() {
    const result = {};
    for (const [clinicId, queueData] of this.queues.entries()) {
      result[clinicId] = {
        queueLength: queueData.queue.length,
        processing: queueData.processing,
        stats: queueData.stats
      };
    }
    return result;
  }

  // Cancel processing for a clinic
  async cancelProcessing(clinicId) {
    const queueData = this.queues.get(clinicId);
    if (queueData) {
      queueData.processing = false;
      queueData.queue = [];
      queueData.stats = {
        total: 0,
        processed: 0,
        succeeded: 0,
        failed: 0,
        duplicate: 0,
        failedRows: [],
        duplicateRows: [],
        invalidRows: []
      };
    }
  }
}

// Create singleton instance
const uploadQueue = new UploadQueue();

export default uploadQueue;