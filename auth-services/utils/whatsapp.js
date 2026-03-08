import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// WhatsApp Business API base URL
const WHATSAPP_API_BASE = process.env.WALOCAL_API_BASE || 'https://walocal.com/api/v23.0';
const WALOCAL_AUTHKEY = process.env.WALOCAL_AUTHKEY;

/**
 * Upload file to server and get public URL
 */
export const uploadFileToServer = async (fileBuffer, filename, mimeType) => {
    try {
        // Create uploads directory if it doesn't exist
        const uploadDir = path.join(__dirname, '..', 'public', 'uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }

        // Generate unique filename to avoid overwrites
        const timestamp = Date.now();
        const safeFilename = `${timestamp}-${filename.replace(/[^a-zA-Z0-9.]/g, '_')}`;
        const filePath = path.join(uploadDir, safeFilename);

        // Write file to disk
        fs.writeFileSync(filePath, fileBuffer);

        // Generate public URL
        const baseUrl = process.env.BASE_URL || 'http://localhost:8001';
        const publicUrl = `${baseUrl}/uploads/${safeFilename}`;

        console.log('✅ File uploaded:', {
            path: filePath,
            url: publicUrl,
            size: fileBuffer.length
        });

        return {
            success: true,
            url: publicUrl,
            path: filePath,
            filename: safeFilename
        };
    } catch (error) {
        console.error('❌ File upload error:', error);
        return {
            success: false,
            error: error.message
        };
    }
};

/**
 * Send a WhatsApp message via WALOCAL
 * Supports: text, template, document
 */

export const sendWhatsAppMessage = async ({
    to,
    message,
    type = 'text',
    templateName = null,
    documentUrl = null,
    caption = '',
    fileName = '',
    variables = []  // This will receive the array of 5 values
}) => {
    try {
        if (!WALOCAL_AUTHKEY) {
            throw new Error('WALOCAL_AUTHKEY not configured');
        }

        const cleanMobile = to.replace('+', '').replace(/\s/g, '');
        const params = {
            authkey: WALOCAL_AUTHKEY,
            mobile: cleanMobile
        };

        if (type === 'text') {
            params.type = 'text';
            params.message = message;
        } else if (type === 'document') {
            if (!templateName) {
                throw new Error('Template name is required');
            }
            
            params.tempid = templateName;
            params.document_url = documentUrl;
            if (caption) params.caption = caption;
            if (fileName) params.filename = fileName;
            
            // ✅ Add all variables as numbered parameters
            if (variables && variables.length > 0) {
                variables.forEach((value, index) => {
                    params[`param${index + 1}`] = value;
                });
            }
        }

        const url = `${WHATSAPP_API_BASE}/?${new URLSearchParams(params).toString()}`;
        console.log('📡 WALOCAL URL:', url);

        const response = await axios.get(url, {
            timeout: 30000,
            validateStatus: status => status < 500
        });

        return {
            success: true,
            messageId: response?.data?.id || Date.now().toString(),
            data: response?.data
        };

    } catch (error) {
        console.error('❌ WALOCAL Error:', error.message);
        return {
            success: false,
            error: error.message,
            details: error.response?.data
        };
    }
};

/**
 * Verify WALOCAL connection
 * Tests if authkey is valid by making a lightweight request
 */
export const verifyWalocalConnection = async () => {
    try {
        if (!WALOCAL_AUTHKEY) {
            return {
                success: false,
                error: 'WALOCAL_AUTHKEY not configured'
            };
        }

        // Try to get account balance or just test with a minimal request
        const params = {
            authkey: WALOCAL_AUTHKEY,
            action: 'balance'  // This might not exist, but we'll try
        };

        const url = `${WHATSAPP_API_BASE}/?${new URLSearchParams(params).toString()}`;

        try {
            const response = await axios.get(url, {
                timeout: 5000,
                validateStatus: status => true // Don't throw on any status
            });

            // If we get any response (even 404), authkey is likely valid
            return {
                success: true,
                data: {
                    message: 'WALOCAL connection verified',
                    status: response.status
                }
            };
        } catch (networkError) {
            // Network error means DNS or connection issue
            return {
                success: false,
                error: `Network error: ${networkError.message}`
            };
        }
    } catch (error) {
        console.error('Verification Error:', error.message);
        return {
            success: false,
            error: error.message
        };
    }
};

/**
 * Get account information (if supported by WALOCAL)
 */
export const getAccountInfo = async () => {
    try {
        const params = {
            authkey: WALOCAL_AUTHKEY,
            action: 'account_info'
        };

        const url = `${WHATSAPP_API_BASE}/?${new URLSearchParams(params).toString()}`;
        const response = await axios.get(url, { timeout: 5000 });

        return {
            success: true,
            data: response.data
        };
    } catch (error) {
        console.error('Get Account Info Error:', error.message);
        return {
            success: false,
            error: error.message
        };
    }
};

/**
 * Get message status (if supported by WALOCAL)
 */
export const getMessageStatus = async (messageId) => {
    try {
        const params = {
            authkey: WALOCAL_AUTHKEY,
            action: 'status',
            id: messageId
        };

        const url = `${WHATSAPP_API_BASE}/?${new URLSearchParams(params).toString()}`;
        const response = await axios.get(url, { timeout: 5000 });

        return {
            success: true,
            data: response.data
        };
    } catch (error) {
        console.error('Get Status Error:', error.message);
        return {
            success: false,
            error: error.message
        };
    }
};

/**
 * @deprecated - WALOCAL doesn't support direct media upload
 * Use uploadFileToServer + sendWhatsAppMessage with documentUrl instead
 */
export const uploadMedia = async ({
    file,
    filename,
    mimeType
}) => {
    console.warn('⚠️ uploadMedia is deprecated for WALOCAL. Use uploadFileToServer + sendWhatsAppMessage with documentUrl instead');

    try {
        // First upload to server
        const uploadResult = await uploadFileToServer(file, filename, mimeType);

        if (!uploadResult.success) {
            throw new Error(uploadResult.error);
        }

        return {
            success: true,
            mediaId: uploadResult.filename,
            url: uploadResult.url,
            data: uploadResult
        };
    } catch (error) {
        console.error('Media Upload Error:', error);
        return {
            success: false,
            error: error.message
        };
    }
};

/**
 * @deprecated - These functions are for Meta Cloud API, not WALOCAL
 * Kept for reference but will throw warnings
 */
export const getMediaUrl = async (mediaId) => {
    console.warn('⚠️ getMediaUrl is for Meta Cloud API only. WALOCAL does not support this endpoint.');
    return {
        success: false,
        error: 'Not supported by WALOCAL API. Use documentUrl approach instead.'
    };
};

export const downloadMedia = async (mediaUrl) => {
    console.warn('⚠️ downloadMedia is for Meta Cloud API only. WALOCAL does not support this endpoint.');
    return {
        success: false,
        error: 'Not supported by WALOCAL API'
    };
};

export const markMessageAsRead = async (messageId, phoneNumberId) => {
    console.warn('⚠️ markMessageAsRead is for Meta Cloud API only. WALOCAL does not support this endpoint.');
    return {
        success: false,
        error: 'Not supported by WALOCAL API'
    };
};

export const getBusinessProfile = async (phoneNumberId) => {
    console.warn('⚠️ getBusinessProfile is for Meta Cloud API only. WALOCAL does not support this endpoint.');
    return {
        success: false,
        error: 'Not supported by WALOCAL API'
    };
};




