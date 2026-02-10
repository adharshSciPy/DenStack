/**
 * Get price for user based on role and subscription status
 * 
 * PRICING RULES:
 * - D1 (Clinic Discount): Clinics with active subscription OR Clinic Doctors (isClinicDoctor: true)
 * - D2 (Doctor Discount): Clinics without subscription OR Regular Doctors
 * - Original Price: All other users
 */
export const getPriceForUser = (variant, userRole, isClinicDoctor = false, hasActiveSubscription = false) => {
  const CLINIC_ROLE = process.env.CLINIC_ROLE || "700";
  
  // ✅ RULE 1: Clinic with ACTIVE subscription → Apply D1 (Clinic Discount)
  if (userRole === CLINIC_ROLE && hasActiveSubscription === true) {
    return {
      price: variant.clinicDiscountPrice || variant.originalPrice,
      discountPercentage: variant.clinicDiscountPercentage || 0,
      priceType: 'clinic',
      appliedDiscount: variant.clinicDiscountPrice ? 'Clinic Subscription Discount (D1)' : 'Original Price',
      userType: 'Clinic with Subscription'
    };
  }
  
  // ✅ RULE 2: Clinic Doctor (isClinicDoctor = true) → Apply D1 (Clinic Discount)
  if (isClinicDoctor === true) {
    return {
      price: variant.clinicDiscountPrice || variant.originalPrice,
      discountPercentage: variant.clinicDiscountPercentage || 0,
      priceType: 'clinic',
      appliedDiscount: variant.clinicDiscountPrice ? 'Clinic Doctor Discount (D1)' : 'Original Price',
      userType: 'Clinic Doctor'
    };
  }
  
  // ✅ RULE 3: Clinic WITHOUT subscription → Apply D2 (Doctor Discount)
  if (userRole === CLINIC_ROLE && hasActiveSubscription === false) {
    return {
      price: variant.doctorDiscountPrice || variant.originalPrice,
      discountPercentage: variant.doctorDiscountPercentage || 0,
      priceType: 'doctor',
      appliedDiscount: variant.doctorDiscountPrice ? 'Standard Discount (D2)' : 'Original Price',
      userType: 'Clinic without Subscription'
    };
  }
  
  // ✅ RULE 4: Regular Doctor (not clinic doctor) → Apply D2 (Doctor Discount)
  if (isClinicDoctor === false) {
    return {
      price: variant.doctorDiscountPrice || variant.originalPrice,
      discountPercentage: variant.doctorDiscountPercentage || 0,
      priceType: 'doctor',
      appliedDiscount: variant.doctorDiscountPrice ? 'Doctor Discount (D2)' : 'Original Price',
      userType: 'Regular Doctor'
    };
  }
  
  // ✅ RULE 5: All other users → Original Price (no discount)
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
export const calculateOrderTotal = (items, userRole, isClinicDoctor = false, hasActiveSubscription = false) => {
  let subtotal = 0;
  let totalDiscount = 0;
  let finalTotal = 0;

  const itemsWithPricing = items.map(item => {
    const pricing = getPriceForUser(item.variant, userRole, isClinicDoctor, hasActiveSubscription);
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
export const formatPricingInfo = (variant, userRole, isClinicDoctor = false, hasActiveSubscription = false) => {
  const pricing = getPriceForUser(variant, userRole, isClinicDoctor, hasActiveSubscription);
  
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
      applicableTo: 'Regular users without discounts'
    },
    d1_clinic: {
      price: variant.clinicDiscountPrice || variant.originalPrice,
      discount: variant.clinicDiscountPercentage || 0,
      label: 'Premium Discount (D1)',
      applicableTo: 'Clinics with active subscription OR Clinic Doctors (isClinicDoctor: true)'
    },
    d2_doctor: {
      price: variant.doctorDiscountPrice || variant.originalPrice,
      discount: variant.doctorDiscountPercentage || 0,
      label: 'Standard Discount (D2)',
      applicableTo: 'Clinics without subscription OR Regular Doctors'
    }
  };
};

/**
 * Check if user qualifies for D1 discount
 */
export const qualifiesForD1Discount = (userRole, isClinicDoctor, hasActiveSubscription) => {
  const CLINIC_ROLE = process.env.CLINIC_ROLE || "700";
  
  // Clinic with subscription OR Clinic Doctor
  return (userRole === CLINIC_ROLE && hasActiveSubscription === true) || isClinicDoctor === true;
};

/**
 * Check if user qualifies for D2 discount
 */
export const qualifiesForD2Discount = (userRole, isClinicDoctor, hasActiveSubscription) => {
  const CLINIC_ROLE = process.env.CLINIC_ROLE || "700";
  
  // Clinic without subscription OR Regular Doctor
  return (userRole === CLINIC_ROLE && hasActiveSubscription === false) || (isClinicDoctor === false && userRole !== CLINIC_ROLE);
};