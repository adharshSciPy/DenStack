export const getPriceForUser = (variant, userRole, isClinicDoctor = false) => {
  const CLINIC_ROLE = process.env.CLINIC_ROLE || "700";
  
  // ✅ RULE 1: If user is a CLINIC (role 700) → Apply D1 (Clinic Discount)
  if (userRole === CLINIC_ROLE) {
    return {
      price: variant.clinicDiscountPrice || variant.originalPrice,
      discountPercentage: variant.clinicDiscountPercentage || 0,
      priceType: 'clinic',
      appliedDiscount: variant.clinicDiscountPrice ? 'Clinic Discount (D1)' : 'Original Price',
      userType: 'Clinic'
    };
  }
  
  // ✅ RULE 2: If user is a DOCTOR with isClinicDoctor = true → Apply D2 (Doctor Discount)
  if (isClinicDoctor === true) {
    return {
      price: variant.doctorDiscountPrice || variant.originalPrice,
      discountPercentage: variant.doctorDiscountPercentage || 0,
      priceType: 'doctor',
      appliedDiscount: variant.doctorDiscountPrice ? 'Doctor/Clinic Staff Discount (D2)' : 'Original Price',
      userType: 'Clinic Doctor'
    };
  }
  
  // ✅ RULE 3: All other users → Original Price (no discount)
  return {
    price: variant.originalPrice,
    discountPercentage: 0,
    priceType: 'original',
    appliedDiscount: 'Original Price',
    userType: 'Regular User'
  };
};

/**
 * Calculate total price for multiple items with role-based pricing
 */
export const calculateOrderTotal = (items, userRole, isClinicDoctor = false) => {
  let subtotal = 0;
  let totalDiscount = 0;
  let finalTotal = 0;

  const itemsWithPricing = items.map(item => {
    const pricing = getPriceForUser(item.variant, userRole, isClinicDoctor);
    const itemTotal = pricing.price * item.quantity;
    const itemOriginalTotal = item.variant.originalPrice * item.quantity;
    const itemDiscount = itemOriginalTotal - itemTotal;
    
    subtotal += itemOriginalTotal;
    totalDiscount += itemDiscount;
    finalTotal += itemTotal;

    return {
      ...item,
      unitPrice: pricing.price,
      originalUnitPrice: item.variant.originalPrice,
      itemTotal: itemTotal,
      itemDiscount: itemDiscount,
      priceType: pricing.priceType,
      appliedDiscount: pricing.appliedDiscount
    };
  });

  return {
    subtotal,
    totalDiscount,
    finalTotal,
    items: itemsWithPricing,
    discountPercentage: subtotal > 0 ? ((totalDiscount / subtotal) * 100).toFixed(2) : 0
  };
};

/**
 * Format pricing information for display
 */
export const formatPricingInfo = (variant, userRole, isClinicDoctor = false) => {
  const pricing = getPriceForUser(variant, userRole, isClinicDoctor);
  
  return {
    originalPrice: variant.originalPrice,
    finalPrice: pricing.price,
    discount: variant.originalPrice - pricing.price,
    discountPercentage: pricing.discountPercentage,
    savings: variant.originalPrice - pricing.price,
    priceType: pricing.priceType,
    appliedDiscount: pricing.appliedDiscount,
    userType: pricing.userType
  };
};

/**
 * Get all available pricing tiers for a variant
 */
export const getAllPricingTiers = (variant) => {
  return {
    original: {
      price: variant.originalPrice,
      label: 'Original Price',
      applicableTo: 'Regular users'
    },
    clinic: {
      price: variant.clinicDiscountPrice || variant.originalPrice,
      discount: variant.clinicDiscountPercentage || 0,
      label: 'Clinic Price (D1)',
      applicableTo: 'Clinics only (Role: 700)'
    },
    doctor: {
      price: variant.doctorDiscountPrice || variant.originalPrice,
      discount: variant.doctorDiscountPercentage || 0,
      label: 'Clinic Staff Price (D2)',
      applicableTo: 'Doctors onboarded in clinics (isClinicDoctor: true)'
    }
  };
};