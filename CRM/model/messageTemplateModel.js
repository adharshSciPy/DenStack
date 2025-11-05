import mongoose from "mongoose";

const messageTemplateSchema = new mongoose.Schema({
  clinicId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Clinic"
  },
  
  name: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ["appointment_confirmation", "appointment_reminder", "token_ready", "appointment_cancelled"],
    required: true
  },
  channel: {
    type: String,
    enum: ["sms", "email", "whatsapp"],
    required: true
  },
  
  // Template content with variables
  subject: String,
  body: {
    type: String,
    required: true
  },
  
  // Variables: {{patientName}}, {{appointmentDate}}, {{appointmentTime}}, {{doctorName}}, {{opNumber}}, {{clinicName}}
  variables: [String],
  
  isActive: {
    type: Boolean,
    default: true
  },
  isDefault: {
    type: Boolean,
    default: false
  },
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

messageTemplateSchema.index({ clinicId: 1, type: 1, channel: 1 });

export default mongoose.model("MessageTemplate", messageTemplateSchema);