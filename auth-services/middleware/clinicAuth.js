import jwt from "jsonwebtoken";
import Clinic from "../models/clinicSchema.js";

const clinicAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ message: "No token provided" });
    }

    const token = authHeader.split(" ")[1];

    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

    const clinic = await Clinic.findById(decoded.clinicId);

    if (!clinic) {
      return res.status(401).json({ message: "Clinic not found" });
    }

    // 🔒 MAIN CLINIC ONLY
    if (clinic.parentClinicId) {
      return res.status(403).json({
        message: "Sub-clinic not allowed to modify branches",
      });
    }

    req.clinicId = clinic._id;
    req.clinic = clinic;

    next();
  } catch (err) {
    console.error("AUTH ERROR:", err.message);
    return res.status(401).json({ message: "Invalid token" });
  }
};

export default clinicAuth