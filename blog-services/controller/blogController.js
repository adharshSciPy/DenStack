// controllers/blogController.js
import Blog from "../model/Blob.js";
import Comment from "../model/Comment.js";
import Like from "../model/Like.js";
import axios from "axios";
import fs from "fs";
import path from "path";

// ==================== CONFIGURATION ====================
const DOCTOR_SERVICE_URL =
  process.env.DOCTOR_SERVICE_URL || "http://localhost:8001";

// ==================== HELPER: FETCH DOCTOR DATA ====================

/**
 * Fetch doctor data from doctor service
 */
async function fetchDoctorData(doctorId) {
  try {
    if (!doctorId) return null;

    const response = await axios.get(
      `${DOCTOR_SERVICE_URL}/api/v1/auth/doctor/details/${doctorId}`,
    );
    
    if (response.data.data && response.data.success) {
      return {
        _id: doctorId,
        name: response.data.data.name,
        email: response.data.data.email,
        profilePicture: response.data.data.profilePicture || null,
        specialty: response.data.data.specialization || "General",
      };
    }
    return null;
  } catch (error) {
    console.error(`Error fetching doctor ${doctorId}:`, error.message);
    // Return fallback data
    return {
      _id: doctorId,
      name: "Doctor",
      email: "",
      profilePicture: null,
      specialty: "General",
      offline: true, // Flag to indicate data couldn't be fetched
    };
  }
}

/**
 * Batch fetch doctors data (for optimization)
 * 
 * 
 */
// utils/doctorService.js
const doctorCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Batch fetch doctors using the batch API
 */
export const batchFetchDoctors = async (doctorIds) => {
  try {
    if (!doctorIds || doctorIds.length === 0) return {};
    
    // Filter out null/undefined IDs and get unique IDs
    const uniqueIds = [...new Set(doctorIds.filter(id => id))];
    
    // Check cache for each ID
    const cachedResults = {};
    const idsToFetch = [];
    
    uniqueIds.forEach(id => {
      const cached = doctorCache.get(id);
      if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
        cachedResults[id] = cached.data;
      } else {
        idsToFetch.push(id);
      }
    });
    
    // If all IDs are cached, return immediately
    if (idsToFetch.length === 0) {
      return cachedResults;
    }
    
    // Use your batch API endpoint
    const response = await axios.post(
      `${DOCTOR_SERVICE_URL}/api/v1/auth/doctor/doctors-batch`, // Your batch endpoint
      { doctorIds: idsToFetch },
      {
        headers: { 
          'Authorization': `Bearer ${process.env.INTERNAL_SERVICE_TOKEN}`,
          'Content-Type': 'application/json',
          'X-Service-Name': 'blog-service'
        },
        timeout: 10000
      }
    );
    
    // Get doctors from response (assuming structure matches your example)
    let doctorsMap = response.data.doctors || {};
    
    // Update cache with fetched data and format it
    Object.entries(doctorsMap).forEach(([id, doctorData]) => {
      const formattedData = {
        _id: id,
        name: doctorData.name || 'Doctor',
        email: doctorData.email || '',
        profilePicture: doctorData.profilePicture || null,
        specialty: doctorData.specialization || doctorData.specialty || 'General', // Note: your API uses "specialization"
        // qualifications: doctorData.qualifications || [],
        // hospital: doctorData.hospital || '',
        // experience: doctorData.experience || 0,
        // verified: doctorData.verified || false
      };
      
      doctorCache.set(id, {
        data: formattedData,
        timestamp: Date.now()
      });
      
      doctorsMap[id] = formattedData;
    });
    
    // Add fallback for any IDs that weren't returned
    idsToFetch.forEach(id => {
      if (!doctorsMap[id]) {
        const fallbackData = {
          _id: id,
          name: 'Doctor',
          email: '',
          profilePicture: null,
          specialty: 'General',
          offline: true
        };
        
        doctorsMap[id] = fallbackData;
        doctorCache.set(id, {
          data: fallbackData,
          timestamp: Date.now()
        });
      }
    });
    
    // Combine cached and fetched results
    return { ...cachedResults, ...doctorsMap };
    
  } catch (error) {
    console.error("Error batch fetching doctors:", error.message);
  }
};
// ==================== BLOG CRUD OPERATIONS ====================

/**
 * Create a new blog (Doctor only)
 */
const createBlog = async (req, res) => {
  try {
    const { title, content, tags } = req.body;
    const doctorId = req.user.doctorId; // From auth middleware

    // Validate doctor exists
    const doctorData = await fetchDoctorData(doctorId);
    if (!doctorData) {
      return res.status(404).json({
        success: false,
        message: "Doctor not found",
      });
    }

    // Collect all image URLs
    const imageUrl = req.files
      ? req.files.map((file) => `/uploads/blogImages/${file.filename}`)
      : [];

    const blog = new Blog({
      doctorId,
      title,
      content,
      imageUrl,
      tags: tags ? tags.split(",").map((tag) => tag.trim()) : [],
      status: "published",
    });

    await blog.save();

    // Enrich blog with doctor data
    const enrichedBlog = {
      ...blog.toObject(),
      doctor: doctorData,
    };

    res.status(201).json({
      success: true,
      message: "Blog created successfully",
      blog: enrichedBlog,
    });
  } catch (error) {
    console.error("Error creating blog:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Get all blogs with doctor data
 */
const getAllBlogs = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      specialty,
      search,
      sortBy = "recent",
    } = req.query;

    // Build query
    const query = { status: "published" };

    if (specialty) {
      query["doctorSpecialty"] = specialty;
    }

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { content: { $regex: search, $options: "i" } },
        { tags: { $regex: search, $options: "i" } },
      ];
    }

    // Build sort
    let sort = { createdAt: -1 };
    switch (sortBy) {
      case "popular":
        sort = { likesCount: -1, createdAt: -1 };
        break;
      case "trending":
        // Combination of recent and popular
        sort = {
          likesCount: -1,
          commentCount: -1,
          createdAt: -1,
        };
        break;
      case "oldest":
        sort = { createdAt: 1 };
        break;
    }

    // Get paginated blogs
    const blogs = await Blog.find(query)
      .sort(sort)
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .lean();

    // Collect all doctor IDs
    const doctorIds = blogs.map((blog) => blog.doctorId).filter((id) => id);

    // Enrich blogs with doctor data
    const enrichedBlogs = await Promise.all(
      blogs.map(async (blog) => {
        return {
          ...blog,
          doctor:
            doctorsMap[blog.doctorId] || (await fetchDoctorData(blog.doctorId)),
        };
      }),
    );

    // Get total count for pagination
    const totalBlogs = await Blog.countDocuments(query);
    const totalPages = Math.ceil(totalBlogs / parseInt(limit));

    res.json({
      success: true,
      blogs: enrichedBlogs,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalBlogs,
        hasNextPage: parseInt(page) < totalPages,
        hasPrevPage: parseInt(page) > 1,
      },
    });
  } catch (error) {
    console.error("Error getting blogs:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Get single blog by ID with doctor data
 */
const getBlogById = async (req, res) => {
  try {
    const { id } = req.params;

    const blog = await Blog.findById(id).lean();
    if (!blog) {
      return res.status(404).json({
        success: false,
        message: "Blog not found",
      });
    }
    console.log("sds",blog);
    
    // Fetch doctor data
    const doctorData = await fetchDoctorData(blog.doctorId);

    // Increment view count
    await Blog.findByIdAndUpdate(id, { $inc: { viewCount: 1 } });

    res.json({
      success: true,
      blog: {
        ...blog,
        doctor: doctorData,
      },
    });
  } catch (error) {
    console.error("Error getting blog:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Get blogs by current doctor
 */
const getBlogsByDoctor = async (req, res) => {
  try {
    const doctorId = req.user.doctorId;

    const blogs = await Blog.find({ doctorId }).sort({ createdAt: -1 }).lean();

    // Fetch doctor data
    const doctorData = await fetchDoctorData(doctorId);

    const enrichedBlogs = blogs.map((blog) => ({
      ...blog,
      doctor: doctorData,
    }));

    res.json({
      success: true,
      blogs: enrichedBlogs,
      total: blogs.length,
    });
  } catch (error) {
    console.error("Error getting doctor blogs:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Get other doctors' blogs (excluding current doctor)
 */
const getOtherDoctorBlogs = async (req, res) => {
  try {
    const doctorId = req.user.doctorId;

    const blogs = await Blog.find({
      doctorId: { $ne: doctorId },
      status: "published",
    })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    if (!blogs.length) {
      return res.json({ success: true, blogs: [] });
    }

    // ✅ unique doctor ids
    const doctorIds = [...new Set(blogs.map((b) => b.doctorId.toString()))];

    // ✅ SINGLE batch fetch (modify your API accordingly)
    // const doctors = await fetchDoctorsBatch(doctorIds);

    // ✅ map for O(1) lookup
    const doctorsMap = {};
    
    const enrichedBlogs = blogs.map((blog) => ({
      ...blog,
      doctor: doctorsMap[blog.doctorId.toString()] || null,
    }));

    res.json({
      success: true,
      blogs: enrichedBlogs,
    });
  } catch (error) {
    console.error("Error getting other doctors blogs:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Edit blog (Doctor only - owner check)
 */
const editBlog = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, content, tags } = req.body;
    const doctorId = req.user.doctorId;

    const blog = await Blog.findById(id);
    if (!blog) {
      return res.status(404).json({
        success: false,
        message: "Blog not found",
      });
    }

    // Check ownership
    if (blog.doctorId.toString() !== doctorId) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized - You can only edit your own blogs",
      });
    }

    // Update fields
    blog.title = title || blog.title;
    blog.content = content || blog.content;
    blog.tags = tags ? tags.split(",").map((tag) => tag.trim()) : blog.tags;
    blog.updatedAt = new Date();

    // Handle image updates
    if (req.files && req.files.length > 0) {
      // Delete old images
      blog.imageUrl.forEach((url) => {
        const filename = url.split("/").pop();
        const filePath = path.join(
          process.cwd(),
          "uploads",
          "blogImages",
          filename,
        );

        if (fs.existsSync(filePath)) {
          try {
            fs.unlinkSync(filePath);
          } catch (err) {
            console.error(`Error deleting file: ${filename}`, err);
          }
        }
      });

      // Add new images
      const newImageUrls = req.files.map(
        (file) => `/uploads/blogImages/${file.filename}`,
      );
      blog.imageUrl = newImageUrls;
    }

    await blog.save();

    // Fetch doctor data
    const doctorData = await fetchDoctorData(doctorId);

    res.json({
      success: true,
      message: "Blog updated successfully",
      blog: {
        ...blog.toObject(),
        doctor: doctorData,
      },
    });
  } catch (error) {
    console.error("Error editing blog:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Delete blog (Doctor only - owner check)
 */
const deleteBlog = async (req, res) => {
  try {
    const { id } = req.params;
    const doctorId = req.user.doctorId;

    const blog = await Blog.findById(id);
    if (!blog) {
      return res.status(404).json({
        success: false,
        message: "Blog not found",
      });
    }

    // Check ownership
    if (blog.doctorId.toString() !== doctorId) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized - You can only delete your own blogs",
      });
    }

    // Delete associated images
    blog.imageUrl.forEach((url) => {
      const filename = url.split("/").pop();
      const filePath = path.join(
        process.cwd(),
        "uploads",
        "blogImages",
        filename,
      );

      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (err) {
          console.error(`Error deleting file: ${filename}`, err);
        }
      }
    });

    // Delete associated comments and likes
    await Comment.deleteMany({ blogId: id });
    await Like.deleteMany({ blogId: id });

    await blog.deleteOne();

    res.json({
      success: true,
      message: "Blog deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting blog:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ==================== COMMENT OPERATIONS ====================

/**
 * Add comment to blog (Doctor only)
 */
const addComment = async (req, res) => {
  try {
    const { blogId } = req.params;
    const { text, parentCommentId } = req.body;
    const doctorId = req.user.doctorId;

    // Validate blog exists
    const blog = await Blog.findById(blogId);
    if (!blog) {
      return res.status(404).json({
        success: false,
        message: "Blog not found",
      });
    }

    // Fetch doctor data for comment author
    const doctorData = await fetchDoctorData(doctorId);
    if (!doctorData) {
      return res.status(404).json({
        success: false,
        message: "Doctor not found",
      });
    }

    let parentComment = null;
    if (parentCommentId) {
      parentComment = await Comment.findById(parentCommentId);
      if (!parentComment) {
        return res.status(404).json({
          success: false,
          message: "Parent comment not found",
        });
      }
    }

    // Create comment
    const comment = new Comment({
      blogId,
      doctorId,
      text,
      parentCommentId: parentCommentId || null,
      authorInfo: {
        id: doctorId,
        name: doctorData.name,
        profilePicture: doctorData.profilePicture,
        specialty: doctorData.specialty,
      },
      status: "active",
    });

    await comment.save();

    // Update counters
    if (parentCommentId) {
      await Comment.findByIdAndUpdate(parentCommentId, {
        $inc: { replyCount: 1 },
      });
    } else {
      await Blog.findByIdAndUpdate(blogId, {
        $inc: { commentCount: 1 },
      });
    }

    res.status(201).json({
      success: true,
      message: parentCommentId
        ? "Reply added successfully"
        : "Comment added successfully",
      comment: {
        ...comment.toObject(),
        doctor: doctorData,
      },
    });
  } catch (error) {
    console.error("Error adding comment:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Get comments for a blog
 */
const getBlogComments = async (req, res) => {
  try {
    const { blogId } = req.params;
    const { page = 1, limit = 20, includeReplies = true } = req.query;

    // Validate blog
    const blog = await Blog.findById(blogId);
    if (!blog) {
      return res.status(404).json({
        success: false,
        message: "Blog not found",
      });
    }

    // Get top-level comments
    const comments = await Comment.find({
      blogId,
      parentCommentId: null,
      status: "active",
    })
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .lean();

    // Get doctor IDs for all comments
    const doctorIds = comments.map((c) => c.doctorId).filter(id => id);
    
    // Fetch doctor data in batch
    let doctorsMap = {};
    if (doctorIds.length > 0) {
      doctorsMap = await batchFetchDoctors(doctorIds);
    }

    // Enrich comments with doctor data
    let enrichedComments = comments.map((comment) => {
      const doctorData = doctorsMap[comment.doctorId] || comment.authorInfo || {
        _id: comment.doctorId,
        name: "Doctor",
        profilePicture: null,
        specialty: "General"
      };
      return {
        ...comment,
        doctor: doctorData,
      };
    });

    // Include replies if requested
    if (includeReplies === "true") {
      enrichedComments = await Promise.all(
        enrichedComments.map(async (comment) => {
          const replies = await Comment.find({
            parentCommentId: comment._id,
            status: "active",
          })
            .sort({ createdAt: 1 })
            .limit(5)
            .lean();

          // Get doctor IDs for replies
          const replyDoctorIds = replies.map((r) => r.doctorId).filter(id => id);
          
          // Fetch doctor data for replies
          let replyDoctorsMap = {};
          if (replyDoctorIds.length > 0) {
            replyDoctorsMap = await batchFetchDoctors(replyDoctorIds);
          }

          const enrichedReplies = replies.map((reply) => {
            const doctorData = replyDoctorsMap[reply.doctorId] || 
                               reply.authorInfo || {
                                 _id: reply.doctorId,
                                 name: "Doctor",
                                 profilePicture: null,
                                 specialty: "General"
                               };
            return {
              ...reply,
              doctor: doctorData,
            };
          });

          return {
            ...comment,
            replies: enrichedReplies,
            hasMoreReplies: comment.replyCount > enrichedReplies.length,
          };
        }),
      );
    }

    const totalComments = await Comment.countDocuments({
      blogId,
      parentCommentId: null,
      status: "active",
    });

    res.json({
      success: true,
      comments: enrichedComments,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalComments / parseInt(limit)),
        totalComments,
      },
    });
  } catch (error) {
    console.error("Error getting comments:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
/**
 * Edit comment (Doctor only - owner check)
 */
const editComment = async (req, res) => {
  try {
    const { commentId } = req.params;
    const { text } = req.body;
    const doctorId = req.user.doctorId;

    const comment = await Comment.findById(commentId);
    if (!comment) {
      return res.status(404).json({
        success: false,
        message: "Comment not found",
      });
    }

    // Check ownership
    if (comment.doctorId.toString() !== doctorId) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized - You can only edit your own comments",
      });
    }

    // Update comment
    comment.text = text;
    comment.isEdited = true;
    comment.editedAt = new Date();
    await comment.save();

    // Fetch doctor data
    const doctorData = await fetchDoctorData(doctorId);

    res.json({
      success: true,
      message: "Comment updated successfully",
      comment: {
        ...comment.toObject(),
        doctor: doctorData,
      },
    });
  } catch (error) {
    console.error("Error editing comment:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Delete comment (Doctor only - owner or blog owner)
 */
const deleteComment = async (req, res) => {
  try {
    const { commentId } = req.params;
    const doctorId = req.user.doctorId;

    const comment = await Comment.findById(commentId);
    if (!comment) {
      return res.status(404).json({
        success: false,
        message: "Comment not found",
      });
    }

    // Check if user is comment owner or blog owner
    const blog = await Blog.findById(comment.blogId);
    const isCommentOwner = comment.doctorId.toString() === doctorId;
    const isBlogOwner = blog && blog.doctorId.toString() === doctorId;

    if (!isCommentOwner && !isBlogOwner) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized",
      });
    }

    // Soft delete
    comment.status = "deleted";
    comment.text = "[This comment has been deleted]";
    comment.deletedAt = new Date();
    await comment.save();

    // Update counters
    if (!comment.parentCommentId) {
      await Blog.findByIdAndUpdate(comment.blogId, {
        $inc: { commentCount: -1 },
      });
    } else {
      await Comment.findByIdAndUpdate(comment.parentCommentId, {
        $inc: { replyCount: -1 },
      });
    }

    res.json({
      success: true,
      message: "Comment deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting comment:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ==================== LIKE OPERATIONS ====================

/**
 * Like/unlike blog
 */
const toggleBlogLike = async (req, res) => {
  try {
    const { blogId } = req.params;
    const doctorId = req.user.doctorId;

    const blog = await Blog.findById(blogId);
    if (!blog) {
      return res.status(404).json({
        success: false,
        message: "Blog not found",
      });
    }

    // Check if already liked
    const existingLike = await Like.findOne({
      blogId,
      doctorId,
      type: "blog",
    });

    if (existingLike) {
      // Unlike
      await Like.deleteOne({ _id: existingLike._id });
      await Blog.findByIdAndUpdate(blogId, { $inc: { likesCount: -1 } });

      res.json({
        success: true,
        message: "Blog unliked",
        liked: false,
      });
    } else {
      // Like
      const like = new Like({
        blogId,
        doctorId,
        type: "blog",
      });

      await like.save();
      await Blog.findByIdAndUpdate(blogId, { $inc: { likesCount: 1 } });

      res.json({
        success: true,
        message: "Blog liked",
        liked: true,
        like,
      });
    }
  } catch (error) {
    console.error("Error toggling like:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Like/unlike comment
 */
const toggleCommentLike = async (req, res) => {
  try {
    const { commentId } = req.params;
    const doctorId = req.user.doctorId;

    const comment = await Comment.findById(commentId);
    if (!comment) {
      return res.status(404).json({
        success: false,
        message: "Comment not found",
      });
    }

    // Check if already liked
    const existingLike = await Like.findOne({
      commentId,
      doctorId,
      type: "comment",
    });

    if (existingLike) {
      // Unlike
      await Like.deleteOne({ _id: existingLike._id });
      await Comment.findByIdAndUpdate(commentId, { $inc: { likeCount: -1 } });

      res.json({
        success: true,
        message: "Comment unliked",
        liked: false,
      });
    } else {
      // Like
      const like = new Like({
        commentId,
        doctorId,
        type: "comment",
      });

      await like.save();
      await Comment.findByIdAndUpdate(commentId, { $inc: { likeCount: 1 } });

      res.json({
        success: true,
        message: "Comment liked",
        liked: true,
        like,
      });
    }
  } catch (error) {
    console.error("Error toggling comment like:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Check if doctor liked a blog
 */
const checkBlogLikeStatus = async (req, res) => {
  try {
    const { blogId } = req.params;
    const doctorId = req.user.doctorId;

    const like = await Like.findOne({
      blogId,
      doctorId,
      type: "blog",
    });

    res.json({
      success: true,
      liked: !!like,
      like,
    });
  } catch (error) {
    console.error("Error checking like status:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ==================== BLOG STATISTICS ====================

/**
 * Get blog statistics
 */
const getBlogStats = async (req, res) => {
  try {
    const { blogId } = req.params;

    const blog = await Blog.findById(blogId);
    if (!blog) {
      return res.status(404).json({
        success: false,
        message: "Blog not found",
      });
    }

    // Get like count
    const likeCount = await Like.countDocuments({ blogId, type: "blog" });

    // Get comment count
    const commentCount = await Comment.countDocuments({
      blogId,
      status: "active",
      parentCommentId: null,
    });

    // Get top commenters
    const topCommenters = await Comment.aggregate([
      { $match: { blogId, status: "active" } },
      {
        $group: {
          _id: "$doctorId",
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 5 },
    ]);

    res.json({
      success: true,
      stats: {
        likes: likeCount,
        comments: commentCount,
        views: blog.viewCount || 0,
        topCommenters,
      },
    });
  } catch (error) {
    console.error("Error getting blog stats:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ==================== EXPORTS ====================

export {
  // Blog CRUD
  createBlog,
  getAllBlogs,
  getBlogById,
  getBlogsByDoctor,
  getOtherDoctorBlogs,
  editBlog,
  deleteBlog,

  // Comments
  addComment,
  getBlogComments,
  editComment,
  deleteComment,

  // Likes
  toggleBlogLike,
  toggleCommentLike,
  checkBlogLikeStatus,

  // Stats
  getBlogStats,
};
