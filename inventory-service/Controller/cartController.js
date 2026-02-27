import Cart from "../Model/CartSchema.js";
import Product from "../Model/ProductSchema.js";
import mongoose from "mongoose";
import { getPriceForUser } from "../utils/pricingHelper.js";
import axios from "axios";

const AUTH_BASE = process.env.AUTH_SERVICE_BASE_URL;

// ✅ Helper to get user role info (for doctors/clinic-doctors)
const getUserRoleInfo = async (userId) => {
  try {
    let response;
    try {
      response = await axios.get(`${AUTH_BASE}/user/${userId}`);
    } catch (err) {
      response = await axios.get(`${AUTH_BASE}/doctor/details/${userId}`);
    }

    const userData = response.data?.data || response.data;

    let hasActiveSubscription = false;
    let associatedClinicId = null;

    if (userData.isClinicDoctor && userData.clinicOnboardingDetails && userData.clinicOnboardingDetails.length > 0) {
      const activeClinic = userData.clinicOnboardingDetails.find(
        detail => detail.status === 'active' && detail.clinicId
      );

      if (activeClinic) {
        associatedClinicId = activeClinic.clinicId._id || activeClinic.clinicId;

        try {
          const clinicResponse = await axios.get(`${AUTH_BASE}/clinic/view-clinic/${associatedClinicId}`);
          const clinicData = clinicResponse.data.data;

          if (clinicData.subscription) {
            const subscriptionEndDate = new Date(clinicData.subscription.endDate);
            const now = new Date();
            hasActiveSubscription = clinicData.subscription.isActive && subscriptionEndDate > now;
          }
        } catch (clinicError) {
          console.warn("⚠️ Could not fetch clinic subscription:", clinicError.message);
        }
      }
    }

    return {
      role: userData.role || userData.roleId || "600",
      isClinicDoctor: userData.isClinicDoctor || false,
      hasActiveSubscription: hasActiveSubscription,
    };
  } catch (error) {
    console.error("Error fetching user role:", error.message);
    return {
      role: "600",
      isClinicDoctor: false,
      hasActiveSubscription: false,
    };
  }
};

// ✅ Helper to get clinic role info
const getClinicRoleInfo = async (clinicId) => {
  try {
    const response = await axios.get(`${AUTH_BASE}/clinic/view-clinic/${clinicId}`);
    const clinicData = response.data.data;

    let hasActiveSubscription = false;
    if (clinicData.subscription) {
      const subscriptionEndDate = new Date(clinicData.subscription.endDate);
      const now = new Date();
      hasActiveSubscription = clinicData.subscription.isActive && subscriptionEndDate > now;
    }

    return {
      role: clinicData.role || "700",
      isClinicDoctor: false,
      hasActiveSubscription: hasActiveSubscription,
    };
  } catch (error) {
    console.error("Error fetching clinic role:", error.message);
    return {
      role: "700",
      isClinicDoctor: false,
      hasActiveSubscription: false,
    };
  }
};

// ============= ADD TO CART =============
export const addToCart = async (req, res) => {
  try {
    const { productId, variantId, quantity = 1 } = req.body;

    if (!productId) {
      return res.status(400).json({ success: false, message: "productId is required" });
    }

    const parsedQuantity = parseInt(quantity);
    if (isNaN(parsedQuantity) || parsedQuantity < 1) {
      return res.status(400).json({ success: false, message: "Quantity must be a valid number greater than 0" });
    }

    if (!req.user) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }

    const { id: userId, clinicId, role, isClinicDoctor } = req.user;

    // ✅ Determine cart owner and get role info based on user type
    let userRole, hasActiveSubscription;
    let cartQuery;

    if (clinicId) {
      // Clinic user
      const roleInfo = await getClinicRoleInfo(clinicId);
      userRole = roleInfo.role;
      hasActiveSubscription = roleInfo.hasActiveSubscription;
      cartQuery = { clinic: clinicId };
    } else if (role === process.env.CLINIC_ROLE || isClinicDoctor) {
      // Doctor or clinic-doctor — fetch from auth service for subscription info
      const roleInfo = await getUserRoleInfo(userId);
      userRole = roleInfo.role;
      hasActiveSubscription = roleInfo.hasActiveSubscription;
      cartQuery = { user: userId };
    } else {
      // ✅ Regular user — skip auth service call, use JWT role directly, no discounts
      userRole = role || "600";
      hasActiveSubscription = false;
      cartQuery = { user: userId };
    }

    // Fetch product
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    let price;
    let stockAvailable;
    let variantDetails = {
      variantId: null,
      size: null,
      color: null,
      material: null,
      price: 0
    };

    // ✅ Handle products WITHOUT variants
    if (!variantId) {
      if (!product.originalPrice) {
        return res.status(400).json({ success: false, message: "Product has no pricing configured" });
      }

      const pricing = getPriceForUser(
        {
          originalPrice: product.originalPrice,
          clinicDiscountPrice: product.clinicDiscountPrice,
          doctorDiscountPrice: product.doctorDiscountPrice,
          clinicDiscountPercentage: product.clinicDiscountPercentage,
          doctorDiscountPercentage: product.doctorDiscountPercentage,
        },
        userRole,
        isClinicDoctor || false,
        hasActiveSubscription
      );

      price = pricing.price;
      stockAvailable = product.stock || 0;
      variantDetails.price = price;
    }
    // ✅ Handle products WITH variants
    else {
      const variant = product.variants.id(variantId);
      if (!variant) {
        return res.status(404).json({ success: false, message: "Variant not found" });
      }

      const pricing = getPriceForUser(
        variant,
        userRole,
        isClinicDoctor || false,
        hasActiveSubscription
      );

      price = pricing.price;
      stockAvailable = variant.stock || 0;

      variantDetails = {
        variantId: variantId,
        size: variant.size,
        color: variant.color,
        material: variant.material,
        price: price
      };
    }

    // Check stock
    if (stockAvailable < parsedQuantity) {
      return res.status(400).json({
        success: false,
        message: `Insufficient stock. Available: ${stockAvailable}`
      });
    }

    // Find or create cart
    let cart = await Cart.findOne(cartQuery);
    if (!cart) {
      cart = new Cart({
        ...(clinicId ? { clinic: clinicId } : { user: userId }),
        items: []
      });
    }

    // Check if item already exists in cart
    const existingItemIndex = cart.items.findIndex(item => {
      const isSameProduct = item.product.toString() === productId;
      if (!variantId && !item.variant.variantId) return isSameProduct;
      if (variantId && item.variant.variantId) {
        return isSameProduct && item.variant.variantId.toString() === variantId;
      }
      return false;
    });

    if (existingItemIndex > -1) {
      const newQuantity = cart.items[existingItemIndex].quantity + parsedQuantity;
      if (stockAvailable < newQuantity) {
        return res.status(400).json({
          success: false,
          message: `Cannot add more. Maximum available: ${stockAvailable}`
        });
      }
      cart.items[existingItemIndex].quantity = newQuantity;
    } else {
      cart.items.push({
        product: productId,
        variant: variantDetails,
        quantity: parsedQuantity
      });
    }

    await cart.save();
    await cart.populate('items.product', 'name image brand');

    res.status(200).json({
      success: true,
      message: "Item added to cart successfully",
      data: cart
    });
  } catch (error) {
    console.error("Add to Cart Error:", error);
    res.status(500).json({ success: false, message: "Failed to add item to cart", error: error.message });
  }
};

// ============= GET CART =============
export const getCart = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }

    const { id: userId, clinicId } = req.user;

    // ✅ Handle all user types
    const query = clinicId ? { clinic: clinicId } : { user: userId };

    const cart = await Cart.findOne(query)
      .populate({
        path: 'items.product',
        select: 'name description image brand mainCategory subCategory',
        populate: [
          { path: 'brand', select: 'name' },
          { path: 'mainCategory', select: 'categoryName' },
          { path: 'subCategory', select: 'categoryName' }
        ]
      });

    if (!cart) {
      return res.status(200).json({
        success: true,
        message: "Cart is empty",
        data: { items: [], totalItems: 0, subtotal: 0 }
      });
    }

    // Calculate totals
    let subtotal = 0;
    let totalItems = 0;

    cart.items.forEach(item => {
      subtotal += item.variant.price * item.quantity;
      totalItems += item.quantity;
    });

    res.status(200).json({
      success: true,
      message: "Cart retrieved successfully",
      data: {
        _id: cart._id,
        owner: query.clinic || query.user,
        items: cart.items,
        totalItems,
        subtotal
      }
    });
  } catch (error) {
    console.error("Get Cart Error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch cart", error: error.message });
  }
};

// ============= UPDATE CART ITEM QUANTITY =============
export const updateCartItemQuantity = async (req, res) => {
  try {
    const { itemId } = req.params;
    const { quantity } = req.body;
    const { id: userId, clinicId } = req.user;

    const parsedQuantity = parseInt(quantity);
    if (isNaN(parsedQuantity) || parsedQuantity < 1) {
      return res.status(400).json({ success: false, message: "Quantity must be at least 1" });
    }

    // ✅ Handle all user types
    const query = clinicId ? { clinic: clinicId } : { user: userId };
    const cart = await Cart.findOne(query);

    if (!cart) {
      return res.status(404).json({ success: false, message: "Cart not found" });
    }

    const item = cart.items.id(itemId);
    if (!item) {
      return res.status(404).json({ success: false, message: "Item not found in cart" });
    }

    // Check stock availability
    const product = await Product.findById(item.product);

    let stockAvailable;
    if (!item.variant.variantId) {
      stockAvailable = product.stock || 0;
    } else {
      const variant = product.variants.id(item.variant.variantId);
      if (!variant) {
        return res.status(404).json({ success: false, message: "Variant no longer available" });
      }
      stockAvailable = variant.stock || 0;
    }

    if (stockAvailable < parsedQuantity) {
      return res.status(400).json({
        success: false,
        message: `Insufficient stock. Available: ${stockAvailable}`
      });
    }

    item.quantity = parsedQuantity;
    await cart.save();
    await cart.populate('items.product', 'name image');

    res.status(200).json({ success: true, message: "Cart updated successfully", data: cart });
  } catch (error) {
    console.error("Update Cart Item Error:", error);
    res.status(500).json({ success: false, message: "Failed to update cart item", error: error.message });
  }
};

// ============= REMOVE ITEM FROM CART =============
export const removeCartItem = async (req, res) => {
  try {
    const { itemId } = req.params;
    const { id: userId, clinicId } = req.user;

    // ✅ Handle all user types
    const query = clinicId ? { clinic: clinicId } : { user: userId };
    const cart = await Cart.findOne(query);

    if (!cart) {
      return res.status(404).json({ success: false, message: "Cart not found" });
    }

    cart.items.pull(itemId);
    await cart.save();
    await cart.populate('items.product', 'name image');

    res.status(200).json({ success: true, message: "Item removed from cart successfully", data: cart });
  } catch (error) {
    console.error("Remove Cart Item Error:", error);
    res.status(500).json({ success: false, message: "Failed to remove item from cart", error: error.message });
  }
};

// ============= CLEAR CART =============
export const clearCart = async (req, res) => {
  try {
    const { id: userId, clinicId } = req.user;

    // ✅ Handle all user types
    const query = clinicId ? { clinic: clinicId } : { user: userId };
    const cart = await Cart.findOne(query);

    if (!cart) {
      return res.status(404).json({ success: false, message: "Cart not found" });
    }

    cart.items = [];
    await cart.save();

    res.status(200).json({ success: true, message: "Cart cleared successfully", data: cart });
  } catch (error) {
    console.error("Clear Cart Error:", error);
    res.status(500).json({ success: false, message: "Failed to clear cart", error: error.message });
  }
};

// ============= MOVE CART TO ORDER (Helper) =============
export const moveCartToOrder = async (clinicId) => {
  try {
    const cart = await Cart.findOne({ clinic: clinicId }).populate('items.product');

    if (!cart || cart.items.length === 0) {
      throw new Error("Cart is empty");
    }

    const orderItems = cart.items.map(item => ({
      productId: item.product._id,
      variantId: item.variant.variantId || null,
      quantity: item.quantity
    }));

    cart.items = [];
    await cart.save();

    return orderItems;
  } catch (error) {
    throw error;
  }
};

// ============= CHECKOUT CART =============
export const checkoutCart = async (req, res) => {
  try {
    const { id: userId, clinicId } = req.user;

    // ✅ Determine cart owner from JWT, not request body
    const query = clinicId ? { clinic: clinicId } : { user: userId };

    const cart = await Cart.findOne(query).populate('items.product');

    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ success: false, message: "Cart is empty" });
    }

    // Convert cart items to order format
    const orderItems = cart.items.map(item => ({
      productId: item.product._id,
      variantId: item.variant.variantId || null,
      quantity: item.quantity,
      price: item.variant.price, // ✅ price already role-based from addToCart
    }));

    // Attach to request for order controller
    req.body.items = orderItems;
    if (clinicId) req.body.clinicId = clinicId;
    else req.body.userId = userId;

    // Forward to order creation
    const { createEcomOrder } = await import('./ecom-orderController.js');
    await createEcomOrder(req, res);

    // Clear cart after successful order
    if (res.statusCode === 201) {
      cart.items = [];
      await cart.save();
    }
  } catch (error) {
    console.error("Checkout Cart Error:", error);
    res.status(500).json({ success: false, message: "Failed to checkout", error: error.message });
  }
};