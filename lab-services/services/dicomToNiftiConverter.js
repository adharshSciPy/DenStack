import { spawn } from "child_process";
import fs from "fs";
import path from "path";

export class DicomToNiftiConverter {
  async convertDicomSeriesToNifti(dicomDir, niftiDir, labOrderId) {
    return new Promise((resolve) => {
      if (!fs.existsSync(niftiDir)) {
        fs.mkdirSync(niftiDir, { recursive: true });
      }

      const prefix = `cbct_${labOrderId}_${Date.now()}`;

      const args = [
        "-z", "y",
        "-m", "y",
        "-v", "0",                 // 🔥 IMPORTANT: disable verbose logs
        "-f", prefix,
        "-o", niftiDir,
        dicomDir
      ];

      console.log("🚀 Running: dcm2niix", args.join(" "));

      const proc = spawn("dcm2niix.exe", args);

      proc.stdout.on("data", (data) => {
        // Optional: comment this to keep logs clean
        // console.log(`📤 dcm2niix: ${data.toString()}`);
      });

      proc.stderr.on("data", (data) => {
        console.error(`📕 dcm2niix stderr: ${data.toString()}`);
      });

      proc.on("close", (code) => {
        if (code !== 0) {
          return resolve({
            success: false,
            error: `dcm2niix exited with code ${code}`,
          });
        }

        const files = fs
          .readdirSync(niftiDir)
          .filter(
            (f) =>
              f.startsWith(prefix) &&
              (f.endsWith(".nii") || f.endsWith(".nii.gz"))
          );

        if (!files.length) {
          return resolve({
            success: false,
            error: "Conversion finished but no NIfTI file found",
          });
        }

        const niftiFile = files[0];

        resolve({
          success: true,
          niftiFile,
          fileUrl: `/uploads/labResults/${labOrderId}/nifti/${niftiFile}`,
          niivueCompatible: true,
          metadata: { tool: "dcm2niix" },
        });
      });
    });
  }
}
