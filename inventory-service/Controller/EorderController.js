import EcomOrder from "../Model/E-orderSchema.js";
import Product from "../Model/ProductSchema.js";
import mongoose from "mongoose";
import axios from "axios";
import Coupon from "../Model/CouponSchema.js";
import {
  getPriceForUser,
  calculateOrderTotal,
  qualifiesForD1Discount,
  qualifiesForD2Discount,
} from "../utils/pricingHelper.js";
import ShippingSettings from "../Model/ShippingSettingSchema.js";

const AUTH_BASE = process.env.AUTH_SERVICE_BASE_URL;

const fetchClinicDetails = async (clinicId) => {
  try {
    const response = await axios.get(
      `${AUTH_BASE}/clinic/view-clinic/${clinicId}`,
    );

    const clinicData = response.data.data;

    if (!clinicData) {
      throw new Error("Clinic data not found in response");
    }

    console.log("📋 Clinic Data Retrieved:");
    console.log(`   - Name: ${clinicData.name}`);
    console.log(`   - Email: ${clinicData.email}`);
    console.log(`   - Is Active: ${clinicData.isActive}`);
    console.log(`   - Role: ${clinicData.role}`);
    console.log(`   - Subscription: ${JSON.stringify(clinicData.subscription)}`);

    return {
      name: clinicData.name,
      email: clinicData.email,
      phone: clinicData.phoneNumber,
      address: clinicData.address
        ? `${clinicData.address.street || ""}, ${clinicData.address.city || ""}, ${clinicData.address.state || ""}, ${clinicData.address.zip || ""}`.replace(
            /^,\s*|,\s*$/g,
            "",
          )
        : "",
      subscription: clinicData.subscription,
      role: clinicData.role,
      isActive: clinicData.isActive,
      type: clinicData.type,
    };
  } catch (error) {
    console.error(
      "❌ Error fetching clinic details:",
      error.response?.data || error.message,
    );
    throw new Error("Failed to fetch clinic details");
  }
};

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

    if (
      userData.isClinicDoctor &&
      userData.clinicOnboardingDetails &&
      userData.clinicOnboardingDetails.length > 0
    ) {
      const activeClinic = userData.clinicOnboardingDetails.find(
        (detail) => detail.status === "active" && detail.clinicId,
      );

      if (activeClinic) {
        associatedClinicId = activeClinic.clinicId._id || activeClinic.clinicId;

        try {
          const clinicResponse = await axios.get(
            `${AUTH_BASE}/clinic/view-clinic/${associatedClinicId}`,
          );
          const clinicData = clinicResponse.data;

          if (clinicData.subscription) {
            const subscriptionEndDate = new Date(clinicData.subscription.endDate);
            const now = new Date();
            hasActiveSubscription =
              clinicData.subscription.isActive && subscriptionEndDate > now;
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
      associatedClinicId: associatedClinicId,
      doctorDetails: {
        name: userData.name,
        email: userData.email,
        phoneNumber: userData.phoneNumber,
        specialization: userData.specialization,
        status: userData.status,
      },
    };
  } catch (error) {
    console.error("Error fetching user role:", error.message);
    return {
      role: "600",
      isClinicDoctor: false,
      hasActiveSubscription: false,
      associatedClinicId: null,
      doctorDetails: null,
    };
  }
};

export const updateShippingCharge = async (req, res) => {
  try {
    const { shippingCharge } = req.body;

    let settings = await ShippingSettings.findOne();

    if (!settings) {
      settings = new ShippingSettings({
        shippingCharge,
        updatedBy: req.user.id,
      });
    } else {
      settings.shippingCharge = shippingCharge;
      settings.updatedBy = req.user.id;
    }

    await settings.save();

    res.json({
      success: true,
      message: "Shipping charge updated",
      data: settings,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to update shipping charge",
      error: error.message,
    });
  }
};

// ============= CREATE ECOM ORDER =============
export const createEcomOrder = async (req, res) => {
  try {
    const {
      clinicId,
      userId,
      items,
      shippingAddress,
      paymentMethod,
      orderNotes,
      couponCode,
      buyerName,   // ✅ from billing form
      buyerEmail,  // ✅ from billing form
    } = req.body;

    const resolvedUserId = userId || req.user?.id || req.user?._id || null;
    const resolvedClinicId = clinicId || null;

    if (!resolvedClinicId && !resolvedUserId) {
      return res.status(400).json({
        success: false,
        message: "Either clinicId or userId is required",
      });
    }

    if (!items || !items.length || !shippingAddress || !paymentMethod) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: items, shippingAddress, paymentMethod",
      });
    }

    const sanitizedItems = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item.productId) {
        return res.status(400).json({
          success: false,
          message: `Item at index ${i}: productId is required`,
        });
      }
      const quantity = parseInt(item.quantity);
      if (isNaN(quantity) || quantity < 1) {
        return res.status(400).json({
          success: false,
          message: `Item at index ${i}: quantity must be a valid number greater than 0 (received: ${item.quantity})`,
        });
      }
      sanitizedItems.push({
        productId: item.productId,
        variantId: item.variantId || null,
        quantity,
      });
    }

    let clinicDetails = null;
    let userRole = "600";
    let isClinicDoctor = false;
    let hasActiveSubscription = false;
    let buyerType = null;
    let actualClinicId = null;
    let actualUserId = null;

    // ============= OPTION 1: Clinic =============
    if (resolvedClinicId) {
      try {
        clinicDetails = await fetchClinicDetails(resolvedClinicId);
        if (!clinicDetails.isActive) {
          return res.status(400).json({
            success: false,
            message: "Clinic is inactive and cannot place orders",
          });
        }
        actualClinicId = resolvedClinicId;
        buyerType = "clinic";
        userRole = clinicDetails.role || "700";
        if (clinicDetails.subscription) {
          const subscriptionEndDate = new Date(clinicDetails.subscription.endDate);
          hasActiveSubscription =
            clinicDetails.subscription.isActive && subscriptionEndDate > new Date();
        }
        console.log(
          `\n💰 CLINIC: ${clinicDetails.name} | Role: ${userRole} | Subscription: ${hasActiveSubscription}`,
        );
      } catch (error) {
        return res.status(404).json({
          success: false,
          message: "Clinic not found or unable to fetch clinic details",
        });
      }
    }

    // ============= OPTION 2: User or Doctor =============
    else if (resolvedUserId) {
      const tokenRole = req.user?.role;
      const CLINIC_ROLE = process.env.CLINIC_ROLE || "700";
      const DOCTOR_ROLES = [process.env.DOCTOR_ROLE, "800"].filter(Boolean);

      if (tokenRole !== CLINIC_ROLE && !DOCTOR_ROLES.includes(tokenRole)) {
        actualUserId = resolvedUserId;
        buyerType = "user";
        userRole = tokenRole || "600";
        isClinicDoctor = false;
        hasActiveSubscription = false;
        // ✅ Store billing form name/email so coupon usage shows real user info
        clinicDetails = {
          name:    buyerName  || req.user?.name  || "User",
          email:   buyerEmail || req.user?.email || "",
          phone:   "",
          address: "",
        };
        console.log(
          `\n💰 REGULAR USER: ${resolvedUserId} | Role: ${userRole} | Name: ${clinicDetails.name}`,
        );
      } else {
        try {
          const roleInfo = await getUserRoleInfo(resolvedUserId);
          if (!roleInfo.doctorDetails)
            return res.status(404).json({ success: false, message: "Doctor not found" });
          if (roleInfo.doctorDetails.status !== "Active") {
            return res.status(400).json({
              success: false,
              message: `Doctor account is ${roleInfo.doctorDetails.status} and cannot place orders`,
            });
          }
          actualUserId = resolvedUserId;
          buyerType = "doctor";
          userRole = roleInfo.role;
          isClinicDoctor = roleInfo.isClinicDoctor;
          hasActiveSubscription = roleInfo.hasActiveSubscription;
          actualClinicId = roleInfo.associatedClinicId;
          clinicDetails = {
            name: roleInfo.doctorDetails.name,
            email: roleInfo.doctorDetails.email,
            phone: roleInfo.doctorDetails.phoneNumber,
            address: "",
          };
          console.log(
            `\n💰 DOCTOR: ${roleInfo.doctorDetails.name} | ClinicDoctor: ${isClinicDoctor} | Subscription: ${hasActiveSubscription}`,
          );
        } catch (error) {
          console.warn("Error fetching doctor role:", error.message);
          return res.status(404).json({
            success: false,
            message: "Doctor not found or unable to fetch details",
          });
        }
      }
    }

    // ============= Build cart items + deduct stock =============
    let orderItems = [];
    let cartItems = [];

    for (const item of sanitizedItems) {
      const product = await Product.findById(item.productId);
      if (!product) {
        return res.status(404).json({
          success: false,
          message: `Product not found: ${item.productId}`,
        });
      }

      if (!item.variantId) {
        if (!product.originalPrice) {
          return res.status(400).json({
            success: false,
            message: `Product ${product.name} has no pricing configured`,
          });
        }
        const currentStock = product.stock || 0;
        if (currentStock < item.quantity) {
          return res.status(400).json({
            success: false,
            message: `Insufficient stock for ${product.name}. Available: ${currentStock}, Requested: ${item.quantity}`,
          });
        }
        const updatedProduct = await Product.findByIdAndUpdate(
          item.productId,
          { $inc: { stock: -item.quantity } },
          { new: true, runValidators: true },
        );
        if (!updatedProduct)
          return res.status(500).json({
            success: false,
            message: `Failed to update stock for ${product.name}`,
          });
        if (updatedProduct.stock < 0) {
          await Product.findByIdAndUpdate(item.productId, {
            $inc: { stock: item.quantity },
          });
          return res.status(400).json({
            success: false,
            message: `Insufficient stock for ${product.name}. Please try again.`,
          });
        }
        cartItems.push({
          variant: {
            originalPrice: product.originalPrice,
            clinicDiscountPrice: product.clinicDiscountPrice,
            doctorDiscountPrice: product.doctorDiscountPrice,
            clinicDiscountPercentage: product.clinicDiscountPercentage,
            doctorDiscountPercentage: product.doctorDiscountPercentage,
            stock: currentStock,
            _id: null,
            size: null,
            color: null,
            material: null,
          },
          quantity: item.quantity,
          product,
        });
      } else {
        const variant = product.variants.id(item.variantId);
        if (!variant)
          return res.status(404).json({
            success: false,
            message: `Variant not found for product: ${product.name}`,
          });
        const variantStock = variant.stock || 0;
        if (variantStock < item.quantity) {
          return res.status(400).json({
            success: false,
            message: `Insufficient stock for ${product.name}. Available: ${variantStock}, Requested: ${item.quantity}`,
          });
        }
        const updatedProduct = await Product.findOneAndUpdate(
          { _id: item.productId, "variants._id": item.variantId },
          { $inc: { "variants.$.stock": -item.quantity } },
          { new: true, runValidators: true },
        );
        if (!updatedProduct)
          return res.status(500).json({
            success: false,
            message: `Failed to update variant stock for ${product.name}`,
          });
        const updatedVariant = updatedProduct.variants.id(item.variantId);
        if (updatedVariant.stock < 0) {
          await Product.findOneAndUpdate(
            { _id: item.productId, "variants._id": item.variantId },
            { $inc: { "variants.$.stock": item.quantity } },
          );
          return res.status(400).json({
            success: false,
            message: `Insufficient stock for ${product.name}. Please try again.`,
          });
        }
        cartItems.push({
          variant: updatedVariant,
          quantity: item.quantity,
          product,
        });
      }
    }

    // ============= Calculate role-based pricing =============
    const orderTotals = calculateOrderTotal(
      cartItems,
      userRole,
      isClinicDoctor,
      hasActiveSubscription,
    );

    console.log(
      `\n💵 ROLE PRICING: Subtotal ₹${orderTotals.subtotal} → After discount ₹${orderTotals.finalTotal} (saved ₹${orderTotals.totalDiscount})`,
    );

    for (let i = 0; i < cartItems.length; i++) {
      const item = cartItems[i];
      const pricedItem = orderTotals.items[i];
      orderItems.push({
        product: new mongoose.Types.ObjectId(item.product._id),
        productName: item.product.name,
        variant: {
          variantId: item.variant._id || null,
          size: item.variant.size,
          color: item.variant.color,
          material: item.variant.material,
        },
        quantity: item.quantity,
        price: pricedItem.unitPrice,
        originalPrice: pricedItem.originalUnitPrice,
        totalCost: pricedItem.itemTotal,
        discount: pricedItem.itemDiscount,
        priceType: pricedItem.priceType,
        appliedDiscount: pricedItem.appliedDiscount,
        image: item.product.image[0] || null,
      });
    }

    const subtotal = orderTotals.finalTotal;

    // ============= Validate coupon (NO usage recording here) =============
    let couponDiscountAmount = 0;
    let appliedCoupon = null;

    if (couponCode) {
      try {
        const coupon = await Coupon.findOne({
          code: couponCode.toUpperCase().trim(),
          isActive: true,
          expiryDate: { $gte: new Date() },
        });

        if (coupon && subtotal >= (coupon.minOrderAmount || 0)) {
          if (coupon.discountType === "percent") {
            couponDiscountAmount = parseFloat(
              ((subtotal * coupon.discountValue) / 100).toFixed(2),
            );
            if (coupon.maxDiscount && couponDiscountAmount > coupon.maxDiscount) {
              couponDiscountAmount = coupon.maxDiscount;
            }
          } else {
            couponDiscountAmount = Math.min(coupon.discountValue, subtotal);
          }

          appliedCoupon = {
            code: coupon.code,
            discountType: coupon.discountType,
            discountValue: coupon.discountValue,
            discountAmount: couponDiscountAmount,
          };

          console.log(`\n🎟️  COUPON: ${coupon.code} | Discount: ₹${couponDiscountAmount} | Usage will be recorded after payment`);
        } else {
          console.log(
            `\n⚠️  Coupon "${couponCode}" skipped — invalid, expired, or below min order amount`,
          );
        }
      } catch (err) {
        console.warn("Coupon lookup error (order not blocked):", err.message);
      }
    }

    // ============= Final totals =============
    const discountedSubtotal = parseFloat(
      (subtotal - couponDiscountAmount).toFixed(2),
    );

    const shippingSettings = await ShippingSettings.findOne();
    const shippingCharge = shippingSettings?.shippingCharge || 0;

    const tax = 0;

    const totalAmount = parseFloat(
      (discountedSubtotal + shippingCharge).toFixed(2),
    );

    console.log(`\n📦 ORDER TOTAL:`);
    console.log(`   - After role discount:  ₹${subtotal}`);
    console.log(`   - Coupon discount:      ₹${couponDiscountAmount}`);
    console.log(`   - After coupon:         ₹${discountedSubtotal}`);
    console.log(`   - Shipping:             ₹${shippingCharge}`);
    console.log(`   - Final Total:          ₹${totalAmount}`);

    const newOrder = new EcomOrder({
      clinic: actualClinicId,
      user: actualUserId,
      buyerType,
      clinicDetails,
      items: orderItems,
      shippingAddress,
      paymentDetails: { method: paymentMethod, status: "PENDING" },
      subtotal: orderTotals.subtotal,
      shippingCharge,
      tax,
      discount: orderTotals.totalDiscount,
      couponDiscount: couponDiscountAmount,
      couponCode: appliedCoupon?.code || null,
      totalAmount,
      orderNotes: orderNotes || "",
      estimatedDelivery: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      userRole,
      isClinicDoctor,
      hasActiveSubscription,
      discountPercentage: orderTotals.discountPercentage,
    });

    await newOrder.save();

    res.status(201).json({
      success: true,
      message: "Order created successfully",
      data: newOrder,
      pricingInfo: {
        buyerType,
        role: userRole,
        isClinicDoctor,
        hasActiveSubscription,
        qualifiesForD1: qualifiesForD1Discount(userRole, isClinicDoctor, hasActiveSubscription),
        qualifiesForD2: qualifiesForD2Discount(userRole, isClinicDoctor, hasActiveSubscription),
        discountApplied: orderTotals.discountPercentage > 0,
        discountType: qualifiesForD1Discount(userRole, isClinicDoctor, hasActiveSubscription)
          ? "D1"
          : "D2",
      },
      pricing: {
        originalSubtotal: orderTotals.subtotal,
        totalDiscount: orderTotals.totalDiscount,
        discountPercentage: orderTotals.discountPercentage,
        discountedSubtotal: subtotal,
        couponCode: appliedCoupon?.code || null,
        couponDiscount: couponDiscountAmount,
        shippingCharge,
        finalTotal: totalAmount,
      },
    });
  } catch (error) {
    console.error("Create Ecom Order Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create order",
      error: error.message,
    });
  }
};

// ============= GET ALL ECOM ORDERS =============
export const getAllEcomOrders = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      paymentStatus,
      clinicId,
      startDate,
      endDate,
    } = req.query;

    let filter = {};
    if (status) filter.orderStatus = status;
    if (paymentStatus) filter["paymentDetails.status"] = paymentStatus;
    if (clinicId) filter.clinic = clinicId;

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const orders = await EcomOrder.find(filter)
      .populate("items.product", "name image")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await EcomOrder.countDocuments(filter);

    res.status(200).json({
      success: true,
      message: "Orders retrieved successfully",
      data: orders,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalOrders: total,
        limit: parseInt(limit),
      },
    });
  } catch (error) {
    console.error("Get All Ecom Orders Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch orders",
      error: error.message,
    });
  }
};

// ============= GET ECOM ORDER BY ID =============
export const getEcomOrderById = async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await EcomOrder.findById(orderId).populate(
      "items.product",
      "name description image brand mainCategory subCategory",
    );

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    res.status(200).json({
      success: true,
      message: "Order retrieved successfully",
      data: order,
    });
  } catch (error) {
    console.error("Get Ecom Order Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch order",
      error: error.message,
    });
  }
};

// ============= GET CLINIC'S ECOM ORDERS =============
export const getClinicEcomOrders = async (req, res) => {
  try {
    const { clinicId } = req.params;
    const { page = 1, limit = 10, status } = req.query;

    let filter = { clinic: clinicId };
    if (status) filter.orderStatus = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const orders = await EcomOrder.find(filter)
      .populate("items.product", "name image")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await EcomOrder.countDocuments(filter);

    res.status(200).json({
      success: true,
      message: "Clinic orders retrieved successfully",
      data: orders,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalOrders: total,
      },
    });
  } catch (error) {
    console.error("Get Clinic Ecom Orders Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch clinic orders",
      error: error.message,
    });
  }
};

// ============= GET ORDER STATUS =============
export const getOrderStatus = async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await EcomOrder.findById(orderId)
      .select(
        "orderId orderStatus trackingNumber estimatedDelivery deliveredAt cancelledAt cancellationReason createdAt paymentDetails shippingAddress items clinicDetails",
      )
      .populate("items.product", "name image");

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    const statusTimeline = [
      { step: "PENDING", label: "Order Placed", done: true },
      {
        step: "CONFIRMED",
        label: "Order Confirmed",
        done: ["CONFIRMED", "PROCESSING", "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED"].includes(order.orderStatus),
      },
      {
        step: "PROCESSING",
        label: "Processing",
        done: ["PROCESSING", "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED"].includes(order.orderStatus),
      },
      {
        step: "SHIPPED",
        label: "Shipped",
        done: ["SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED"].includes(order.orderStatus),
      },
      {
        step: "OUT_FOR_DELIVERY",
        label: "Out for Delivery",
        done: ["OUT_FOR_DELIVERY", "DELIVERED"].includes(order.orderStatus),
      },
      {
        step: "DELIVERED",
        label: "Delivered",
        done: order.orderStatus === "DELIVERED",
      },
    ];

    res.status(200).json({
      success: true,
      message: "Order status retrieved successfully",
      data: {
        orderId: order.orderId,
        _id: order._id,
        currentStatus: order.orderStatus,
        trackingNumber: order.trackingNumber || null,
        estimatedDelivery: order.estimatedDelivery || null,
        deliveredAt: order.deliveredAt || null,
        cancelledAt: order.cancelledAt || null,
        cancellationReason: order.cancellationReason || null,
        placedAt: order.createdAt,
        paymentStatus: order.paymentDetails?.status,
        paymentMethod: order.paymentDetails?.method,
        shippingAddress: order.shippingAddress,
        items: order.items,
        timeline:
          order.orderStatus === "CANCELLED"
            ? [{ step: "CANCELLED", label: "Cancelled", done: true, reason: order.cancellationReason }]
            : statusTimeline,
      },
    });
  } catch (error) {
    console.error("Get Order Status Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch order status",
      error: error.message,
    });
  }
};

// ============= UPDATE ECOM ORDER STATUS =============
export const updateEcomOrderStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { orderStatus, trackingNumber } = req.body;

    const validStatuses = [
      "PENDING", "CONFIRMED", "PROCESSING", "SHIPPED",
      "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED", "RETURNED",
    ];

    if (orderStatus && !validStatuses.includes(orderStatus)) {
      return res.status(400).json({ success: false, message: "Invalid status" });
    }

    const order = await EcomOrder.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    const previousStatus = order.orderStatus;

    if (orderStatus) order.orderStatus = orderStatus;
    if (trackingNumber) order.trackingNumber = trackingNumber;

    // Inventory service call only for clinic orders
    if (
      orderStatus === "DELIVERED" &&
      previousStatus !== "DELIVERED" &&
      !order.inventoryAssigned &&
      order.clinic
    ) {
      try {
        await axios.post(
          `${process.env.CLINIC_INVENTORY_SERVICE_URL}/assign/inventory/assign`,
          {
            orderId: order._id,
            clinicId: order.clinic,
            items: order.items.map((item) => ({
              productId: item.product,
              productName: item.productName,
              quantity: item.quantity,
            })),
          },
        );
        order.inventoryAssigned = true;
      } catch (invErr) {
        console.error("❌ Inventory service failed:", invErr.response?.data || invErr.message);
      }
    }

    await order.save();

    return res.status(200).json({
      success: true,
      message: "Order updated successfully",
      data: order,
    });
  } catch (error) {
    console.error("Update Ecom Order Status Error:", error.response?.data || error.message);
    return res.status(500).json({
      success: false,
      message: "Failed to update order status",
      error: error.message,
    });
  }
};

// ============= UPDATE ECOM PAYMENT STATUS =============
export const updateEcomPaymentStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { paymentStatus, transactionId } = req.body;

    const validStatuses = ["PENDING", "PAID", "FAILED", "REFUNDED"];

    if (!validStatuses.includes(paymentStatus)) {
      return res.status(400).json({
        success: false,
        message: `Invalid payment status. Valid statuses: ${validStatuses.join(", ")}`,
      });
    }

    const updateData = { "paymentDetails.status": paymentStatus };
    if (transactionId) updateData["paymentDetails.transactionId"] = transactionId;
    if (paymentStatus === "PAID") updateData["paymentDetails.paidAt"] = new Date();

    const order = await EcomOrder.findByIdAndUpdate(orderId, updateData, {
      new: true,
      runValidators: true,
    });

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    res.status(200).json({
      success: true,
      message: "Payment status updated successfully",
      data: order,
    });
  } catch (error) {
    console.error("Update Ecom Payment Status Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update payment status",
      error: error.message,
    });
  }
};

// ============= CANCEL ECOM ORDER =============
export const cancelEcomOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { cancellationReason } = req.body;

    const order = await EcomOrder.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    if (["SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED"].includes(order.orderStatus)) {
      return res.status(400).json({
        success: false,
        message: "Cannot cancel order that is already shipped or delivered",
      });
    }

    for (const item of order.items) {
      const product = await Product.findById(item.product);
      if (product) {
        if (!item.variant.variantId) {
          product.stock += item.quantity;
          await product.save();
        } else {
          const variant = product.variants.id(item.variant.variantId);
          if (variant) {
            variant.stock += item.quantity;
            await product.save();
          }
        }
      }
    }

    order.orderStatus = "CANCELLED";
    order.cancelledAt = new Date();
    order.cancellationReason = cancellationReason || "Cancelled by user";

    await order.save();

    res.status(200).json({
      success: true,
      message: "Order cancelled successfully",
      data: order,
    });
  } catch (error) {
    console.error("Cancel Ecom Order Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to cancel order",
      error: error.message,
    });
  }
};

// ============= GET RECENT ECOM ORDERS =============
export const getRecentEcomOrders = async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    const recentOrders = await EcomOrder.find()
      .populate("items.product", "name image")
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

    res.status(200).json({
      success: true,
      message: "Recent orders retrieved successfully",
      count: recentOrders.length,
      data: recentOrders,
    });
  } catch (error) {
    console.error("Get Recent Ecom Orders Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch recent orders",
      error: error.message,
    });
  }
};

// ============= GET ECOM ORDER ANALYTICS =============
export const getEcomOrderAnalytics = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    let dateFilter = {};
    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) dateFilter.createdAt.$gte = new Date(startDate);
      if (endDate) dateFilter.createdAt.$lte = new Date(endDate);
    }

    const totalOrders = await EcomOrder.countDocuments(dateFilter);

    const revenueData = await EcomOrder.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$totalAmount" },
          averageOrderValue: { $avg: "$totalAmount" },
        },
      },
    ]);

    const ordersByStatus = await EcomOrder.aggregate([
      { $match: dateFilter },
      { $group: { _id: "$orderStatus", count: { $sum: 1 } } },
    ]);

    const ordersByPaymentStatus = await EcomOrder.aggregate([
      { $match: dateFilter },
      { $group: { _id: "$paymentDetails.status", count: { $sum: 1 } } },
    ]);

    const ordersByPaymentMethod = await EcomOrder.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: "$paymentDetails.method",
          count: { $sum: 1 },
          totalAmount: { $sum: "$totalAmount" },
        },
      },
    ]);

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const dailyTrends = await EcomOrder.aggregate([
      { $match: { createdAt: { $gte: thirtyDaysAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          orders: { $sum: 1 },
          revenue: { $sum: "$totalAmount" },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.status(200).json({
      success: true,
      message: "Order analytics retrieved successfully",
      data: {
        totalOrders,
        totalRevenue: revenueData[0]?.totalRevenue || 0,
        averageOrderValue: revenueData[0]?.averageOrderValue || 0,
        ordersByStatus,
        ordersByPaymentStatus,
        ordersByPaymentMethod,
        dailyTrends,
      },
    });
  } catch (error) {
    console.error("Get Ecom Order Analytics Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch order analytics",
      error: error.message,
    });
  }
};

// ============= UPDATE ORDER STATUS (DELIVERED / CANCELLED) =============
export const updateOrderStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status, cancellationReason } = req.body;

    if (!["DELIVERED", "CANCELLED"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Only DELIVERED or CANCELLED status allowed",
      });
    }

    const order = await EcomOrder.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    if (["DELIVERED", "CANCELLED", "RETURNED"].includes(order.orderStatus)) {
      return res.status(400).json({
        success: false,
        message: `Order already ${order.orderStatus}`,
      });
    }

    if (status === "CANCELLED") {
      if (!cancellationReason) {
        return res.status(400).json({
          success: false,
          message: "Cancellation reason is required",
        });
      }
      order.orderStatus = "CANCELLED";
      order.cancellationReason = cancellationReason;
      if (order.paymentDetails.status === "PAID") {
        order.paymentDetails.status = "REFUNDED";
      }
    }

    if (status === "DELIVERED") {
      order.orderStatus = "DELIVERED";

      // ✅ COD: mark as paid on delivery
      if (order.paymentDetails.method === "COD") {
        order.paymentDetails.status = "PAID";
        order.paymentDetails.paidAt = new Date();
      }

      // ✅ COD: record coupon usage only now that payment is confirmed
      if (order.couponCode) {
        try {
          const coupon = await Coupon.findOne({ code: order.couponCode });
          if (coupon) {
            await Coupon.findByIdAndUpdate(coupon._id, {
              $push: {
                usedBy: {
                  userId: order.user || null,
                  name: order.clinicDetails?.name || "User",
                  email: order.clinicDetails?.email || "",
                  usedAt: new Date(),
                  orderId: order.orderId, // ✅ human-readable EORD#xxxx
                },
              },
            });
            console.log(`🎟️  COD Coupon usage recorded: ${order.couponCode} → Order ${order.orderId}`);
          }
        } catch (err) {
          console.warn("Coupon usage recording failed (non-blocking):", err.message);
        }
      }
    }

    await order.save();

    return res.status(200).json({
      success: true,
      message: `Order marked as ${status}`,
      data: order,
    });
  } catch (error) {
    console.error("Update Order Status Error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// ============= GET CLINIC DELIVERED ORDERS =============
export const getDeliveredProducts = async (req, res) => {
  const { clinicId } = req.params;
  const page = parseInt(req.query.page) || 1;
  const limit = 10;

  try {
    const totalOrders = await EcomOrder.countDocuments({
      clinic: clinicId,
      orderStatus: "DELIVERED",
    });

    const orders = await EcomOrder.find({
      clinic: clinicId,
      orderStatus: "DELIVERED",
    })
      .populate("items.product", "name image")
      .skip((page - 1) * limit)
      .limit(limit)
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      message: "Delivered products retrieved successfully",
      currentPage: page,
      totalPages: Math.ceil(totalOrders / limit),
      totalOrders,
      data: orders,
    });
  } catch (error) {
    console.error("Get Delivered Products Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve delivered products",
      error: error.message,
    });
  }
};

// ============= GET USER DELIVERED ORDERS =============
export const getUserDeliveredOrders = async (req, res) => {
  const { userId } = req.params;
  const page = parseInt(req.query.page) || 1;
  const limit = 10;

  try {
    const totalOrders = await EcomOrder.countDocuments({
      user: userId,
      orderStatus: "DELIVERED",
    });

    const orders = await EcomOrder.find({
      user: userId,
      orderStatus: "DELIVERED",
    })
      .populate("items.product", "name image")
      .skip((page - 1) * limit)
      .limit(limit)
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      message: "User delivered orders retrieved successfully",
      currentPage: page,
      totalPages: Math.ceil(totalOrders / limit),
      totalOrders,
      data: orders,
    });
  } catch (error) {
    console.error("Get User Delivered Orders Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve delivered orders",
      error: error.message,
    });
  }
};
export const getUserEcomOrders = async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 50, status } = req.query;
 
    let filter = { user: userId };
    if (status) filter.orderStatus = status;
 
    const skip = (parseInt(page) - 1) * parseInt(limit);
 
    const orders = await EcomOrder.find(filter)
      .populate("items.product", "name image")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
 
    const total = await EcomOrder.countDocuments(filter);
 
    res.status(200).json({
      success: true,
      message: "User orders retrieved successfully",
      data: orders,
      currentPage: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit)),
      totalOrders: total,
    });
  } catch (error) {
    console.error("Get User Ecom Orders Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch user orders",
      error: error.message,
    });
  }
};
// ============= PRICE PREVIEW =============
export const pricePreview = async (req, res) => {
  try {
    const { items, clinicId } = req.body;

    if (!items || !items.length) {
      return res.status(400).json({ success: false, message: "items are required" });
    }

    const resolvedUserId = req.user?.id || req.user?._id || null;
    const resolvedClinicId = clinicId || null;

    let userRole = "600";
    let isClinicDoctor = false;
    let hasActiveSubscription = false;

    if (resolvedClinicId) {
      try {
        const clinicDetails = await fetchClinicDetails(resolvedClinicId);
        userRole = clinicDetails.role || "700";
        if (clinicDetails.subscription) {
          const endDate = new Date(clinicDetails.subscription.endDate);
          hasActiveSubscription =
            clinicDetails.subscription.isActive && endDate > new Date();
        }
      } catch {
        userRole = "700";
      }
    } else if (resolvedUserId) {
      const tokenRole = req.user?.role;
      const CLINIC_ROLE = process.env.CLINIC_ROLE || "700";
      const DOCTOR_ROLES = [process.env.DOCTOR_ROLE, "800"].filter(Boolean);

      if (tokenRole !== CLINIC_ROLE && !DOCTOR_ROLES.includes(tokenRole)) {
        userRole = tokenRole || "600";
      } else {
        try {
          const roleInfo = await getUserRoleInfo(resolvedUserId);
          userRole = roleInfo.role;
          isClinicDoctor = roleInfo.isClinicDoctor;
          hasActiveSubscription = roleInfo.hasActiveSubscription;
        } catch {
          userRole = tokenRole || "600";
        }
      }
    }

    const previewItems = [];

    for (const item of items) {
      if (!item.productId) continue;

      const quantity = parseInt(item.quantity) || 1;
      const product = await Product.findById(item.productId);
      if (!product) continue;

      let variantData;

      if (!item.variantId) {
        variantData = {
          originalPrice: product.originalPrice,
          clinicDiscountPrice: product.clinicDiscountPrice,
          doctorDiscountPrice: product.doctorDiscountPrice,
          clinicDiscountPercentage: product.clinicDiscountPercentage,
          doctorDiscountPercentage: product.doctorDiscountPercentage,
        };
      } else {
        const variant = product.variants.id(item.variantId);
        if (!variant) continue;
        variantData = variant;
      }

      const pricing = getPriceForUser(
        variantData,
        userRole,
        isClinicDoctor,
        hasActiveSubscription,
      );

      previewItems.push({
        productId: item.productId,
        variantId: item.variantId || null,
        productName: product.name,
        quantity,
        originalPrice: variantData.originalPrice,
        unitPrice: pricing.price,
        itemTotal: pricing.price * quantity,
        originalItemTotal: variantData.originalPrice * quantity,
        itemDiscount: (variantData.originalPrice - pricing.price) * quantity,
        discountPercentage: pricing.discountPercentage,
        appliedDiscount: pricing.appliedDiscount,
        priceType: pricing.priceType,
      });
    }

    const subtotal = previewItems.reduce((s, i) => s + i.itemTotal, 0);
    const totalDiscount = previewItems.reduce((s, i) => s + i.itemDiscount, 0);

    const shippingSettings = await ShippingSettings.findOne();
    const shipping = shippingSettings?.shippingCharge || 0;

    return res.status(200).json({
      success: true,
      message: "Price preview calculated",
      items: previewItems,
      summary: {
        subtotal,
        totalDiscount,
        discountPercentage:
          subtotal > 0
            ? ((totalDiscount / (subtotal + totalDiscount)) * 100).toFixed(2)
            : 0,
        shipping,
        total: subtotal + shipping,
      },
    });
  } catch (error) {
    console.error("Price Preview Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to calculate price preview",
      error: error.message,
    });
  }
};