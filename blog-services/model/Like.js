// models/Like.js
import mongoose from 'mongoose';

const likeSchema = new mongoose.Schema({
  blogId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Blog',
    index: true
  },
  commentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Comment',
    index: true
  },
  doctorId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true
  },
  type: {
    type: String,
    enum: ['blog', 'comment'],
    required: true
  }
}, {
  timestamps: true
});

// Compound indexes for uniqueness
likeSchema.index({ blogId: 1, doctorId: 1 }, { 
  unique: true, 
  partialFilterExpression: { blogId: { $exists: true } } 
});

likeSchema.index({ commentId: 1, doctorId: 1 }, { 
  unique: true, 
  partialFilterExpression: { commentId: { $exists: true } } 
});

const Like = mongoose.model('Like', likeSchema);
export default Like;