import multer from "multer";
import path from "path";
import fs from "fs";

const uploadPath = "uploads/aligner-results/";

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // ✅ create folder if not exists
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }

    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/jpg",
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Only PDF and images are allowed"), false);
  }
};

export const uploadAlignerResult = multer({
  storage,
  fileFilter,
});