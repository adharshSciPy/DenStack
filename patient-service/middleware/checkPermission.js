export const canReadAppointments = (req, res, next) => {        //Read Permission - Appointments
  // ⭐ SUPERADMIN → FULL ACCESS
  console.log("scsd",req.user)
  if (req.user?.isSuperAdmin || req.user?.permissions?.all ||req.user?.isHybrid) {
    return next();
  }
  if (!req.user?.permissions?.appointments?.read) {
    return res.status(403).json({
      success: false,
      message: "Read access denied for appointments"
    });
  }
  next();
};

export const canWriteAppointments = (req, res, next) => {

  // ⭐ SUPER ADMIN → FULL ACCESS
  if (req.user?.isSuperAdmin || req.user?.permissions?.all ||req.user?.isHybrid) {
    return next();
  }
  if (req.user?.role === "patient") {
    return next();
  }
  // ✅ REAL PERMISSION CHECK
  if (!req.user?.permissions?.appointments?.write) {
    return res.status(403).json({
      success: false,
      message: "Write access denied for appointments",
    });
  }

  return next();
};