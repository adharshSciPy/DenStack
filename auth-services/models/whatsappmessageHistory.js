import mongoose from 'mongoose';

const messageHistorySchema = new mongoose.Schema({
  clinicId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Clinic', 
    required: true 
  },
  recipient: {
    type: String,
    required: true,
    trim: true
  },
  message: {
    type: String,
    trim: true
  },
  status: { 
    type: String, 
    enum: ['sent', 'delivered', 'read', 'failed'], 
    default: 'sent' 
  },
  type: { 
    type: String, 
    enum: ['appointment', 'reminder', 'promotional', 'test', 'document', 'other'], 
    default: 'other' 
  },
  messageId: {
    type: String,
    sparse: true
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  error: {
    type: String
  },
  timestamp: { 
    type: Date, 
    default: Date.now,
    index: true
  }
}, {
  timestamps: true
});

// Index for efficient querying
messageHistorySchema.index({ clinicId: 1, timestamp: -1 });
messageHistorySchema.index({ clinicId: 1, status: 1 });
messageHistorySchema.index({ clinicId: 1, type: 1 });

const MessageHistory = mongoose.model('MessageHistory', messageHistorySchema);
export default MessageHistory;