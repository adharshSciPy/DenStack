export const getPriceForUser = (variant, userRole, isClinicDoctor = false) => {
  const CLINIC_ROLE = process.env.CLINIC_ROLE || "700";
  const DOCTOR_ROLE = process.env.DOCTOR_ROLE || "600";
  const DOCTOR_CLINIC_ROLE = process.env.DOCTOR_CLINIC_ROLE || "456";
  
  // If user is a clinic, apply clinic discount (d1)
  if (userRole === CLINIC_ROLE) {
    return {
      price: variant.clinicDiscountPrice || variant.originalPrice,
      discountPercentage: variant.clinicDiscountPercentage || 0,
      priceType: 'clinic',
      appliedDiscount: variant.clinicDiscountPrice ? 'Clinic Discount (D1)' : 'Original Price',
      userType: 'Clinic'
    };
  }
  
  // If user is a clinic-doctor (role 456) OR a doctor onboarded in clinic OR other users
  // Apply doctor discount (d2)
  return {
    price: variant.doctorDiscountPrice || variant.originalPrice,
    discountPercentage: variant.doctorDiscountPercentage || 0,
    priceType: 'doctor',
    appliedDiscount: variant.doctorDiscountPrice ? 'Doctor/User Discount (D2)' : 'Original Price',
    userType: userRole === DOCTOR_CLINIC_ROLE || userRole === DOCTOR_ROLE || isClinicDoctor ? 'Clinic Doctor' : 'Other User'
  };
};

/**
 * Calculate total price for multiple items with role-based pricing
 * @param {Array} items - Array of cart items with product and variant info
 * @param {String} userRole - User's role
 * @param {Boolean} isClinicDoctor - Whether user is clinic doctor
 * @returns {Object} - { subtotal, totalDiscount, finalTotal, items }
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
 * @param {Object} variant - Product variant
 * @param {String} userRole - User's role
 * @param {Boolean} isClinicDoctor - Whether user is clinic doctor
 * @returns {Object} - Formatted pricing info
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
 * Validate if a price change is allowed based on role
 * @param {String} userRole - User's role
 * @returns {Boolean} - Whether user can see/modify pricing
 */
export const canManagePricing = (userRole) => {
  const ADMIN_ROLE = process.env.ADMIN_ROLE || "789";
  const INVENTORY_MANAGER_ROLE = process.env.INVENTORY_MANAGER_ROLE || "999";
  
  return [ADMIN_ROLE, INVENTORY_MANAGER_ROLE].includes(userRole);
};

/**
 * Get all available pricing tiers for a variant
 * @param {Object} variant - Product variant
 * @returns {Object} - All pricing tiers
 */
export const getAllPricingTiers = (variant) => {
  return {
    original: {
      price: variant.originalPrice,
      label: 'Original Price',
      applicableTo: 'All users (no discount)'
    },
    clinic: {
      price: variant.clinicDiscountPrice || variant.originalPrice,
      discount: variant.clinicDiscountPercentage || 0,
      label: 'Clinic Price (D1)',
      applicableTo: 'Clinics only'
    },
    doctor: {
      price: variant.doctorDiscountPrice || variant.originalPrice,
      discount: variant.doctorDiscountPercentage || 0,
      label: 'Doctor/User Price (D2)',
      applicableTo: 'Doctors onboarded in clinics and other users'
    }
  };
};