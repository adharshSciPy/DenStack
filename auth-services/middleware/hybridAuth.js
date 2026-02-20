// auth-service/middleware/hybridAuth.js

import jwt from 'jsonwebtoken';
import Clinic from '../models/clinicSchema.js';
import Doctor from '../models/doctorSchema.js';

/**
 * Unified authentication middleware that works for:
 * - Clinic admins
 * - Doctors
 * - Hybrid (clinic admin + doctor)
 */
export const authenticateHybrid = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ 
        success: false, 
        message: 'Authentication required' 
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    
    // 🔥 CHECK FOR HYBRID TOKEN (contains both clinicId and doctorId)
    if (decoded.clinicId && decoded.doctorId && decoded.hybridRole) {
      // Hybrid user - fetch both records
      const clinic = await Clinic.findById(decoded.clinicId).select('-password');
      const doctor = await Doctor.findById(decoded.doctorId).select('-password');
      
      if (!clinic || !doctor) {
        return res.status(401).json({ 
          success: false, 
          message: 'Invalid hybrid user' 
        });
      }

      // Attach both to request
      req.clinic = clinic;
      req.doctor = doctor;
      req.userType = 'hybrid';
      req.clinicId = clinic._id;
      req.doctorId = doctor._id;
      req.userId = clinic._id; // For backward compatibility
      req.userRole = '700'; // Clinic role
      
      return next();
    }
    
    // Check if it's a clinic token
    if (decoded.clinicId) {
      const clinic = await Clinic.findById(decoded.clinicId).select('-password');
      if (!clinic) {
        return res.status(401).json({ 
          success: false, 
          message: 'Invalid clinic' 
        });
      }
      
      req.clinic = clinic;
      req.userType = 'clinic';
      req.clinicId = clinic._id;
      req.userId = clinic._id;
      req.userRole = clinic.role;
      
      return next();
    }
    
    // Check if it's a doctor token
    if (decoded.doctorId) {
      const doctor = await Doctor.findById(decoded.doctorId).select('-password');
      if (!doctor) {
        return res.status(401).json({ 
          success: false, 
          message: 'Invalid doctor' 
        });
      }
      
      req.doctor = doctor;
      req.userType = 'doctor';
      req.doctorId = doctor._id;
      req.userId = doctor._id;
      req.userRole = doctor.role;
      
      return next();
    }

    return res.status(401).json({ 
      success: false, 
      message: 'Invalid token format' 
    });

  } catch (error) {
    console.error('Auth error:', error);
    return res.status(401).json({ 
      success: false, 
      message: 'Authentication failed',
      error: error.message 
    });
  }
};

// Role-specific middleware (for backward compatibility)
export const requireClinic = (req, res, next) => {
  if (!req.clinic && !req.clinicId) {
    return res.status(403).json({ 
      success: false, 
      message: 'Clinic access required' 
    });
  }
  next();
};

export const requireDoctor = (req, res, next) => {
  if (!req.doctor && !req.doctorId) {
    return res.status(403).json({ 
      success: false, 
      message: 'Doctor access required' 
    });
  }
  next();
};

// For APIs that need to work with both (like appointment creation)
export const requireClinicOrDoctor = (req, res, next) => {
  if (!req.clinicId && !req.doctorId && !req.clinic && !req.doctor) {
    return res.status(403).json({ 
      success: false, 
      message: 'Authentication required' 
    });
  }
  next();
};