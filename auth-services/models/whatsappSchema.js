import mongoose from 'mongoose';

const whatsAppSettingsSchema = new mongoose.Schema({
  clinicId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Clinic', 
    required: true,
    unique: true 
  },
  isEnabled: { 
    type: Boolean, 
    default: false 
  },
  phoneNumber: {
    type: String,
    trim: true
  },
  phoneNumberId: {
    type: String,
    trim: true
  },
  businessAccountId: {
    type: String,
    trim: true
  },
  walocalApiKey: {  // Changed from accessToken
    type: String,
    select: false,
    default: process.env.WALOCAL_AUTHKEY // Use env var as default
  },
  // Message credits
  messageLimit: { 
    type: Number, 
    default: 1000, // Changed to match your WALOCAL tier
    min: 0
  },
  messagesUsed: { 
    type: Number, 
    default: 0,
    min: 0
  },
  messagesRemaining: { 
    type: Number, 
    default: 1000, // Changed to match your tier
    min: 0
  },
  totalMessagesPurchased: {
    type: Number,
    default: 0
  },
  // Quality metrics from WALOCAL
  qualityRating: {
    type: String,
    enum: ['GREEN', 'YELLOW', 'RED'],
    default: 'GREEN'
  },
  messagingTier: {
    type: String,
    default: 'TIER_1K'
  },
  // Auto-recharge settings
  autoRecharge: { 
    type: Boolean, 
    default: false 
  },
  rechargeThreshold: { 
    type: Number, 
    default: 100, // Changed to 100 for 1000 limit
    min: 1,
    max: 1000
  },
  // Timestamps
  lastRechargeDate: {
    type: Date
  },
  expiryDate: {
    type: Date
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
  updatedAt: { 
    type: Date, 
    default: Date.now 
  }
}, {
  timestamps: true
});

// Virtual for usage percentage
whatsAppSettingsSchema.virtual('usagePercentage').get(function() {
  if (this.messageLimit === 0) return 0;
  return (this.messagesUsed / this.messageLimit) * 100;
});

// Method to check if recharge is needed
whatsAppSettingsSchema.methods.needsRecharge = function() {
  return this.messagesRemaining <= this.rechargeThreshold;
};

// Pre-save middleware
whatsAppSettingsSchema.pre('save', function(next) {
  // Ensure messagesRemaining is never negative
  if (this.messagesRemaining < 0) {
    this.messagesRemaining = 0;
  }
  
  // Update messagesRemaining if messageLimit changes
  if (this.isModified('messageLimit')) {
    const difference = this.messageLimit - (this.messagesUsed + this.messagesRemaining);
    if (difference > 0) {
      this.messagesRemaining += difference;
    }
  }
  
  next();
});

const WhatsAppSettings = mongoose.model('WhatsAppSettings', whatsAppSettingsSchema);
export default WhatsAppSettings;