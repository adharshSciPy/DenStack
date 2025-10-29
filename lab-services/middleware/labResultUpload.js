import multer from "multer";
import path from "path";
import fs from "fs";

const resultDir = path.join("uploads", "labResults");
if (!fs.existsSync(resultDir)) {
  fs.mkdirSync(resultDir, { recursive: true });
}

// ✅ Multer storage
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

// ✅ Allow both MIME + extension checks
const allowedMimeTypes = [
  "image/jpeg",
  "image/png",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/dicom",
  "application/dicom+json",
  "application/octet-stream",
  "image/dicom",
  "application/x-gzip",
  "application/gzip",
];

const allowedExtensions = [
  ".pdf",
  ".png",
  ".jpg",
  ".jpeg",
  ".doc",
  ".docx",
  ".dcm",
  ".stl",
  ".obj",
  ".nii",
  ".nii.gz",
  ".gz",
  ".zip",
];

// ✅ Improved fileFilter
const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();

  if (
    allowedMimeTypes.includes(file.mimetype) ||
    allowedExtensions.includes(ext)
  ) {
    cb(null, true);
  } else {
    console.warn(
      `❌ Unsupported file detected: ${file.originalname}, mimetype: ${file.mimetype}`
    );
    cb(new Error(`Unsupported file type: ${file.originalname}`), false);
  }
};

// ✅ Export multer setup
export const uploadLabResult = multer({
  storage,
  fileFilter,
  limits: { fileSize: 1024 * 1024 * 1024 }, // 1 GB
});
