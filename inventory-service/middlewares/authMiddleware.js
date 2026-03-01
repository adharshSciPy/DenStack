// ============================================
// middlewares/authMiddleware.js
// ============================================

import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

// ✅ UPDATED: Now handles BOTH Bearer tokens AND cookies
export const verifyAuthToken = (req, res, next) => {
    const authHeader = req.headers.authorization;
    const cookieToken = req.cookies?.accessToken;
    
    let token;
    
    // ✅ Only use header token if it's actually a real value
    if (authHeader && authHeader.startsWith("Bearer ") ) {
        const headerToken = authHeader.split(" ")[1];
        if (headerToken && headerToken !== 'null' && headerToken !== 'undefined') {
            token = headerToken;
        }
    }
    
    // Fall back to cookie
    if (!token && cookieToken) {
        token = cookieToken;
    }
    
    if (!token) {
        return res.status(401).json({ message: "Access token missing or invalid" });
    }

    try {
        const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        console.log("JWT VERIFY ERROR:", err.message);
        return res.status(403).json({ message: "Invalid or expired token" });
    }
};

// ✅ Keep this as is
export const authorizeRoles = (...roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ message: "Only authorized roles can perform this action" });
        }
        next();
    };
};

// ✅ UPDATED: Now handles BOTH Bearer tokens AND cookies
export const optionalAuth = (req, res, next) => {
    // Check Authorization header (Clinic/Doctor)
    const authHeader = req.headers.authorization;
    
    // Check cookies (Normal User)
    const cookieToken = req.cookies?.accessToken;
    
    let token;
    
    // Try to get token from either place
    if (authHeader && authHeader.startsWith("Bearer ")) {
        token = authHeader.split(" ")[1];
    } else if (cookieToken) {
        token = cookieToken;
    }
    
    // If no token found, user is not logged in (that's okay for optional auth)
    if (!token) {
        req.user = null;
        return next();
    }

    // Try to verify token
    try {
        const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
        req.user = decoded; // User is logged in
        next();
    } catch (err) {
        req.user = null; // Token is invalid, treat as not logged in
        next();
    }
};

// ✅ Keep this as is
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