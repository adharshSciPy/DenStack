import express from "express";
import jwt from "jsonwebtoken";

const router = express.Router();

/**
 * GET /api/v1/auth/check
 * Purpose: used by frontend useAuth hook
 */
router.get("/check", (req, res) => {
  const token = req.cookies?.accessToken;

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Not authenticated",
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

    return res.status(200).json({
      success: true,
      user: decoded, // optional
    });
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token",
    });
  }
});

export default router;
