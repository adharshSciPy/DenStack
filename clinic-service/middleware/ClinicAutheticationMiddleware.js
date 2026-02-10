// middleware/ClinicAuthenticationMiddleware.js
import jwt from "jsonwebtoken";

const ClinicAuthenticationMiddleware = async (req, res, next) => {
  try {
    // ===== Get token =====
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ 
        success: false,
        message: "No authentication token provided" 
      });
    }

    const token = authHeader.split(" ")[1];

    // ===== Verify JWT =====
    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

    // ===== Check clinic role =====
    const CLINIC_ROLE = process.env.CLINIC_ROLE || "700";
    if (decoded.role !== CLINIC_ROLE) {
      return res.status(403).json({ 
        success: false,
        message: "Clinic authentication required" 
      });
    }

    // ===== Check clinic ID =====
    if (!decoded.clinicId) {
      return res.status(401).json({ 
        success: false,
        message: "Invalid token" 
      });
    }

    // ===== Attach to request (compatible with your controller) =====
    req.clinicId = decoded.clinicId;
    req.userId = decoded.clinicId; // For createdBy field in controllers
    
    // Optional: Add other clinic data if available in token
    if (decoded.email) req.clinicEmail = decoded.email;
    if (decoded.name) req.clinicName = decoded.name;

    next();
  } catch (error) {
    console.error("🔐 Auth Error:", error.message);
    
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({ 
        success: false,
        message: "Token expired" 
      });
    }
    
    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({ 
        success: false,
        message: "Invalid token" 
      });
    }
    
    return res.status(401).json({ 
      success: false,
      message: "Authentication failed" 
    });
  }
};

export default ClinicAuthenticationMiddleware;