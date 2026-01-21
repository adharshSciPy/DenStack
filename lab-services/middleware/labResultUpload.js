import multer from "multer";
import path from "path";
import fs from "fs";

const BASE_DIR = path.join(process.cwd(), "uploads", "labResults");

if (!fs.existsSync(BASE_DIR)) {
  fs.mkdirSync(BASE_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const { labOrderId } = req.params;

    if (!labOrderId) {
      return cb(new Error("labOrderId is required"), null);
    }

    const filename = file.originalname.toLowerCase();

    let subDir = "other";

    if (filename.endsWith(".dcm")) {
      subDir = "dicom";
    } else if (filename.endsWith(".nii") || filename.endsWith(".nii.gz")) {
      subDir = "nifti";
    }

    const uploadPath = path.join(BASE_DIR, labOrderId, subDir);
    fs.mkdirSync(uploadPath, { recursive: true });

    cb(null, uploadPath);
  },

  filename: (req, file, cb) => {
    const filename = file.originalname.toLowerCase();

    // ✅ Keep original names for DICOMs
    if (filename.endsWith(".dcm")) {
      return cb(null, file.originalname);
    }

    // ✅ Safe unique names for others
    const ext = path.extname(file.originalname);
    const uniqueName = `${Date.now()}-${Math.round(
      Math.random() * 1e9
    )}${ext}`;

    cb(null, uniqueName);
  },
});

const fileFilter = (req, file, cb) => {
  const name = file.originalname.toLowerCase();

  const allowed = [
    ".pdf",
    ".png",
    ".jpg",
    ".jpeg",
    ".doc",
    ".docx",
    ".dcm",
    ".nii",
    ".nii.gz",
    ".gz",
    ".zip",
    ".stl",
    ".obj",
  ];

  if (allowed.some(ext => name.endsWith(ext))) {
    cb(null, true);
  } else {
    cb(new Error(`Unsupported file type: ${file.originalname}`), false);
  }
};

export const uploadLabResult = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 1024 * 1024 * 1024, // 1GB
  },
});
