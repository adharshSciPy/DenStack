import { Router } from "express";
import multer from "multer";
import { verifyDoctor } from "../middleware/verifyDoctor.js";
import {upload} from "../middleware/upload.js";
import {
  createBlog,
  getAllBlogs,
  getBlogById,
  getBlogsByDoctor,
  getOtherDoctorBlogs,
  editBlog,
  deleteBlog
} from "../controller/blogController.js";
const blogRouter=Router();
// Only doctors can do all of these:
blogRouter.route("/post-blog").post(verifyDoctor,upload.array("images", 5), createBlog);
blogRouter.route("/all-blogs").get(getAllBlogs);
blogRouter.route("/blog/:id").get(verifyDoctor, getBlogById);
blogRouter.route("/my-blogs").get(verifyDoctor, getBlogsByDoctor);
blogRouter.route("/other-blogs").get(verifyDoctor, getOtherDoctorBlogs);
blogRouter.route("/edit-blog/:id").patch(verifyDoctor,upload.array("images", 5), editBlog);
blogRouter.route("/delete-blog/:id").delete(verifyDoctor, deleteBlog);
export default blogRouter;
