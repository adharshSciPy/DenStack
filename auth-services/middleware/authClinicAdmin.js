import jwt from "jsonwebtoken";

export const authClinicAdmin = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      message: "Unauthorized: Missing token",
    });
  }

  try {
    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

    // ✅ TYPE SAFE ROLE CHECK (NO SCHEMA CHANGE)
    if (Number(decoded.role) !== Number(process.env.CLINIC_ROLE)) {
      return res.status(403).json({
        success: false,
        message: "Only Clinic Admin can manage permissions",
      });
    }

    req.user = decoded; // contains clinicId
    next();

  } catch (err) {
    console.error("❌ authClinicAdmin error:", err);
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token",
    });
  }
};