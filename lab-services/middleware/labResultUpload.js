import multer from "multer";
import path from "path";
import fs from "fs";

// ✅ Ensure upload folder exists
const resultDir = path.join("uploads", "labResults");
if (!fs.existsSync(resultDir)) {
  fs.mkdirSync(resultDir, { recursive: true });
}

// ✅ Configure multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, resultDir);
  },
  filename: (req, file, cb) => {
    const uniqueName =
      Date.now() +
      "-" +
      Math.round(Math.random() * 1e9) +
      path.extname(file.originalname);
    cb(null, uniqueName);
  },
});

// ✅ Allowed MIME types for lab result files (including DICOM)
const allowedTypes = [
  "image/jpeg",
  "image/png",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/dicom",            // DICOM (CBCT)
  "application/dicom+json",
  "application/octet-stream",     // fallback for DICOM
  "image/dicom",                  // some CBCT systems send this
];

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();

  // ✅ Allow .dcm even if mimetype isn't recognized
  if (allowedTypes.includes(file.mimetype) || ext === ".dcm") {
    cb(null, true);
  } else {
    cb(new Error(`Unsupported file type: ${file.originalname}`), false);
  }
};

export const uploadLabResult = multer({
  storage,
  fileFilter,
  limits: { fileSize: 500 * 1024 * 1024 }, // up to 500MB (CBCT can be large)
});
