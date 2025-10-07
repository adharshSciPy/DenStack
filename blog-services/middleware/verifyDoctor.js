import jwt from "jsonwebtoken";

export const verifyDoctor = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Token missing or malformed" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

    // Ensure role is 600 (doctor)
    if (decoded.role !== "600") {
      return res.status(403).json({ message: "Access denied: doctors only" });
    }

    req.user = decoded; // Attach payload to request
    next();
  } catch (err) {
    console.error("JWT verification error:", err.message);
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};
