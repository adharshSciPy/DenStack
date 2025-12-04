import jwt from "jsonwebtoken";
import dotenv from "dotenv";


export const allowLabAccess = (req, res, next) => {
  try {
    const userRole = req.user?.role;
    console.log(userRole);
    
    if (userRole === "700" ) {
      return next();
    }
    

    return res.status(403).json({
      message: "Access denied. You are not allowed to modify lab inventory."
    });

  } catch (error) {   
    console.log("Authorization Error:", error);
    res.status(500).json({ message: "Server error", error });
  }
};


export const verifyAuthToken = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ message: "Access token missing or invalid" });
    }

    const token = authHeader.split(" ")[1];

    try {
        const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(403).json({ message: "Invalid or expired token" });
    }
};
// 🔹 Restrict access to specific roles
export const authorizeRoles = (...roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ message: "Only SuperAdmin can perform this action" });
        }
        next();
    };
};