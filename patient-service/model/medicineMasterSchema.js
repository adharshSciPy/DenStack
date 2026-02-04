// models/MedicineMaster.js
import mongoose, { Schema } from "mongoose";

const medicineSchema = new Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    lowercase: true
  },
  brandNames: [{
    type: String,
    trim: true
  }],
  genericName: {
    type: String,
    trim: true
  },
  dosageForms: [{
    type: String,
    enum: ['tablet', 'capsule', 'syrup', 'injection', 'ointment', 'cream', 'drops', 'inhaler', 'powder', 'suspension', 'gel', 'spray', 'lozenge', 'paste']
  }],
  strengths: [{
    type: String,
    trim: true
  }],
  category: {
    type: String,
    enum: [
      'antibiotic', 
      'analgesic', 
      'anti-inflammatory',
      'antihistamine', 
      'antacid', 
      'vitamin', 
      'steroid', 
      'antifungal', 
      'antiviral',
      'mouthwash',
      'local-anesthetic',
      'fluoride',
      'other'
    ],
    default: 'other'
  },
  prescriptionRequired: {
    type: Boolean,
    default: true
  },
  usageCount: {
    type: Number,
    default: 0
  },
  lastUsed: {
    type: Date,
    default: Date.now
  },
  createdByDoctor: {
    type: Schema.Types.ObjectId,
    ref: 'Doctor'
  },
  clinicId: {
    type: Schema.Types.ObjectId,
    ref: 'Clinic'
  },
  isApproved: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Indexes for fast searching
medicineSchema.index({ 
  name: 'text', 
  brandNames: 'text', 
  genericName: 'text' 
});
medicineSchema.index({ usageCount: -1 });
medicineSchema.index({ lastUsed: -1 });
medicineSchema.index({ isApproved: 1 });

// Virtual for common formulations
medicineSchema.virtual('commonFormulations').get(function() {
  const forms = this.dosageForms || [];
  return forms.map(form => {
    const strength = this.strengths?.[0] || '';
    return `${this.name} ${strength} ${form}`.trim();
  });
});

const MedicineMaster = mongoose.model('MedicineMaster', medicineSchema);
export default MedicineMaster;