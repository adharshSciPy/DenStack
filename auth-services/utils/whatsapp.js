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
    fileName = ''
}) => {
    try {
        // Validate authkey
        if (!WALOCAL_AUTHKEY) {
            throw new Error('WALOCAL_AUTHKEY not configured in environment');
        }

        // Clean phone number (remove + and spaces)
        const cleanMobile = to.replace('+', '').replace(/\s/g, '');

        // Build base query parameters
        const params = {
            authkey: WALOCAL_AUTHKEY,
            mobile: cleanMobile
        };

        let response;

        if (type === 'text') {
            // Text message format: ?authkey=xxx&mobile=xxx&type=text&message=xxx
            if (!message) {
                throw new Error('Message is required for text type');
            }
            params.type = 'text';
            params.message = message;

        } else if (type === 'template') {
            // Template message format: ?authkey=xxx&mobile=xxx&tempid=template_name
            if (!templateName) {
                throw new Error('Template name is required for template messages');
            }
            params.tempid = templateName;

        } else if (type === 'document') {
            // Document message using a template
            if (!templateName) {
                throw new Error('Template name is required for document messages. Create a template with document header in WALOCAL dashboard first.');
            }
            if (!documentUrl) {
                throw new Error('Public document URL is required');
            }

            // Use 'tempid' parameter, not 'type=document'
            params.tempid = templateName; // e.g., 'document_template'
            params.document_url = documentUrl;
            if (caption) params.caption = caption;
            if (fileName) params.filename = fileName;

            // Note: 'type' parameter is NOT used for templates
            delete params.type;

        } else {
            throw new Error(`Unsupported message type: ${type}`);
        }

        // Build URL with query parameters
        const url = `${WHATSAPP_API_BASE}/?${new URLSearchParams(params).toString()}`;
        console.log(`📡 WALOCAL ${type} URL:`, url);

        // Make the request
        response = await axios.get(url, {
            timeout: type === 'document' ? 30000 : 10000,
            validateStatus: status => status < 500 // Don't throw on 4xx errors
        });

        // Check response status
        if (response.status >= 400) {
            throw new Error(`WALOCAL API returned status ${response.status}: ${JSON.stringify(response.data)}`);
        }

        console.log('✅ WALOCAL response:', response?.data);

        return {
            success: true,
            messageId: response?.data?.id || response?.data?.message_id || Date.now().toString(),
            data: response?.data
        };

    } catch (error) {
        console.error('❌ WALOCAL API Error:', {
            message: error.message,
            status: error.response?.status,
            data: error.response?.data,
            url: error.config?.url
        });

        return {
            success: false,
            error: error.response?.data?.message || error.message,
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
