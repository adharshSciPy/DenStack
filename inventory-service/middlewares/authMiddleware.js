// ============================================
// middlewares/authMiddleware.js
// ============================================

import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

// ✅ YOUR EXISTING MIDDLEWARE (Keep as is)
export const verifyAuthToken = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ message: "Access token missing or invalid" });
    }

    const token = authHeader.split(" ")[1];

    try {
        const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
        req.user = decoded; // Sets role, isClinicDoctor, etc.
        next();
    } catch (err) {
        return res.status(403).json({ message: "Invalid or expired token" });
    }
};

// ✅ YOUR EXISTING MIDDLEWARE (Keep for future use, but not using now)
export const authorizeRoles = (...roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ message: "Only authorized roles can perform this action" });
        }
        next();
    };
};

// ✅ NEW: Optional authentication (for product listing with personalized pricing)
export const optionalAuth = (req, res, next) => {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        req.user = null; // No user logged in
        return next();
    }

    const token = authHeader.split(" ")[1];

    try {
        const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
        req.user = decoded; // User is logged in
        next();
    } catch (err) {
        req.user = null; // Invalid token, treat as not logged in
        next();
    }
};

// ✅ NEW: Check if user can place orders (clinic or clinic-doctor)
export const canPlaceOrder = (req, res, next) => {
    const CLINIC_ROLE = process.env.CLINIC_ROLE || "700";
    
    if (!req.user) {
        return res.status(401).json({
            success: false,
            message: 'Authentication required'
        });
    }

    // Allow if: user is a clinic (role 700) OR user is a clinic-doctor (isClinicDoctor = true)
    if (req.user.role === CLINIC_ROLE || req.user.isClinicDoctor === true) {
        return next();
    }

    return res.status(403).json({
        success: false,
        message: 'Only clinics and clinic staff can place orders'
    });
};