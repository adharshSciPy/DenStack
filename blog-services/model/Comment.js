// models/Comment.js
import mongoose from 'mongoose';

const commentSchema = new mongoose.Schema({
  blogId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Blog',
    required: true,
    index: true
  },
  doctorId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true
  },
  parentCommentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Comment',
    default: null,
    index: true
  },
  text: {
    type: String,
    required: true,
    trim: true
  },
  // Store minimal doctor info locally
  authorInfo: {
    name: String,
    profilePicture: String,
    specialty: String
  },
  likeCount: {
    type: Number,
    default: 0
  },
  replyCount: {
    type: Number,
    default: 0
  },
  isEdited: {
    type: Boolean,
    default: false
  },
  status: {
    type: String,
    enum: ['active', 'deleted', 'hidden'],
    default: 'active'
  },
  deletedAt: {
    type: Date
  }
}, {
  timestamps: true
});

const Comment = mongoose.model('Comment', commentSchema);
export default Comment;