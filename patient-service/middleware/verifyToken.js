import jwt from "jsonwebtoken";

export const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      message: "Token missing or malformed",
    });
  }
  try {
      const token = authHeader.split(" ")[1];
      const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    // Attach user
    console.log("Sasa",req.user);
    
    req.user = decoded;
    
    // 🔍 DEBUG LOGS (SAFE PLACE)
    // console.log("JWT ROLE:", decoded.role);
    // console.log("ENV SUPERADMIN_ROLE:", process.env.SUPERADMIN_ROLE);
    console.log(req.user);
    
    if (Number(decoded.role) === Number(process.env.SUPERADMIN_ROLE)) { // SUPERADMIN ROLE
      req.user.isSuperAdmin = true;
      req.user.permissions = {
        all: true,
        appointments: {
          read: true,
          write: true,
        },
      };
      console.log("✅ SUPERADMIN detected → full access granted");
    }
    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token",
    });
  }
};