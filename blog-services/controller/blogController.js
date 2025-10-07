// controllers/blogController.js
import Blog from "../model/Blob.js";
import fs from "fs";
import path from "path";

const createBlog = async (req, res) => {
  try {
    const { title, content } = req.body;

    // Collect all image URLs
    const imageUrl = req.files
      ? req.files.map((file) => `/uploads/blogImages/${file.filename}`)
      : [];
    const blog = new Blog({
      doctorId: req.user.doctorId,
      title,
      content,
      imageUrl,
    });

    await blog.save();
    res.status(201).json({ message: "Blog created successfully", blog });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getAllBlogs = async (req, res) => {
  try {
    const blogs = await Blog.find().populate("doctorId", "name email");
    res.json(blogs);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const  getBlogById = async (req, res) => {
  try {
    const blog = await Blog.findById(req.params.id).populate(
      "doctorId",
      "name email"
    );
    if (!blog) return res.status(404).json({ message: "Blog not found" });
    res.json(blog);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getBlogsByDoctor = async (req, res) => {
  try {
    console.log(req.user.doctorId);
    
    const blogs = await Blog.find({ doctorId: req.user.doctorId }).populate( "doctorId", "name email" );
    res.json(blogs);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}
const getOtherDoctorBlogs = async (req, res) => {
  try {
     const blogs = await Blog.find({ doctorId: { $ne: req.user.doctorId} })
      .sort({ createdAt: -1 }); 
       res.status(200).json({ blogs });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

const editBlog = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, content } = req.body;

    // Find the blog
    const blog = await Blog.findById(id);
    if (!blog) return res.status(404).json({ message: "Blog not found" });

    // Check ownership
    if (blog.doctorId.toString() !== req.user.doctorId) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    // Update title & content
    blog.title = title || blog.title;
    blog.content = content || blog.content;

    // Handle new uploaded images
    if (req.files && req.files.length > 0) {
      // Optional: delete old images from server
      blog.imageUrl.forEach((url) => {
        // Extract filename from URL
        const filename = url.split('/').pop();
        const filePath = path.join(process.cwd(), "uploads", "blogImages", filename);
        
        if (fs.existsSync(filePath)) {
          try {
            fs.unlinkSync(filePath);
            console.log(`🗑️ Deleted old image: ${filename}`);
          } catch (err) {
            console.error(`❌ Error deleting file: ${filename}`, err);
          }
        }
      });

      // Save new images
      const newImageUrls = req.files.map(
        (file) => `/uploads/blogImages/${file.filename}`
      );
      blog.imageUrl = newImageUrls;
    }

    await blog.save();
    res.json({ message: "Blog updated successfully", blog });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};
const deleteBlog = async (req, res) => {
  try {
    const { id } = req.params;
    const blog = await Blog.findById(id);
    if (!blog) return res.status(404).json({ message: "Blog not found" });
    if (blog.doctorId.toString() !== req.user.doctorId) {
      return res.status(403).json({ message: "Unauthorized" });
    }
    // Optional: delete images from server
    blog.imageUrl.forEach((url) => {
      const filename = url.split('/').pop();
      const filePath = path.join(process.cwd(), "uploads", "blogImages", filename);
      if (fs.existsSync(filePath))
        try {
          fs.unlinkSync(filePath);
        } catch (err) {
          console.error(`❌ Error deleting file: ${filename}`, err);
        }
    });
    await Blog.deleteOne({ _id: id });
    res.json({ message: "Blog deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}
export { createBlog, getAllBlogs, getBlogById, getBlogsByDoctor,getOtherDoctorBlogs,editBlog,deleteBlog}
