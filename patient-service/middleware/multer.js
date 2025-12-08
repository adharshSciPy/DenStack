import multer from "multer";
import fs from "fs";
import path from "path";

// Ensure upload directory exists
const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer storage setup
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

// SAFE file filter - supports ALL formats
const fileFilter = (req, file, cb) => {
  // Allowed MIME types
  const allowedTypes = [
    "image/jpeg",
    "image/png",
    "image/jpg",
    "image/webp",
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    // Pass safe error without crashing
    cb(new multer.MulterError("LIMIT_UNEXPECTED_FILE", file.fieldname));
  }
};

// Create Multer instance
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB per file
  },
});

// SAFE error wrapper so server never crashes
export const uploadFiles = (req, res, next) => {
  upload.array("files", 10)(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      // ❌ Multer error (invalid type, too big, etc.)
      return res.status(400).json({
        success: false,
        message: err.code === "LIMIT_UNEXPECTED_FILE"
          ? "Invalid file type. Allowed: jpg, jpeg, png, webp, pdf, doc, docx"
          : err.message,
      });
    } else if (err) {
      console.error("Multer error:", err);
      return res.status(500).json({
        success: false,
        message: "File upload failed",
        error: err.message,
      });
    }

    next();
  });
};
