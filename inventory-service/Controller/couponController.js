import Coupon from "../Model/CouponSchema.js";

// ── Utility ───────────────────────────────────────────────────────────────────

function generateCode(length = 8) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  return Array.from({ length }, () =>
    chars[Math.floor(Math.random() * chars.length)]
  ).join("");
}

// ── Admin: Create Coupon ──────────────────────────────────────────────────────

export const createCoupon = async (req, res) => {
  try {
    const { code, description, discountType, discountValue, minOrderAmount, usageLimit, expiryDate, isActive } = req.body;

    const couponCode = (code || generateCode()).toUpperCase().trim();

    const existing = await Coupon.findOne({ code: couponCode });
    if (existing) {
      return res.status(409).json({ success: false, message: `Coupon code "${couponCode}" already exists` });
    }

    if (new Date(expiryDate) <= new Date()) {
      return res.status(400).json({ success: false, message: "Expiry date must be in the future" });
    }

    if (discountType === "percent" && discountValue > 100) {
      return res.status(400).json({ success: false, message: "Percentage discount cannot exceed 100%" });
    }

    const coupon = await Coupon.create({
      code: couponCode, description, discountType, discountValue,
      minOrderAmount: minOrderAmount || 0, usageLimit, expiryDate,
      isActive: isActive !== undefined ? isActive : true,
      createdBy: req.user?._id || null,
    });

    return res.status(201).json({ success: true, message: "Coupon created successfully", data: coupon });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ── Admin: Get All Coupons ────────────────────────────────────────────────────

export const getAllCoupons = async (req, res) => {
  try {
    const { status, search, page = 1, limit = 20 } = req.query;
    const filter = {};

    if (search) filter.code = { $regex: search.toUpperCase(), $options: "i" };

    if (status === "active") {
      filter.isActive = true;
      filter.expiryDate = { $gt: new Date() };
    } else if (status === "expired") {
      filter.expiryDate = { $lte: new Date() };
    } else if (status === "inactive") {
      filter.isActive = false;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [coupons, total] = await Promise.all([
      Coupon.find(filter).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)).lean({ virtuals: true }),
      Coupon.countDocuments(filter),
    ]);

    const enriched = coupons.map((c) => {
      let derivedStatus = "active";
      if (new Date() > new Date(c.expiryDate)) derivedStatus = "expired";
      else if (c.usedBy.length >= c.usageLimit) derivedStatus = "exhausted";
      else if (!c.isActive) derivedStatus = "inactive";
      return { ...c, status: derivedStatus, usageCount: c.usedBy.length };
    });

    return res.status(200).json({
      success: true, data: enriched,
      pagination: { total, page: parseInt(page), limit: parseInt(limit), totalPages: Math.ceil(total / parseInt(limit)) },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ── Admin: Get Single Coupon ──────────────────────────────────────────────────

export const getCouponById = async (req, res) => {
  try {
    const coupon = await Coupon.findById(req.params.id).lean({ virtuals: true });
    if (!coupon) return res.status(404).json({ success: false, message: "Coupon not found" });
    return res.status(200).json({ success: true, data: coupon });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ── Admin: Update Coupon ──────────────────────────────────────────────────────

export const updateCoupon = async (req, res) => {
  try {
    const { description, discountType, discountValue, minOrderAmount, usageLimit, expiryDate, isActive } = req.body;

    const coupon = await Coupon.findById(req.params.id);
    if (!coupon) return res.status(404).json({ success: false, message: "Coupon not found" });

    if (expiryDate && new Date(expiryDate) <= new Date()) {
      return res.status(400).json({ success: false, message: "Expiry date must be in the future" });
    }

    if (discountType === "percent" && discountValue !== undefined && discountValue > 100) {
      return res.status(400).json({ success: false, message: "Percentage discount cannot exceed 100%" });
    }

    if (usageLimit !== undefined && usageLimit < coupon.usedBy.length) {
      return res.status(400).json({ success: false, message: `Usage limit cannot be less than current usage count (${coupon.usedBy.length})` });
    }

    if (description  !== undefined) coupon.description    = description;
    if (discountType !== undefined) coupon.discountType   = discountType;
    if (discountValue!== undefined) coupon.discountValue  = discountValue;
    if (minOrderAmount!==undefined) coupon.minOrderAmount = minOrderAmount;
    if (usageLimit   !== undefined) coupon.usageLimit     = usageLimit;
    if (expiryDate   !== undefined) coupon.expiryDate     = expiryDate;
    if (isActive     !== undefined) coupon.isActive       = isActive;

    await coupon.save();
    return res.status(200).json({ success: true, message: "Coupon updated successfully", data: coupon });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ── Admin: Delete Coupon ──────────────────────────────────────────────────────

export const deleteCoupon = async (req, res) => {
  try {
    const coupon = await Coupon.findByIdAndDelete(req.params.id);
    if (!coupon) return res.status(404).json({ success: false, message: "Coupon not found" });
    return res.status(200).json({ success: true, message: "Coupon deleted successfully" });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ── Admin: Generate unique code ───────────────────────────────────────────────

export const generateCouponCode = async (req, res) => {
  try {
    let code;
    let attempts = 0;
    do { code = generateCode(); attempts++; }
    while ((await Coupon.exists({ code })) && attempts < 10);
    return res.status(200).json({ success: true, code });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ── Admin: Get users who used a coupon ───────────────────────────────────────

export const getCouponUsers = async (req, res) => {
  try {
    const coupon = await Coupon.findById(req.params.id).select("code usedBy usageLimit").lean();
    if (!coupon) return res.status(404).json({ success: false, message: "Coupon not found" });
    return res.status(200).json({
      success: true, code: coupon.code, usageLimit: coupon.usageLimit,
      usageCount: coupon.usedBy.length, data: coupon.usedBy,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ── Admin: Stats ──────────────────────────────────────────────────────────────

export const getCouponStats = async (req, res) => {
  try {
    const now = new Date();
    const [total, active, expired, allCoupons] = await Promise.all([
      Coupon.countDocuments(),
      Coupon.countDocuments({ isActive: true, expiryDate: { $gt: now } }),
      Coupon.countDocuments({ expiryDate: { $lte: now } }),
      Coupon.find().select("usedBy usageLimit").lean(),
    ]);
    const exhausted = allCoupons.filter((c) => c.usedBy.length >= c.usageLimit).length;
    const totalUses = allCoupons.reduce((sum, c) => sum + c.usedBy.length, 0);
    return res.status(200).json({ success: true, data: { total, active, expired, exhausted, totalUses } });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ── User: Validate Coupon (cart page — NO usage recorded) ────────────────────
// ✅ FIXED: email is NOT required for validation — only code + orderAmount needed

export const validateCoupon = async (req, res) => {
  try {
    const { code } = req.body;
    // Always parse as number — frontend sends subtotal as a JS number but
    // JSON body parsing can sometimes deliver strings
    const orderAmount = parseFloat(req.body.orderAmount) || 0;

    if (!code) {
      return res.status(400).json({ success: false, message: "Coupon code is required" });
    }

    const coupon = await Coupon.findOne({ code: code.toUpperCase().trim() });

    if (!coupon) {
      return res.status(404).json({ success: false, message: "Invalid coupon code" });
    }

    if (!coupon.isActive) {
      return res.status(400).json({ success: false, message: "This coupon is inactive" });
    }

    if (new Date() > coupon.expiryDate) {
      return res.status(400).json({ success: false, message: "This coupon has expired" });
    }

    if (coupon.usedBy.length >= coupon.usageLimit) {
      return res.status(400).json({ success: false, message: "Coupon usage limit has been reached" });
    }

    if (coupon.minOrderAmount > 0 && orderAmount < coupon.minOrderAmount) {
      return res.status(400).json({
        success: false,
        message: `Minimum order amount of ₹${coupon.minOrderAmount} required`,
      });
    }

    // Calculate discount amount
    let discountAmount = 0;
    if (coupon.discountType === "percent") {
      discountAmount = parseFloat(((orderAmount * coupon.discountValue) / 100).toFixed(2));
    } else {
      discountAmount = coupon.discountValue;
    }

    return res.status(200).json({
      success: true,
      message: "Coupon is valid",
      data: {
        code:           coupon.code,
        discountType:   coupon.discountType,
        discountValue:  coupon.discountValue,
        discountAmount,
        description:    coupon.description,
        minOrderAmount: coupon.minOrderAmount,
        expiryDate:     coupon.expiryDate,
        usesLeft:       coupon.usageLimit - coupon.usedBy.length,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ── User: Apply Coupon (order confirm — records usage) ────────────────────────
// email + name required here because we're recording who used it

export const applyCoupon = async (req, res) => {
  try {
    const { code, email, name, orderId, userId } = req.body;
    const orderAmount = parseFloat(req.body.orderAmount) || 0;

    if (!code || !email || !name) {
      return res.status(400).json({ success: false, message: "Coupon code, email, and name are required" });
    }

    const coupon = await Coupon.findOne({ code: code.toUpperCase().trim() });

    if (!coupon) return res.status(404).json({ success: false, message: "Invalid coupon code" });
    if (!coupon.isActive) return res.status(400).json({ success: false, message: "This coupon is inactive" });
    if (new Date() > coupon.expiryDate) return res.status(400).json({ success: false, message: "This coupon has expired" });
    if (coupon.usedBy.length >= coupon.usageLimit) {
      return res.status(400).json({ success: false, message: "Coupon usage limit has been reached" });
    }

    const alreadyUsed = coupon.usedBy.find((u) => u.email.toLowerCase() === email.toLowerCase());
    if (alreadyUsed) {
      return res.status(400).json({ success: false, message: "You have already used this coupon" });
    }

    if (orderAmount !== undefined && orderAmount < coupon.minOrderAmount) {
      return res.status(400).json({
        success: false,
        message: `Minimum order amount of ₹${coupon.minOrderAmount} required`,
      });
    }

    // Record usage
    coupon.usedBy.push({
      userId:  userId  || null,
      name,
      email:   email.toLowerCase(),
      usedAt:  new Date(),
      orderId: orderId || null,
    });
    await coupon.save();

    // Calculate discount
    let discountAmount = 0;
    if (coupon.discountType === "percent") {
      discountAmount = parseFloat(((orderAmount * coupon.discountValue) / 100).toFixed(2));
    } else {
      discountAmount = coupon.discountValue;
    }

    return res.status(200).json({
      success: true,
      message: "Coupon applied successfully",
      data: {
        code:          coupon.code,
        discountType:  coupon.discountType,
        discountValue: coupon.discountValue,
        discountAmount,
        description:   coupon.description,
        usesLeft:      coupon.usageLimit - coupon.usedBy.length,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};