// patient-service/middleware/verifyToken.js

import jwt from 'jsonwebtoken';

export const hybridTokenVerification = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ 
        success: false, 
        message: 'Access denied. No token provided.' 
      });
    }

    // Check if ACCESS_TOKEN_SECRET is available
    if (!process.env.ACCESS_TOKEN_SECRET) {
      console.error('❌ ACCESS_TOKEN_SECRET is not defined in environment');
      return res.status(500).json({
        success: false,
        message: 'Server configuration error'
      });
    }

    try {
      // Verify token locally
      const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
      
      console.log('✅ Token verified locally:', {
        role: decoded.role,
        hasClinicId: !!decoded.clinicId,
        hasDoctorId: !!decoded.doctorId
      });

      // Get role constants
      const HYBRID_ROLE = process.env.HYBRID_ROLE || "760";
      const CLINIC_ROLE = process.env.CLINIC_ROLE || "700";
      const DOCTOR_ROLE = process.env.DOCTOR_ROLE || "600";

      // 🔥 Set user info based on token structure
      
      // Set common fields
      req.userId = decoded._id || decoded.userId;
      req.userRole = decoded.role;
      
      // Handle hybrid user (role 760 or has both IDs)
      if (Number(decoded.role) === Number(HYBRID_ROLE) || 
          (decoded.clinicId && decoded.doctorId)) {
        req.clinicId = decoded.clinicId;
        req.doctorId = decoded.doctorId;
        req.userType = 'hybrid';
        req.isHybrid = true;
      } 
      // Handle clinic user
      else if (Number(decoded.role) === Number(CLINIC_ROLE) || decoded.clinicId) {
        req.clinicId = decoded.clinicId;
        req.userType = 'clinic';
        req.isClinic = true;
      } 
      // Handle doctor user
      else if (Number(decoded.role) === Number(DOCTOR_ROLE) || decoded.doctorId) {
        req.doctorId = decoded.doctorId;
        req.userType = 'doctor';
        req.isDoctor = true;
      }
      
      // For backward compatibility
      req.user = decoded;
      
      console.log('✅ User authenticated:', {
        userId: req.userId,
        userType: req.userType,
        clinicId: req.clinicId,
        doctorId: req.doctorId,
        role: req.userRole
      });
      
      next();
    } catch (jwtError) {
      console.error('❌ JWT verification failed:', jwtError.message);
      
      if (jwtError.name === 'TokenExpiredError') {
        return res.status(401).json({ 
          success: false, 
          message: 'Token expired' 
        });
      }
      
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid token' 
      });
    }
  } catch (error) {
    console.error('❌ Authentication error:', error);
    return res.status(401).json({ 
      success: false, 
      message: 'Authentication failed' 
    });
  }
};

// Middleware to ensure doctor ID is present
export const ensureDoctorId = (req, res, next) => {
  // Check if doctorId exists (either from hybrid or doctor token)
  if (!req.doctorId) {
    return res.status(403).json({ 
      success: false, 
      message: 'Doctor ID required for this operation' 
    });
  }
  
  next();
};

// Middleware to ensure clinic ID is present
export const ensureClinicId = (req, res, next) => {
  if (!req.clinicId) {
    return res.status(403).json({ 
      success: false, 
      message: 'Clinic ID required for this operation' 
    });
  }
  
  next();
};

// Flexible authorization middleware
export const authorize = (allowedUserTypes = []) => {
  return (req, res, next) => {
    if (!req.userType) {
      return res.status(401).json({ 
        success: false, 
        message: 'Authentication required' 
      });
    }
    
    // If no specific types required, allow all authenticated users
    if (allowedUserTypes.length === 0) {
      return next();
    }
    
    // Check if user type is allowed
    if (allowedUserTypes.includes(req.userType)) {
      return next();
    }
    
    return res.status(403).json({ 
      success: false, 
      message: `Access denied. Required user type: ${allowedUserTypes.join(' or ')}` 
    });
  };
};

// Role-based authorization
export const allowRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.userRole) {
      return res.status(401).json({ 
        success: false, 
        message: 'Authentication required' 
      });
    }
    
    if (allowedRoles.includes(req.userRole)) {
      return next();
    }
    
    return res.status(403).json({ 
      success: false, 
      message: `Access denied. Required roles: ${allowedRoles.join(', ')}` 
    });
  };
};

export default hybridTokenVerification;