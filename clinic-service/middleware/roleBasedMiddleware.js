import jwt from "jsonwebtoken";

const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    try {
      const authHeader = req.headers.authorization;

      if (!authHeader?.startsWith("Bearer ")) {
        return res.status(401).json({
          success: false,
          message: "No authentication token provided",
        });
      }

      const token = authHeader.split(" ")[1];

      // 🔐 Verify JWT
      const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

      // ✅ Attach user data to request
      req.user = decoded;
      console.log(req.user);
      
      req.clinicId = decoded.clinicId || decoded.hospitalId; // VERY IMPORTANT

      const userRole = decoded.role;

      // 🔒 Role check
      if (!allowedRoles.includes(userRole)) {
        return res.status(403).json({
          success: false,
          message: "Access denied",
        });
      }

      next();
    } catch (err) {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired token",
      });
    }
  };
};

export default authorizeRoles;