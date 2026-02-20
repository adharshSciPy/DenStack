// utils/encryption.js
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY; // Must be 32 bytes for AES-256
const IV_LENGTH = 16; // For AES, this is always 16

const encryptPatientId = (patientId) => {
  try {
    // Generate a random initialization vector
    const iv = crypto.randomBytes(IV_LENGTH);
    
    // Create cipher
    const cipher = crypto.createCipheriv(
      'aes-256-cbc',
      Buffer.from(ENCRYPTION_KEY, 'hex'), // Ensure key is in correct format
      iv
    );
    
    // Encrypt
    let encrypted = cipher.update(patientId.toString(), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // Return IV + encrypted data (both needed for decryption)
    return iv.toString('hex') + ':' + encrypted;
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error('Failed to encrypt patient ID');
  }
};

const decryptPatientId = (encryptedData) => {
  try {
    // Split IV and encrypted data
    const [ivHex, encryptedHex] = encryptedData.split(':');
    
    if (!ivHex || !encryptedHex) {
      throw new Error('Invalid encrypted data format');
    }
    
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv(
      'aes-256-cbc',
      Buffer.from(ENCRYPTION_KEY, 'hex'),
      iv
    );
    
    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('Failed to decrypt patient ID');
  }
};

// Generate a URL-safe encrypted ID
const generateSecurePatientLink = (patientId) => {
  const encrypted = encryptPatientId(patientId);
  // Make it URL-safe by replacing special characters
  return encodeURIComponent(encrypted);
};

// Decode from URL-safe format
const decodePatientLink = (secureLink) => {
  const decoded = decodeURIComponent(secureLink);
  return decryptPatientId(decoded);
};

// Key validator to ensure encryption key is properly set
const validateEncryptionKey = () => {
  if (!ENCRYPTION_KEY) {
    throw new Error('ENCRYPTION_KEY is not set in environment variables');
  }
  
  // Check if key is valid hex and correct length (32 bytes = 64 hex chars)
  const keyBuffer = Buffer.from(ENCRYPTION_KEY, 'hex');
  if (keyBuffer.length !== 32) {
    throw new Error('ENCRYPTION_KEY must be 32 bytes (64 hex characters) for AES-256');
  }
  
  return true;
};

// Export all functions using the modern syntax
export {
  encryptPatientId,
  decryptPatientId,
  generateSecurePatientLink,
  decodePatientLink,
  validateEncryptionKey
};