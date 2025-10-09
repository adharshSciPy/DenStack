import jwt from "jsonwebtoken";
import LabUser from "../models/LabUser.js";

export const verifyLabAccess = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Token missing or malformed" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

    req.user = decoded;

    if (!["101"].includes(decoded.role)) {
      return res.status(403).json({ message: "Access denied: lab users only" });
    }

    const targetLabId =
      req.params.labId ||
      req.body.labId ||
      req.query.labId ||
      null;

    if (!targetLabId) {
      return res.status(400).json({ message: "Lab ID missing in request" });
    }

    // ✅ Check if the user's lab matches the requested lab
    if (decoded.labId.toString() !== targetLabId.toString()) {
      return res.status(403).json({
        message: "Access denied: you are not a staff of this laboratory",
      });
    }

    // ✅ Optional: verify that the user still exists in DB and is active
    const labUser = await LabUser.findById(decoded.id);
    if (!labUser || labUser.labId.toString() !== targetLabId.toString()) {
      return res.status(403).json({
        message: "Access denied: you are not registered under this lab",
      });
    }

    next();
  } catch (err) {
    console.error("verifyLabAccess error:", err.message);
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};
