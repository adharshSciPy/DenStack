import jwt from "jsonwebtoken";

// ─── Helper ───────────────────────────────────────────────────────────────────
const verifyToken = (req, res) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ success: false, message: "Unauthorized: Missing token" });
    return null;
  }

  try {
    const token = authHeader.split(" ")[1];
    return jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
  } catch (err) {
    console.error("❌ Token verification error:", err.message);
    res.status(401).json({ success: false, message: "Invalid or expired token" });
    return null;
  }
};

// ─── Receptionist only (role: 500) — can generate feedback links ──────────────
export const authReceptionist = (req, res, next) => {
  const decoded = verifyToken(req, res);
  if (!decoded) return;

  if (Number(decoded.role) !== Number(process.env.RECEPTION_ROLE)) {
    return res.status(403).json({
      success: false,
      message: "Only Receptionists can generate feedback links",
    });
  }

  req.user = decoded;
  next();
};

// ─── Clinic Admin only (role: 700) — view/resolve feedback + analytics ────────
export const authClinicAdminFeedback = (req, res, next) => {
  const decoded = verifyToken(req, res);
  if (!decoded) return;

  if (Number(decoded.role) !== Number(process.env.CLINIC_ROLE)) {
    return res.status(403).json({
      success: false,
      message: "Only Clinic Admins can access the feedback dashboard",
    });
  }

  req.user = decoded;
  next();
};

// ─── Receptionist OR Clinic Admin — shared routes (e.g. pending links) ────────
export const authFeedbackStaff = (req, res, next) => {
  const decoded = verifyToken(req, res);
  if (!decoded) return;

  const role    = Number(decoded.role);
  const allowed = [Number(process.env.RECEPTION_ROLE), Number(process.env.CLINIC_ROLE)];

  if (!allowed.includes(role)) {
    return res.status(403).json({
      success: false,
      message: "Access denied",
    });
  }

  req.user = decoded;
  next();
};
