import { DicomToNiftiConverter } from '../services/dicomToNiftiConverter.js';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
/**
 * Clean old files
 */
function cleanOldFiles(niftiDir, labOrderId) {
  if (!fs.existsSync(niftiDir)) return;
  
  const files = fs.readdirSync(niftiDir);
  const labFiles = files.filter(f => f.includes(labOrderId));
  
  // Keep only the 5 most recent files
  if (labFiles.length > 5) {
    const filesWithStats = labFiles.map(file => {
      const filePath = path.join(niftiDir, file);
      return {
        name: file,
        path: filePath,
        mtime: fs.statSync(filePath).mtime
      };
    });
    
    filesWithStats.sort((a, b) => b.mtime - a.mtime);
    
    // Delete older files
    filesWithStats.slice(5).forEach(file => {
      try {
        fs.unlinkSync(file.path);
        console.log(`🗑️  Cleaned old file: ${file.name}`);
      } catch (error) {
        console.log(`⚠️ Could not delete ${file.name}:`, error.message);
      }
    });
  }
}

/**
 * Check DICOM directory
 */
function checkDicomDirectory(dicomDir) {
  if (!fs.existsSync(dicomDir)) {
    return { exists: false, error: 'Directory not found' };
  }
  
  const files = fs.readdirSync(dicomDir);
  const dicomFiles = files.filter(f => 
    f.toLowerCase().endsWith('.dcm') || 
    f.toLowerCase().endsWith('.ima')
  );
  
  return {
    exists: true,
    dicomFiles: dicomFiles.length,
    totalFiles: files.length,
    sample: dicomFiles.slice(0, 5)
  };
}

/**
 * Main conversion function
 */
export const convertDicomToNifti = async (dicomDir, niftiDir, labOrderId, id) => {
  const converter = new DicomToNiftiConverter();
  
  try {
    // Ensure output directory exists
    if (!fs.existsSync(niftiDir)) {
      fs.mkdirSync(niftiDir, { recursive: true });
    }
    
    // Clean old files (keep only latest)
    cleanOldFiles(niftiDir, labOrderId);
    
    console.log(`🔧 Converting DICOM to NIfTI for order ${labOrderId}`);
    
    const result = await converter.convertDicomSeriesToNifti(
      dicomDir,
      niftiDir,
      labOrderId
    );
    
    // Validation is already done inside convertDicomSeriesToNifti
    // Just return the result
    if (id) {
      await axios.patch(
        `${process.env.PATIENT_SERVICE_URL}/api/v1/patient-service/patient/lab-order/${id}`,
        { labOrderId },
      );
    }
    
    return result;
  } catch (error) {
    console.error('❌ Conversion process failed:', error.message);
    
    // Create emergency file
    const emergencyName = `error_${labOrderId}_${Date.now()}.txt`;
    const emergencyPath = path.join(niftiDir, emergencyName);
    
    try {
      fs.writeFileSync(emergencyPath, `Error: ${error.message}\nStack: ${error.stack}`);
    } catch (writeError) {
      console.error('Failed to write error file:', writeError.message);
    }
    
    return {
      success: false,
      niftiFile: emergencyName,
      fileUrl: `/uploads/labResults/${labOrderId}/nifti/${emergencyName}`,
      error: error.message,
      isFallback: true
    };
  }
};

/**
 * Export helper functions
 */
export { checkDicomDirectory };