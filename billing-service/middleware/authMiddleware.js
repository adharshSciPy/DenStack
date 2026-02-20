import jwt from "jsonwebtoken";

/* =========================================
   VERIFY JWT TOKEN
========================================= */
export const verifyAuthToken = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Authorization token missing"
      });
    }

    const token = authHeader.split(" ")[1];

    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

    /*
      decoded should contain:
      {
        clinicId,
        role,        // 500 or 700
        email,
        id
      }
    */
    req.user = decoded;

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token"
    });
  }
};

/* =========================================
   ROLE-BASED AUTHORIZATION
========================================= */
export const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(Number(req.user.role))) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: You do not have permission"
      });
    }
    next();
  };
};

/* =========================================
   CLINIC ACCESS CHECK (IMPORTANT)
========================================= */
export const authorizeClinicAccess = (req, res, next) => {
  const { clinicId } = req.params;

  if (!req.user?.clinicId) {
    return res.status(403).json({
      success: false,
      message: "Clinic information missing in token"
    });
  }

  // Ensure clinic can only access its own data
  if (req.user.clinicId.toString() !== clinicId.toString()) {
    return res.status(403).json({
      success: false,
      message: "Unauthorized clinic access"
    });
  }

  next();
};