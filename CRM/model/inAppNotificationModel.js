import mongoose from "mongoose";

const inAppNotificationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true
  },
  userRole: {
    type: String,
    enum: ["doctor", "receptionist", "admin"],
    required: true
  },
  
  type: {
    type: String,
    enum: ["new_appointment", "appointment_reminder", "appointment_cancelled", "token_ready"],
    required: true
  },
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  
  appointmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Appointment"
  },
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Patient"
  },
  clinicId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Clinic"
  },
  
  isRead: {
    type: Boolean,
    default: false
  },
  readAt: Date,
  
  metadata: mongoose.Schema.Types.Mixed,
  
  createdAt: { type: Date, default: Date.now, index: true }
});

inAppNotificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });
inAppNotificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 2592000 }); // 30 days

export default mongoose.model("InAppNotification", inAppNotificationSchema);