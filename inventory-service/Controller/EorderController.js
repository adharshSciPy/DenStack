import EcomOrder from "../Model/E-orderSchema.js";
import Product from "../Model/ProductSchema.js";
import mongoose from "mongoose";
import axios from "axios";
import { getPriceForUser, calculateOrderTotal, qualifiesForD1Discount, qualifiesForD2Discount } from "../utils/pricingHelper.js";

const AUTH_BASE = process.env.AUTH_SERVICE_BASE_URL;

const fetchClinicDetails = async (clinicId) => {
  try {
    const response = await axios.get(
      `${AUTH_BASE}/clinic/view-clinic/${clinicId}`,
    );

    // ✅ Your auth service returns: { success: true, data: { clinic object } }
    const clinicData = response.data.data; // Extract from response.data.data

    if (!clinicData) {
      throw new Error("Clinic data not found in response");
    }

    console.log("📋 Clinic Data Retrieved:");
    console.log(`   - Name: ${clinicData.name}`);
    console.log(`   - Email: ${clinicData.email}`);
    console.log(`   - Is Active: ${clinicData.isActive}`);
    console.log(`   - Role: ${clinicData.role}`);
    console.log(
      `   - Subscription: ${JSON.stringify(clinicData.subscription)}`,
    );

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

// ✅ Update getUserRoleInfo to fetch complete doctor info with clinic details
const getUserRoleInfo = async (userId) => {
  try {
    let response;
    try {
      // Try as regular user first
      response = await axios.get(`${AUTH_BASE}/user/${userId}`);
    } catch (err) {
      // If not found, try as doctor
      response = await axios.get(`${AUTH_BASE}/doctor/details/${userId}`);
    }

    const userData = response.data?.data || response.data;

    // ✅ Check if doctor is associated with a clinic
    let hasActiveSubscription = false;
    let associatedClinicId = null;

    if (
      userData.isClinicDoctor &&
      userData.clinicOnboardingDetails &&
      userData.clinicOnboardingDetails.length > 0
    ) {
      // Find active clinic
      const activeClinic = userData.clinicOnboardingDetails.find(
        (detail) => detail.status === "active" && detail.clinicId,
      );

      if (activeClinic) {
        associatedClinicId = activeClinic.clinicId._id || activeClinic.clinicId;

        // ✅ Fetch the clinic details to check subscription
        try {
          const clinicResponse = await axios.get(
            `${AUTH_BASE}/clinic/view-clinic/${associatedClinicId}`,
          );
          const clinicData = clinicResponse.data;

          // Check if subscription is active and not expired
          if (clinicData.subscription) {
            const subscriptionEndDate = new Date(
              clinicData.subscription.endDate,
            );
            const now = new Date();
            hasActiveSubscription =
              clinicData.subscription.isActive && subscriptionEndDate > now;
          }
        } catch (clinicError) {
          console.warn(
            "⚠️ Could not fetch clinic subscription:",
            clinicError.message,
          );
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

export const createEcomOrder = async (req, res) => {
  try {
    const {
      clinicId,
      userId,
      items,
      shippingAddress,
      paymentMethod,
      orderNotes,
    } = req.body;

    // ✅ Validate: At least ONE of clinicId or userId must be provided
    if (!clinicId && !userId) {
      return res.status(400).json({
        success: false,
        message: "Either clinicId or userId is required",
      });
    }

    // Validate required fields
    if (!items || !items.length || !shippingAddress || !paymentMethod) {
      return res.status(400).json({
        success: false,
        message:
          "Missing required fields: items, shippingAddress, paymentMethod",
      });
    }

    // ✅ VALIDATE AND SANITIZE ITEMS ARRAY
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
        quantity: quantity,
      });
    }

    // ✅ Determine buyer and pricing
    let clinicDetails = null;
    let userRole = "600";
    let isClinicDoctor = false;
    let hasActiveSubscription = false;
    let buyerType = null;
    let actualClinicId = null;
    let actualUserId = null;

    // OPTION 1: Clinic ID provided
    if (clinicId) {
      try {
        clinicDetails = await fetchClinicDetails(clinicId);

        if (!clinicDetails.isActive) {
          return res.status(400).json({
            success: false,
            message: "Clinic is inactive and cannot place orders",
          });
        }

        actualClinicId = clinicId;
        buyerType = "clinic";
        userRole = clinicDetails.role || "700";

        // ✅ Check clinic subscription
        if (clinicDetails.subscription) {
          const subscriptionEndDate = new Date(
            clinicDetails.subscription.endDate,
          );
          const now = new Date();
          hasActiveSubscription =
            clinicDetails.subscription.isActive && subscriptionEndDate > now;
        }

        console.log("\n💰 PRICING DETERMINED FROM CLINIC:");
        console.log(`   - Clinic: ${clinicDetails.name}`);
        console.log(`   - Role: ${userRole}`);
        console.log(
          `   - Subscription Package: ${clinicDetails.subscription?.package}`,
        );
        console.log(
          `   - Subscription Active: ${clinicDetails.subscription?.isActive}`,
        );
        console.log(
          `   - Subscription Valid Until: ${clinicDetails.subscription?.endDate}`,
        );
        console.log(`   - Has Active Subscription: ${hasActiveSubscription}`);
        console.log(
          `   - Will get: ${hasActiveSubscription ? "D1 DISCOUNT (Clinic with Subscription)" : "D2 DISCOUNT (Clinic without Subscription)"}`,
        );
      } catch (error) {
        return res.status(404).json({
          success: false,
          message: "Clinic not found or unable to fetch clinic details",
        });
      }
    }

    // OPTION 2: User/Doctor ID provided
    else if (userId) {
      try {
        const roleInfo = await getUserRoleInfo(userId);

        if (!roleInfo.doctorDetails) {
          return res.status(404).json({
            success: false,
            message: "User/Doctor not found",
          });
        }

        if (roleInfo.doctorDetails.status !== "Active") {
          return res.status(400).json({
            success: false,
            message: `Doctor account is ${roleInfo.doctorDetails.status} and cannot place orders`,
          });
        }

        actualUserId = userId;
        buyerType = "doctor";
        userRole = roleInfo.role;
        isClinicDoctor = roleInfo.isClinicDoctor;
        hasActiveSubscription = roleInfo.hasActiveSubscription;
        actualClinicId = roleInfo.associatedClinicId;

        // For display purposes, create minimal clinic details
        clinicDetails = {
          name: roleInfo.doctorDetails.name,
          email: roleInfo.doctorDetails.email,
          phone: roleInfo.doctorDetails.phoneNumber,
          address: "",
        };

        console.log("\n💰 PRICING DETERMINED FROM DOCTOR:");
        console.log(`   - Doctor: ${roleInfo.doctorDetails.name}`);
        console.log(`   - Role: ${userRole}`);
        console.log(`   - Is Clinic Doctor: ${isClinicDoctor}`);
        console.log(
          `   - Has Active Clinic Subscription: ${hasActiveSubscription}`,
        );
        if (isClinicDoctor) {
          console.log(
            `   - Will get: D1 DISCOUNT (Clinic Doctor${hasActiveSubscription ? " with active subscription" : ""})`,
          );
        } else {
          console.log(`   - Will get: D2 DISCOUNT (Individual Doctor)`);
        }
      } catch (error) {
        console.warn("Error fetching user role:", error.message);
        return res.status(404).json({
          success: false,
          message: "User/Doctor not found or unable to fetch details",
        });
      }
    }

    // Process items and calculate totals with role-based pricing
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

      // Handle products WITHOUT variants
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

        // ✅ Atomic stock update
        const updatedProduct = await Product.findByIdAndUpdate(
          item.productId,
          { $inc: { stock: -item.quantity } },
          { new: true, runValidators: true },
        );

        if (!updatedProduct) {
          return res.status(500).json({
            success: false,
            message: `Failed to update stock for ${product.name}`,
          });
        }

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
          product: product,
        });
      }
      // Handle products WITH variants
      else {
        const variant = product.variants.id(item.variantId);
        if (!variant) {
          return res.status(404).json({
            success: false,
            message: `Variant not found for product: ${product.name}`,
          });
        }

        const variantStock = variant.stock || 0;

        if (variantStock < item.quantity) {
          return res.status(400).json({
            success: false,
            message: `Insufficient stock for ${product.name}. Available: ${variantStock}, Requested: ${item.quantity}`,
          });
        }

        // ✅ Atomic variant stock update
        const updatedProduct = await Product.findOneAndUpdate(
          {
            _id: item.productId,
            "variants._id": item.variantId,
          },
          {
            $inc: { "variants.$.stock": -item.quantity },
          },
          { new: true, runValidators: true },
        );

        if (!updatedProduct) {
          return res.status(500).json({
            success: false,
            message: `Failed to update variant stock for ${product.name}`,
          });
        }

        const updatedVariant = updatedProduct.variants.id(item.variantId);

        if (updatedVariant.stock < 0) {
          await Product.findOneAndUpdate(
            {
              _id: item.productId,
              "variants._id": item.variantId,
            },
            {
              $inc: { "variants.$.stock": item.quantity },
            },
          );
          return res.status(400).json({
            success: false,
            message: `Insufficient stock for ${product.name}. Please try again.`,
          });
        }

        cartItems.push({
          variant: updatedVariant,
          quantity: item.quantity,
          product: product,
        });
      }
    }

    // ✅ Calculate order total with role-based pricing
    const orderTotals = calculateOrderTotal(
      cartItems,
      userRole,
      isClinicDoctor,
      hasActiveSubscription,
    );

    console.log("\n💵 FINAL PRICING:");
    console.log(`   - Original Subtotal: ₹${orderTotals.subtotal}`);
    console.log(
      `   - Total Discount: ₹${orderTotals.totalDiscount} (${orderTotals.discountPercentage}%)`,
    );
    console.log(`   - Discounted Subtotal: ₹${orderTotals.finalTotal}`);

    // Build order items with pricing details
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

    // Calculate additional charges
    const subtotal = orderTotals.finalTotal;
    const shippingCharge = subtotal > 500 ? 0 : 50;
    const tax = parseFloat((subtotal * 0.18).toFixed(2));
    const discount = orderTotals.totalDiscount;
    const totalAmount = subtotal + shippingCharge + tax;

    // Create order
    const newOrder = new EcomOrder({
      clinic: actualClinicId,
      user: actualUserId,
      buyerType: buyerType,
      clinicDetails,
      items: orderItems,
      shippingAddress,
      paymentDetails: {
        method: paymentMethod,
        status: paymentMethod === "COD" ? "PENDING" : "PENDING",
      },
      subtotal: orderTotals.subtotal,
      shippingCharge,
      tax,
      discount,
      totalAmount,
      orderNotes: orderNotes || "",
      estimatedDelivery: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      userRole: userRole,
      isClinicDoctor: isClinicDoctor,
      hasActiveSubscription: hasActiveSubscription,
      discountPercentage: orderTotals.discountPercentage,
    });

    await newOrder.save();

    res.status(201).json({
      success: true,
      message: "Order created successfully",
      data: newOrder,
      pricingInfo: {
        buyerType: buyerType,
        role: userRole,
        isClinicDoctor: isClinicDoctor,
        hasActiveSubscription: hasActiveSubscription,
        qualifiesForD1: qualifiesForD1Discount(
          userRole,
          isClinicDoctor,
          hasActiveSubscription,
        ), // ✅ Use helper function
        qualifiesForD2: qualifiesForD2Discount(
          userRole,
          isClinicDoctor,
          hasActiveSubscription,
        ), // ✅ Add this for clarity
        discountApplied: orderTotals.discountPercentage > 0,
        discountType: qualifiesForD1Discount(
          userRole,
          isClinicDoctor,
          hasActiveSubscription,
        )
          ? "D1"
          : "D2", // ✅ Show which discount
      },
      pricing: {
        originalSubtotal: orderTotals.subtotal,
        totalDiscount: orderTotals.totalDiscount,
        discountPercentage: orderTotals.discountPercentage,
        discountedSubtotal: orderTotals.finalTotal,
        shippingCharge,
        tax,
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

    // Build filter
    let filter = {};
    if (status) filter.orderStatus = status;
    if (paymentStatus) filter["paymentDetails.status"] = paymentStatus;
    if (clinicId) filter.clinic = clinicId;

    // Date range filter
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
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
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

// ============= UPDATE ECOM ORDER STATUS =============
export const updateEcomOrderStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { orderStatus, trackingNumber } = req.body;

    const validStatuses = [
      "PENDING",
      "CONFIRMED",
      "PROCESSING",
      "SHIPPED",
      "OUT_FOR_DELIVERY",
      "DELIVERED",
      "CANCELLED",
      "RETURNED",
    ];

    if (orderStatus && !validStatuses.includes(orderStatus)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Valid statuses: ${validStatuses.join(", ")}`,
      });
    }

    const updateData = {};
    if (orderStatus) updateData.orderStatus = orderStatus;
    if (trackingNumber) updateData.trackingNumber = trackingNumber;

    const order = await EcomOrder.findByIdAndUpdate(orderId, updateData, {
      new: true,
      runValidators: true,
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Order status updated successfully",
      data: order,
    });
  } catch (error) {
    console.error("Update Ecom Order Status Error:", error);
    res.status(500).json({
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

    const updateData = {
      "paymentDetails.status": paymentStatus,
    };

    if (transactionId) {
      updateData["paymentDetails.transactionId"] = transactionId;
    }

    if (paymentStatus === "PAID") {
      updateData["paymentDetails.paidAt"] = new Date();
    }

    const order = await EcomOrder.findByIdAndUpdate(orderId, updateData, {
      new: true,
      runValidators: true,
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
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
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Only allow cancellation if order is not shipped/delivered
    if (
      ["SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED"].includes(order.orderStatus)
    ) {
      return res.status(400).json({
        success: false,
        message: "Cannot cancel order that is already shipped or delivered",
      });
    }

    // Restore stock
    for (const item of order.items) {
      const product = await Product.findById(item.product);
      if (product) {
        // ✅ Handle products without variants
        if (!item.variant.variantId) {
          product.stock += item.quantity;
          await product.save();
        }
        // ✅ Handle products with variants
        else {
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

    // Build date filter
    let dateFilter = {};
    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) dateFilter.createdAt.$gte = new Date(startDate);
      if (endDate) dateFilter.createdAt.$lte = new Date(endDate);
    }

    // Total orders and revenue
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

    // Orders by status
    const ordersByStatus = await EcomOrder.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: "$orderStatus",
          count: { $sum: 1 },
        },
      },
    ]);

    // Orders by payment status
    const ordersByPaymentStatus = await EcomOrder.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: "$paymentDetails.status",
          count: { $sum: 1 },
        },
      },
    ]);

    // Orders by payment method
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

    // Daily order trends (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const dailyTrends = await EcomOrder.aggregate([
      {
        $match: {
          createdAt: { $gte: thirtyDaysAgo },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
          },
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

export const updateOrderStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status, cancellationReason } = req.body;

    // ✅ Allow only these two
    if (!["DELIVERED", "CANCELLED"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Only DELIVERED or CANCELLED status allowed"
      });
    }

    const order = await EcomOrder.findById(orderId);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found"
      });
    }

    // 🚫 Prevent modifying final state
    if (["DELIVERED", "CANCELLED", "RETURNED"].includes(order.orderStatus)) {
      return res.status(400).json({
        success: false,
        message: `Order already ${order.orderStatus}`
      });
    }

    // ===============================
    // 🔴 If Cancelling
    // ===============================
    if (status === "CANCELLED") {

      if (!cancellationReason) {
        return res.status(400).json({
          success: false,
          message: "Cancellation reason is required"
        });
      }

      order.orderStatus = "CANCELLED";
      order.cancellationReason = cancellationReason;

      // 💰 Auto refund logic (if payment was PAID)
      if (order.paymentDetails.status === "PAID") {
        order.paymentDetails.status = "REFUNDED";
      }
    }

    // ===============================
    // 🟢 If Delivering
    // ===============================
    if (status === "DELIVERED") {
      order.orderStatus = "DELIVERED";

      // If COD and delivered → mark as PAID
      if (order.paymentDetails.method === "COD") {
        order.paymentDetails.status = "PAID";
        order.paymentDetails.paidAt = new Date();
      }
    }

    await order.save(); // triggers your pre-save hooks

    return res.status(200).json({
      success: true,
      message: `Order marked as ${status}`,
      data: order
    });

  } catch (error) {
    console.error("Update Order Status Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
};
export const getDeliveredProducts = async (req, res) => {
  const { clinicId } = req.params;

  // 👉 Get page from query (default = 1)
  const page = parseInt(req.query.page) || 1;
  const limit = 10;

  try {
    // 👉 Count total delivered orders
    const totalOrders = await EcomOrder.countDocuments({
      clinic: clinicId,
      orderStatus: "DELIVERED"
    });

    // 👉 Fetch paginated orders
    const orders = await EcomOrder.find({
      clinic: clinicId,
      orderStatus: "DELIVERED"
    })
      .populate("items.product", "name image")
      .skip((page - 1) * limit)
      .limit(limit)
      .sort({ createdAt: -1 }); // latest first

    res.status(200).json({
      success: true,
      message: "Delivered products retrieved successfully",
      currentPage: page,
      totalPages: Math.ceil(totalOrders / limit),
      totalOrders,
      data: orders
    });

  } catch (error) {
    console.error("Get Delivered Products Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve delivered products",
      error: error.message
    });
  }
};

