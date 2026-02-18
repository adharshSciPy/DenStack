import jwt from "jsonwebtoken";

export const verifyAuthToken = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "No token provided" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    console.log("🔴 DECODED TOKEN:", decoded);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};

export const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (
      !req.user ||
      !roles.map(String).includes(String(req.user.role))
    ) {
      return res.status(403).json({
        message: "Forbidden: You do not have permission",
      });
    }
    next();
  };
};