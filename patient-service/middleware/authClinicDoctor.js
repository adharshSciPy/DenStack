
import jwt from "jsonwebtoken";

export const authClinicDoctor = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ success: false, message: "No token provided" });
    }

    const token = authHeader.split(" ")[1];

    // Verify token
    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

    // Attach decoded info to request
    req.doctorClinic = {
      doctorClinicId: decoded.doctorClinicId,
      doctorId: decoded.doctorId,
      clinicId: decoded.clinicId,
      roleInClinic: decoded.roleInClinic,
    };

    next();
  } catch (err) {
    console.error("authClinicDoctor middleware error:", err);
    return res.status(401).json({ success: false, message: "Invalid or expired token" });
  }
};
