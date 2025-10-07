// middleware/upload.js
import multer from "multer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Get __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Absolute path to uploads/blogImages (relative to project root)
const uploadDir = path.join(__dirname, "../uploads/blogImages");
// Function to ensure folder exists
const ensureUploadFolder = () => {
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
};

// Call once at startup
ensureUploadFolder();

// Multer storage config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Ensure folder exists
    ensureUploadFolder();
    cb(null, uploadDir); // Use the absolute path
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, filename);
  },
});

// Optional: file type validation
const fileFilter = (req, file, cb) => {
  const allowed = ["image/jpeg", "image/png", "image/jpg", "image/webp"];
  if (allowed.includes(file.mimetype)) cb(null, true);
  else cb(new Error("Invalid file type. Only images allowed."), false);
};

// Export multer instance
const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024, files: 5 },
});
export { upload };