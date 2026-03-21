import multer from "multer";
import path from "path";
import fs from "fs";

// 📂 Ensure folder exists
const uploadPath = "uploads/consentForms";

if (!fs.existsSync(uploadPath)) {
  fs.mkdirSync(uploadPath, { recursive: true });
}

// ==============================
// 📦 Storage Config
// ==============================
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);

    const fileName =
      Date.now() +
      "-" +
      file.originalname
        .replace(/\s+/g, "_")
        .replace(ext, "") +
      ext;

    cb(null, fileName);
  },
});

// ==============================
// 🔒 File Filter
// ==============================
const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    "application/pdf",
    "image/png",
    "image/jpeg",
    "image/jpg",
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Only PDF and images are allowed"), false);
  }
};

// ==============================
// 🚀 Multer Instance
// ==============================
export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
});