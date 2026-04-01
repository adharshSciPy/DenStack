import jwt from "jsonwebtoken";

export const verifyAuthToken = (req, res, next) => {
  const authHeader = req.headers.authorization;

  let token = authHeader?.startsWith("Bearer ")
    ? authHeader.split(" ")[1]
    : null;

  if (!token) {
    token = req.cookies?.accessToken;
  }

  if (!token) {
    return res.status(401).json({ message: "No token provided" });
  }

  try {
    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    console.log("JWT ERROR:", error.message);

    if (error.name === "TokenExpiredError") {
      return res.status(401).json({ message: "Token expired" });
    }

    return res.status(401).json({ message: "Invalid token" });
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