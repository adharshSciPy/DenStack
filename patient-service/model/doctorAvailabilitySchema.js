import mongoose from "mongoose";

const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/; 

const availabilitySlotSchema = new mongoose.Schema({
  dayOfWeek: { 
    type: String, 
    enum: ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"],
    required: true
  },
  startTime: { 
    type: String, 
    required: true,
    match: [timeRegex, "Start time must be in HH:mm format"]
  },
  endTime: { 
    type: String, 
    required: true,
    match: [timeRegex, "End time must be in HH:mm format"],
    validate: {
      validator: function(value) {
        const start = this.startTime.split(":").map(Number);
        const end = value.split(":").map(Number);
        return end[0]*60+end[1] > start[0]*60+start[1];
      },
      message: "End time must be later than start time"
    }
  },
  isActive: { type: Boolean, default: true },
}, { _id: false });

const doctorAvailabilitySchema = new mongoose.Schema({
  doctorId: { 
    type: mongoose.Schema.Types.ObjectId, 
    required: true,
    index: true
  },
  clinicId: { 
    type: mongoose.Schema.Types.ObjectId, 
    required: true,
    index: true
  },
  availability: {
    type: [availabilitySlotSchema],
    default: []
  },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
}, { timestamps: true });

// Ensure only one document per doctor-clinic
doctorAvailabilitySchema.index({ doctorId: 1, clinicId: 1 }, { unique: true });

export default mongoose.model("DoctorAvailability", doctorAvailabilitySchema);




