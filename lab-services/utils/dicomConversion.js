import fs from "fs";
import path from "path";
import { DicomToNiftiConverter } from "../services/dicomToNiftiConverter.js";

function cleanOldFiles(niftiDir, labOrderId) {
  if (!fs.existsSync(niftiDir)) return;

  const files = fs
    .readdirSync(niftiDir)
    .filter((f) => f.includes(labOrderId));

  if (files.length <= 5) return;

  files
    .map((f) => ({
      f,
      mtime: fs.statSync(path.join(niftiDir, f)).mtime,
    }))
    .sort((a, b) => b.mtime - a.mtime)
    .slice(5)
    .forEach(({ f }) =>
      fs.unlinkSync(path.join(niftiDir, f))
    );
}

function checkDicomDirectory(dicomDir) {
  if (!fs.existsSync(dicomDir)) {
    return { exists: false, dicomFiles: 0 };
  }

  const files = fs.readdirSync(dicomDir);
  const dicomFiles = files.filter(
    (f) =>
      f.toLowerCase().endsWith(".dcm") ||
      f.toLowerCase().endsWith(".ima")
  );

  return {
    exists: true,
    dicomFiles: dicomFiles.length,
    totalFiles: files.length,
    sample: dicomFiles.slice(0, 5),
  };
}

export const convertDicomToNifti = async (
  dicomDir,
  niftiDir,
  labOrderId
) => {
  const converter = new DicomToNiftiConverter();

  try {
    fs.mkdirSync(niftiDir, { recursive: true });
    cleanOldFiles(niftiDir, labOrderId);

    return await converter.convertDicomSeriesToNifti(
      dicomDir,
      niftiDir,
      labOrderId
    );
  } catch (error) {
    return {
      success: false,
      error: error.message,
      isFallback: true,
    };
  }
};

export { checkDicomDirectory };
