const clinicSubscriptionCheck = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "No token provided" });
    }

    const token = authHeader.split(" ")[1];

    // Verify with ACCESS_TOKEN_SECRET
    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

    const clinicId = decoded.clinicId;

    const clinic = await Clinic.findById(clinicId);

    if (!clinic) {
      return res.status(404).json({ message: "Clinic not found" });
    }

    req.clinic = clinic;

    // ====== Subscription Check ======
    if (!clinic.subscription || !clinic.subscription.endDate) {
      return res.status(403).json({
        message: "No active subscription found. Please subscribe."
      });
    }

    const today = new Date();
    const endDate = new Date(clinic.subscription.endDate);

    // Subscription expired
    if (endDate < today) {
      clinic.subscription.isActive = false;
      await clinic.save();

      return res.status(403).json({
        message: "Subscription expired. Please renew.",
        expiredOn: endDate,
      });
    }

    // Calculate days left
    const msDiff = endDate - today;
    const daysLeft = Math.ceil(msDiff / (1000 * 60 * 60 * 24));

    let warning = null;
    if (daysLeft <= 7) {
      warning = `Your subscription ends in ${daysLeft} day(s). Please renew soon.`;
    }

    req.subscriptionInfo = {
      status: clinic.subscription.isActive ? "active" : "expired",
      plan: clinic.subscription.package,
      endDate,
      daysLeft,
      warning,
    };

    next();

  } catch (error) {
    return res.status(401).json({
      message: "Invalid or expired token",
      error: error.message,
    });
  }
};

export default clinicSubscriptionCheck