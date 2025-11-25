import mongoose from "mongoose";

const notificationLogSchema = new mongoose.Schema({
  clinicId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Clinic",
    required: true,
    index: true
  },
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Patient",
    required: true,
    index: true
  },
  appointmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Appointment",
    index: true
  },
  
  // Notification details
  type: {
    type: String,
    enum: ["appointment_confirmation", "appointment_reminder", "token_ready", "appointment_cancelled", "doctor_notification"],
    required: true
  },
  channel: {
    type: String,
    enum: ["sms", "email", "whatsapp"],
    required: true
  },
  
  // Recipient info
  recipient: {
    phone: Number,
    email: String,
    name: String
  },
  
  // Message content
  subject: String, // ✅ Added for email notifications
  message: {
    type: String,
    required: true
  },
  templateId: String,
  
  // Status tracking
  status: {
    type: String,
    enum: ["pending", "sent", "delivered", "failed", "bounced"],
    default: "pending",
    index: true
  },
  
  // Provider details
  provider: {
    name: String,
    messageId: String,
    response: mongoose.Schema.Types.Mixed
  },
  
  // Error tracking
  errorMessage: String,
  retryCount: {
    type: Number,
    default: 0
  },
  maxRetries: {
    type: Number,
    default: 3
  },
  
  // Scheduling
  scheduledAt: Date,
  sentAt: Date,
  deliveredAt: Date,
  
  // Metadata
  metadata: mongoose.Schema.Types.Mixed,
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Indexes
notificationLogSchema.index({ clinicId: 1, createdAt: -1 });
notificationLogSchema.index({ appointmentId: 1, type: 1 });
notificationLogSchema.index({ status: 1, scheduledAt: 1 });
notificationLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7776000 }); // 90 days

export default mongoose.model("NotificationLog", notificationLogSchema);