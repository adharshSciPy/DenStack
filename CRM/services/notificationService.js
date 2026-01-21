// ================================
// services/notificationService.js (UPDATED)
// ================================
import axios from "axios";
import dotenv from "dotenv";
import NotificationLog from "../model/notificationModel.js";
import MessageTemplate from "../model/messageTemplateModel.js";

dotenv.config();

const PATIENT_SERVICE_BASE_URL = process.env.PATIENT_SERVICE_BASE_URL;
const CLINIC_SERVICE_BASE_URL = process.env.CLINIC_SERVICE_BASE_URL;

class NotificationService {
  
  // ================================
  // Helper to clean phone number
  // ================================
  cleanPhoneNumber(phone) {
    if (!phone) return null;
    
    // Convert to string and remove all non-digits
    let cleaned = phone.toString().replace(/\D/g, '');
    
    // Remove leading 91 if present (for Indian numbers)
    if (cleaned.startsWith('91') && cleaned.length === 12) {
      cleaned = cleaned.substring(2);
    }
    
    // Should be 10 digits for Indian mobile
    if (cleaned.length !== 10) {
      console.warn(`⚠️  Invalid phone number length: ${cleaned} (expected 10 digits)`);
      return null;
    }
    
    return cleaned;
  }

  // ================================
  // SMS SENDING
  // ================================
  async sendSMS(notification) {
    try {
      const USE_MSG91 = process.env.USE_MSG91 === "true";
      
      // Clean phone number
      const cleanedPhone = this.cleanPhoneNumber(notification.recipient.phone);
      
      if (!cleanedPhone) {
        throw new Error(`Invalid phone number: ${notification.recipient.phone}`);
      }
      
      if (USE_MSG91) {
        // MSG91 (Popular in India)
        const MSG91_AUTH_KEY = process.env.MSG91_AUTH_KEY;
        const MSG91_SENDER_ID = process.env.MSG91_SENDER_ID;
        
        if (!MSG91_AUTH_KEY) {
          console.log("MSG91 not configured, marking as sent (dev mode)");
          notification.status = "sent";
          notification.sentAt = new Date();
          await notification.save();
          return;
        }
        
        console.log(`📤 Sending SMS to: ${cleanedPhone} via MSG91`);
        
        const response = await axios.post(
          `https://control.msg91.com/api/v5/flow/`,
          {
            sender: MSG91_SENDER_ID,
            route: "4", // Transactional route
            country: "91",
            sms: [{
              message: notification.message,
              to: [cleanedPhone]
            }]
          },
          {
            headers: {
              authkey: MSG91_AUTH_KEY,
              "Content-Type": "application/json"
            }
          }
        );
        
        notification.status = "sent";
        notification.sentAt = new Date();
        notification.provider = {
          name: "msg91",
          messageId: response.data?.request_id,
          response: response.data
        };
        await notification.save();
        
        console.log("✅ MSG91 SMS sent:", response.data?.request_id);
        
      } else {
        // Twilio (Alternative)
        const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
        const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
        const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER;
        
        if (!TWILIO_ACCOUNT_SID) {
          console.log("Twilio not configured, marking as sent (dev mode)");
          notification.status = "sent";
          notification.sentAt = new Date();
          await notification.save();
          return;
        }
        
        console.log(`📤 Sending SMS to: +91${cleanedPhone} via Twilio`);
        
        const response = await axios.post(
          `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
          new URLSearchParams({
            To: `+91${cleanedPhone}`,
            From: TWILIO_PHONE_NUMBER,
            Body: notification.message
          }),
          {
            auth: {
              username: TWILIO_ACCOUNT_SID,
              password: TWILIO_AUTH_TOKEN
            }
          }
        );
        
        notification.status = "sent";
        notification.sentAt = new Date();
        notification.provider = {
          name: "twilio",
          messageId: response.data.sid,
          response: response.data
        };
        await notification.save();
        
        console.log("✅ Twilio SMS sent:", response.data.sid);
      }
      
    } catch (error) {
      console.error("❌ SMS sending failed:", error.message);
      
      if (error.response) {
        console.error("Response error:", error.response.data);
      }
      
      notification.status = "failed";
      notification.errorMessage = error.response?.data?.message || error.message;
      notification.retryCount += 1;
      await notification.save();
      
      // Retry logic (max 3 attempts)
      if (notification.retryCount < notification.maxRetries) {
        console.log(`🔄 Retrying SMS (attempt ${notification.retryCount}/${notification.maxRetries})`);
        setTimeout(() => this.sendSMS(notification), 5000 * notification.retryCount);
      }
      
      throw error;
    }
  }
  
  // ================================
  // EMAIL SENDING (SendGrid)
  // ================================
  async sendEmail(notification) {
    try {
      const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
      const FROM_EMAIL = process.env.FROM_EMAIL;
      
      if (!SENDGRID_API_KEY) {
        console.log("SendGrid not configured, marking as sent (dev mode)");
        notification.status = "sent";
        notification.sentAt = new Date();
        await notification.save();
        return;
      }
      
      console.log(`📧 Sending email to: ${notification.recipient.email}`);
      
      const response = await axios.post(
        "https://api.sendgrid.com/v3/mail/send",
        {
          personalizations: [{
            to: [{ email: notification.recipient.email }],
            subject: notification.subject || "Appointment Notification"
          }],
          from: { email: FROM_EMAIL },
          content: [{
            type: "text/plain",
            value: notification.message
          }]
        },
        {
          headers: {
            Authorization: `Bearer ${SENDGRID_API_KEY}`,
            "Content-Type": "application/json"
          }
        }
      );
      
      notification.status = "sent";
      notification.sentAt = new Date();
      notification.provider = {
        name: "sendgrid",
        messageId: response.headers["x-message-id"],
        response: response.data
      };
      await notification.save();
      
      console.log("✅ Email sent successfully");
      
    } catch (error) {
      console.error("❌ Email sending failed:", error.message);
      
      if (error.response) {
        console.error("Response error:", error.response.data);
      }
      
      notification.status = "failed";
      notification.errorMessage = error.response?.data?.errors?.[0]?.message || error.message;
      await notification.save();
      throw error;
    }
  }
  
  // ================================
  // TEMPLATE HELPERS
  // ================================
  replaceVariables(template, variables) {
    let message = template;
    Object.keys(variables).forEach(key => {
      const regex = new RegExp(`{{${key}}}`, "g");
      message = message.replace(regex, variables[key] || "");
    });
    return message;
  }
  
  async createDefaultTemplate(clinicId, type, channel) {
    const templates = {
      appointment_confirmation: {
        sms: "Dear {{patientName}}, your appointment is confirmed for {{appointmentDate}} at {{appointmentTime}}. Your OP Number is {{opNumber}}. - {{clinicName}}",
        email: {
          subject: "Appointment Confirmation - {{clinicName}}",
          body: "Dear {{patientName}},\n\nYour appointment has been confirmed for {{appointmentDate}} at {{appointmentTime}}.\n\nYour OP Number: {{opNumber}}\n\nThank you,\n{{clinicName}}"
        },
        whatsapp: "Hi {{patientName}}! Your appointment is scheduled for {{appointmentDate}} at {{appointmentTime}}. OP#: {{opNumber}}"
      },
      appointment_reminder: {
        sms: "Reminder: You have an appointment tomorrow at {{appointmentTime}}. OP Number: {{opNumber}}. - {{clinicName}}",
        email: {
          subject: "Appointment Reminder - {{clinicName}}",
          body: "Dear {{patientName}},\n\nThis is a reminder for your appointment tomorrow at {{appointmentTime}}.\n\nYour OP Number: {{opNumber}}\n\nSee you soon,\n{{clinicName}}"
        },
        whatsapp: "Hi {{patientName}}! Reminder for your appointment tomorrow at {{appointmentTime}}."
      },
      token_ready: {
        sms: "Your token number {{opNumber}} is ready. Please proceed to the consultation room. - {{clinicName}}",
        email: {
          subject: "Your Token is Ready - {{clinicName}}",
          body: "Dear {{patientName}},\n\nYour token {{opNumber}} is ready. Please visit the consultation room.\n\nThank you,\n{{clinicName}}"
        },
        whatsapp: "🔔 Your token {{opNumber}} is ready! Please proceed to consultation."
      },
      doctor_notification: {
        email: {
          subject: "New Appointment: {{patientName}} - {{appointmentDate}}",
          body: "Dear Dr. {{doctorName}},\n\nYou have a new appointment scheduled:\n\nPatient: {{patientName}}\nDate: {{appointmentDate}}\nTime: {{appointmentTime}}\nOP Number: {{opNumber}}\n\nBest regards,\n{{clinicName}}"
        },
        sms: "Dr. {{doctorName}}, new appointment: {{patientName}} on {{appointmentDate}} at {{appointmentTime}}. OP#{{opNumber}}"
      },
      // ✅ ADD THIS: Birthday wish template
      birthday_wish: {
        sms: "🎉 Happy Birthday {{patientName}}! 🎂\n\nWishing you a wonderful day filled with joy and good health!\n\n- {{clinicName}}",
        email: {
          subject: "🎉 Happy Birthday {{patientName}}!",
          body: `<div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px;">
  <h1 style="color: #4CAF50;">🎉 Happy Birthday {{patientName}}! 🎂</h1>
  
  <p style="font-size: 16px; line-height: 1.6;">
    Wishing you a wonderful birthday filled with joy, laughter, and good health!
  </p>
  
  <p style="font-size: 16px; line-height: 1.6;">
    Thank you for trusting us with your healthcare. We hope you have an amazing year ahead!
  </p>
  
  <p style="margin-top: 30px; font-size: 14px; color: #666;">
    Warm wishes,<br>
    <strong>{{clinicName}}</strong>
  </p>
</div>`
        },
        whatsapp: "🎉🎂 Happy Birthday {{patientName}}! Wishing you health and happiness! - {{clinicName}}"
      }
    };
    
    const templateData = templates[type]?.[channel];
    
    // Handle email templates with subject and body
    const body = typeof templateData === 'object' ? templateData.body : templateData;
    const subject = typeof templateData === 'object' ? templateData.subject : undefined;
    
    const template = new MessageTemplate({
      clinicId,
      name: `Default ${type} (${channel})`,
      type,
      channel,
      subject,
      body: body || "Notification from {{clinicName}}",
      variables: ["patientName", "appointmentDate", "appointmentTime", "opNumber", "clinicName"],
      isDefault: true,
      isActive: true
    });
    
    await template.save();
    return template;
  }
}

export default new NotificationService();