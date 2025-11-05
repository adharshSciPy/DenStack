// ================================
// services/notificationService.js
// ================================
import axios from "axios";
import dotenv from "dotenv";
import NotificationLog from "../model/notificationModel.js";
import MessageTemplate from "../models/MessageTemplate.js";

dotenv.config();

const PATIENT_SERVICE_BASE_URL = process.env.PATIENT_SERVICE_BASE_URL;
const CLINIC_SERVICE_BASE_URL = process.env.CLINIC_SERVICE_BASE_URL;

class NotificationService {
  

  async sendSMS(notification) {
    try {
      const USE_MSG91 = process.env.USE_MSG91 === "true";
      
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
        
        const response = await axios.post(
          `https://control.msg91.com/api/v5/flow/`,
          {
            sender: MSG91_SENDER_ID,
            route: "4", // Transactional route
            country: "91",
            sms: [{
              message: notification.message,
              to: [notification.recipient.phone.toString()]
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
        
        const response = await axios.post(
          `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
          new URLSearchParams({
            To: `+91${notification.recipient.phone}`,
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
      
      notification.status = "failed";
      notification.errorMessage = error.message;
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
        console.log("SendGrid not configured");
        return;
      }
      
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
      notification.status = "failed";
      notification.errorMessage = error.message;
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
        email: "Your appointment has been confirmed for {{appointmentDate}} at {{appointmentTime}}.",
        whatsapp: "Hi {{patientName}}! Your appointment is scheduled for {{appointmentDate}} at {{appointmentTime}}. OP#: {{opNumber}}"
      },
      appointment_reminder: {
        sms: "Reminder: You have an appointment tomorrow at {{appointmentTime}}. OP Number: {{opNumber}}. - {{clinicName}}",
        email: "This is a reminder for your appointment tomorrow at {{appointmentTime}}.",
        whatsapp: "Hi {{patientName}}! Reminder for your appointment tomorrow at {{appointmentTime}}."
      },
      token_ready: {
        sms: "Your token number {{opNumber}} is ready. Please proceed to the consultation room. - {{clinicName}}",
        email: "Your token is ready. Please visit the consultation room.",
        whatsapp: "🔔 Your token {{opNumber}} is ready! Please proceed to consultation."
      }
    };
    
    const template = new MessageTemplate({
      clinicId,
      name: `Default ${type} (${channel})`,
      type,
      channel,
      body: templates[type]?.[channel] || "Notification from {{clinicName}}",
      variables: ["patientName", "appointmentDate", "appointmentTime", "opNumber", "clinicName"],
      isDefault: true,
      isActive: true
    });
    
    await template.save();
    return template;
  }
}

export default new NotificationService();