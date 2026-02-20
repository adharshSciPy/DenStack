// utils/encryption.js
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY; // Must be 32 bytes for AES-256
const IV_LENGTH = 16;

const encryptPatientId = (patientId) => {
  try {
    // Generate a random initialization vector
    const iv = crypto.randomBytes(IV_LENGTH);
    
    // Create cipher
    const cipher = crypto.createCipheriv(
      'aes-256-cbc',
      Buffer.from(ENCRYPTION_KEY, 'hex'),
      iv
    );
    
    // Encrypt
    let encrypted = cipher.update(patientId.toString(), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // Combine IV and encrypted data (both as buffers)
    const ivBuffer = iv;
    const encryptedBuffer = Buffer.from(encrypted, 'hex');
    const combined = Buffer.concat([ivBuffer, encryptedBuffer]);
    
    // Convert to base64 and make URL-safe
    // Base64 uses A-Z, a-z, 0-9, +, /, =
    // We replace + with -, / with _, and remove = padding
    const base64 = combined.toString('base64');
    const urlSafe = base64
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
    
    console.log('Generated URL-safe link:', urlSafe); // Debug log
    return urlSafe;
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error('Failed to encrypt patient ID');
  }
};

const decryptPatientId = (secureLink) => {
  try {
    // Convert back from URL-safe base64 to standard base64
    let base64 = secureLink
      .replace(/-/g, '+')
      .replace(/_/g, '/');
    
    // Add padding back if needed
    while (base64.length % 4) {
      base64 += '=';
    }
    
    // Decode base64
    const combined = Buffer.from(base64, 'base64');
    
    // Extract IV (first 16 bytes) and encrypted data
    const iv = combined.slice(0, IV_LENGTH);
    const encryptedData = combined.slice(IV_LENGTH);
    
    const decipher = crypto.createDecipheriv(
      'aes-256-cbc',
      Buffer.from(ENCRYPTION_KEY, 'hex'),
      iv
    );
    
    let decrypted = decipher.update(encryptedData.toString('hex'), 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    console.log('Decrypted patientId:', decrypted); // Debug log
    return decrypted;
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('Failed to decrypt patient ID');
  }
};

// Generate a URL-safe encrypted ID (no special characters)
const generateSecurePatientLink = (patientId) => {
  return encryptPatientId(patientId);
};

// Decode from URL-safe format
const decodePatientLink = (secureLink) => {
  return decryptPatientId(secureLink);
};

export {
  encryptPatientId,
  decryptPatientId,
  generateSecurePatientLink,
  decodePatientLink
};