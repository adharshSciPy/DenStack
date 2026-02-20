import Clinic from "../models/clinicSchema.js";

const resolveTenant = async (req, res, next) => {
  try {
    let hospital = null;

    // ── 1. From JWT (primary path — covers all your real use cases) ───────────
    if (req.user?.hospitalId) {
      hospital = await Clinic.findById(req.user.hospitalId)
        .select("_id name email googlePlaceId isActive")
        .lean();
    }

    // ── 2. Explicit header (fallback for machine clients) ─────────────────────
    if (!hospital && req.headers["x-hospital-id"]) {
      hospital = await Clinic.findById(req.headers["x-hospital-id"])
        .select("_id name email googlePlaceId isActive")
        .lean();
    }

    if (!hospital) {
      return res.status(400).json({ success: false, message: "Unable to identify clinic tenant." });
    }
    if (!hospital.isActive) {
      return res.status(403).json({ success: false, message: "This clinic account is inactive." });
    }

    req.hospital = hospital;
    next();
  } catch (err) {
    console.error("❌ resolveTenant error:", err);
    return res.status(500).json({ success: false, message: "Server error resolving tenant." });
  }
};

export default resolveTenant;