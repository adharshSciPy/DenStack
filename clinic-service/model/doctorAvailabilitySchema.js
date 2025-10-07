// models/doctorAvailabilitySchema.js
import mongoose from "mongoose";

const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/; // matches "00:00" to "23:59"

const doctorAvailabilitySchema = new mongoose.Schema({
  doctorId: { 
    type: mongoose.Schema.Types.ObjectId, // comes from another microservice
    required: [true, "Doctor ID is required"], 
    index: true
  },
  clinicId: { 
    type: mongoose.Schema.Types.ObjectId, 
    required: [true, "Clinic ID is required"], 
    index: true
  },
  dayOfWeek: { 
    type: String, 
    enum: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
    required: [true, "Day of week is required"],
    index: true
  },
  startTime: { 
    type: String, 
    required: [true, "Start time is required"],
    match: [timeRegex, "Start time must be in 24-hour format (HH:mm) IST"]
  },
  endTime: { 
    type: String, 
    required: [true, "End time is required"],
    match: [timeRegex, "End time must be in 24-hour format (HH:mm) IST"],
    validate: {
      validator: function(value) {
        if (!timeRegex.test(value) || !timeRegex.test(this.startTime)) return false;
        const [sh, sm] = this.startTime.split(":").map(Number);
        const [eh, em] = value.split(":").map(Number);
        const start = sh * 60 + sm;
        const end = eh * 60 + em;
        return end > start;
      },
      message: "End time must be later than start time"
    }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User" // receptionist/admin (from local service)
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  }
}, { timestamps: true });

// Compound index → optimize queries like 
// "find doctor availability in clinic X on Monday"
doctorAvailabilitySchema.index({ doctorId: 1, clinicId: 1, dayOfWeek: 1 });

export default mongoose.model("DoctorAvailability", doctorAvailabilitySchema);
