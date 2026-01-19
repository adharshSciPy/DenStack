import axios from "axios";

const AUTH_SERVICE_BASE_URL = process.env.AUTH_SERVICE_BASE_URL;

export const attachPermissions = async (req, res, next) => {
  console.log(
  "🚀 PATIENT-SERVICE INTERNAL TOKEN:",
  process.env.INTERNAL_SERVICE_TOKEN
);

  try {
    console.log("Attaching permissions for user:", req.user);

    const userId = req.user?.nurseId ||req.user?.receptionId ;
    const role = req.user?.role;

    if (!userId || !role) return next();

    const response = await axios.get(
  `${process.env.AUTH_SERVICE_BASE_URL}/roles/internal/permissions`,
  {
    params: {
      staffId: userId,
      role: req.user.role,
      
    },
    
    headers: {
      "x-service-token": process.env.INTERNAL_SERVICE_TOKEN,
    },
    
  }
  
);
console.log("🚀 REQUESTING PERMISSIONS FROM AUTH SERVICE:", `${process.env.AUTH_SERVICE_BASE_URL}/roles/internal/permissions` );

    req.user.permissions = response.data.permissions || {};
    next();
  } catch (err) {
    console.error(
      "attachPermissions error:",
      err.response?.data || err.message
    );

    return res.status(403).json({
      success: false,
      message: "Unable to fetch real-time permissions",
    });
  }
};