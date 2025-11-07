import jwt from "jsonwebtoken";

export const authDoctor = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ success: false, message: "No token provided" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

    req.doctorId = decoded.doctorId; // available for downstream use\
    console.log("helloooooooo",req.doctorId);
    next();
  } catch (err) {
    console.error("authDoctor middleware error:", err);
    return res.status(401).json({ success: false, message: "Invalid or expired token" });
  }
};
