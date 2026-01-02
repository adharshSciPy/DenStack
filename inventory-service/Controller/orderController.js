import Order from "../Model/OrderSchema.js";
import Product from "../Model/ProductSchema.js";
import Notification from "../Model/NotificationSchema.js";
import Vendor from "../Model/VendorSchema.js"
import Clinic from "../../auth-services/models/clinicSchema.js"

import axios from "axios"
const AUTH_BASE = process.env.AUTH_SERVICE_BASE_URL;

const createOrder = async (req, res) => {
  try {
    const { clinicId, vendorId, items, paymentStatus, priorityLevel, orderStatus } = req.body;

    if (!clinicId)
      return res.status(400).json({ message: "clinicId is required" });

    if (!vendorId)
      return res.status(400).json({ message: "vendorId is required" });

    if (!items || items.length === 0)
      return res.status(400).json({ message: "No items provided" });

    let totalAmount = 0;
    const orderItems = [];

    for (const item of items) {
      const product = await Product.findById(item.productId);

      if (!product)
        return res.status(404).json({
          message: `Product not found: ${item.productId}`,
        });

      if (product.stock < item.quantity)
        return res.status(400).json({
          message: `Not enough stock for ${product.name}`,
        });

      if (product.expiryDate && product.expiryDate < new Date())
        return res.status(400).json({
          message: `Product expired: ${product.name}`,
        });

      const unitCost = product.price;
      const totalCost = unitCost * item.quantity;

      totalAmount += totalCost;

      orderItems.push({
        itemId: product._id,
        quantity: item.quantity,
        unitCost,
        totalCost,
      });

      product.stock -= item.quantity;
      product.isLowStock = product.stock < 10;
      await product.save();
    }

    // ⭐ USE VALUES SENT FROM POSTMAN
    const newOrder = new Order({
      clinicId,
      vendorId,
      items: orderItems,
      totalAmount,
      paymentStatus: paymentStatus || "PENDING",
      priorityLevel: priorityLevel || "STANDARD",
      orderStatus: orderStatus || "PROCESSING"
    });

    await newOrder.save();

    await Vendor.findByIdAndUpdate(vendorId, {
      $inc: { totalRevenue: totalAmount },
    });

    return res.status(201).json({
      message: "Order created successfully",
      orderId: newOrder.orderId,
      order: newOrder
    });

  } catch (error) {
    console.error("Create Order Error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};



const getAllOrders = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const totalOrders = await Order.countDocuments();

    const orders = await Order.find()
      .skip(skip)
      .limit(limit)
      .populate("items._id", "name price")
      .sort({ createdAt: -1 });

    res.status(200).json({
      message: "Order fetched Successfully",
      currentpage: page,
      totalPages: Math.ceil(totalOrders / limit),
      totalOrders,
      limit,
      data: orders
    });
  } catch (error) {
    console.error("Get Orders Error:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

// ✅ GET ORDERS FOR A SPECIFIC USER (Clinic or Customer)
const getUserOrders = async (req, res) => {
  try {
    const { userId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const totalOrders = await Order.countDocuments({ userId: userId })

    const orders = await Order.find({ userId })
      .skip(skip)
      .sort({ createdAt: -1 });

    if (!orders.length) {
      return res.status(404).json({ success: false, message: "No orders found" });
    }

    res.status(200).json({
      message: "User orders fetched",
      currentpage: page,
      totalPage: Math.ceil(totalOrders / limit),
      totalOrders,
      limit,
      data: orders
    });
  } catch (error) {
    console.error("Get User Orders Error:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

const cancelOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(400).json({ message: "Order Not Found" })
    }
    if (order.orderStatus === "CANCELLED") {
      return res.status(400).json({ message: "Order is already cancelled" })
    }
    if (order.orderStatus === "DELIVERED") {
      return res.status(400).json({ message: "Order is already delivered" })
    }

    for (const item of order.items) {
      const product = await Product.findById(item.productId)
      if (product) {
        product.stock += item.quantity;

        // Update low-stock flag
        product.isLowStock = product.stock < 10;
        await product.save();
      }
    }
    order.orderStatus = "CANCELLED";
    order.paymentStatus = "PENDING_REFUND"; // optional
    await order.save();

    res.status(200).json({ message: "Order cancelled successfully", data: order })

  } catch (error) {
    res.status(500).json({ message: "Internal Server Error", error: error.message })
  }
}

const getOrdersByClinicId = async (req, res) => {
  try {
    const { clinicId } = req.params;
    const limit = parseInt(req.query.limit) || 10;
    const cursor = req.query.cursor || null; // the last orderId received

    if (!clinicId) {
      return res.status(400).json({ message: "Clinic ID is required" });
    }

    // Query object
    let query = { userId: clinicId };

    // If cursor exists → only fetch orders created BEFORE cursor
    if (cursor) {
      query._id = { $lt: cursor };
    }

    // Fetch orders
    const orders = await Order.find(query)
      .sort({ _id: -1 })        // newest first
      .limit(limit + 1)         // fetch one extra to check "hasNext"
      .populate("items.itemId", "name price image")


    let nextCursor = null;

    if (orders.length > limit) {
      // Remove extra item
      const nextOrder = orders.pop();
      nextCursor = nextOrder._id;  // use this for next page
    }

    res.status(200).json({
      message: "Orders fetched successfully",
      data: orders,
      nextCursor,         // null means no more pages
      hasMore: !!nextCursor
    });

  } catch (error) {
    console.error("Cursor Pagination Error:", error);
    res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message
    });
  }
};

const getOrderStats = async (req, res) => {
  try {
    const totalOrders = await Order.countDocuments();

    const processing = await Order.countDocuments({ orderStatus: "PROCESSING" });
    const shipped = await Order.countDocuments({ orderStatus: "SHIPPED" });
    const delivered = await Order.countDocuments({ orderStatus: "DELIVERED" });
    const cancelled = await Order.countDocuments({ orderStatus: "CANCELLED" });

    return res.status(200).json({
      message: "Order stats fetched successfully",
      stats: {
        totalOrders,
        processing,
        shipped,
        delivered,
        cancelled
      }
    });
  } catch (error) {
    console.error("Order Stats Error:", error);
    return res.status(500).json({ message: "Server Error", error: error.message });
  }
};

const getRecentOrders = async (req, res) => {
  try {
    const orders = await Order.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .populate("items.itemId", "name price image");

    const results = [];

    for (const order of orders) {
      let clinicName = "Unknown Clinic";

      try {
        const clinicRes = await axios.get(
          `${AUTH_BASE}/clinic/view-clinic/${order.clinicId}`
        );
        clinicName = clinicRes.data?.data?.name || "Unknown Clinic";
      } catch (err) {
        console.log("❌ Clinic API failed:", order.clinicId);
      }

      const itemsFormatted = order.items.map((item) => ({
        name: item.itemId?.name || "Unknown Product",
        quantity: item.quantity,
      }));

      results.push({
        orderId: order.orderId,
        date: order.createdAt,
        clinic: clinicName,
        items: itemsFormatted,
        totalAmount: order.totalAmount,
        orderStatus: order.orderStatus,
        priority: order.priorityLevel || "STANDARD"  // ⭐ FIXED FIELD
      });
    }

    return res.status(200).json({
      message: "Recent orders fetched successfully",
      data: results,
    });
  } catch (error) {
    console.error("❌ Recent Orders Error:", error.message);
    return res.status(500).json({
      message: "Server Error",
      error: error.message,
    });
  }
};

const getAllOrdersAnalytics = async (req, res) => {
  try {
    const orders = await Order.find()
      .populate("items.itemId", "name price image")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      totalOrders: orders.length,
      data: orders
    });

  } catch (error) {
    console.error("Analytics Orders Error:", error);
    return res.status(500).json({
      message: "Server Error",
      error: error.message
    });
  }
};

const PaymentSummary = async (req, res) => {
  try {
    const result = await Order.aggregate([
      {
        $group: {
          _id: "$paymentStatus",
          totalAmount: { $sum: "$totalAmount" }
        }
      }
    ]);

    let totalPaidAmount = 0;
    let totalUnpaidAmount = 0;

    result.forEach(item => {
      if (item._id === "PAID") {
        totalPaidAmount += item.totalAmount;
      } else {
        totalUnpaidAmount += item.totalAmount;
      }
    });

    const finalRevenue = totalPaidAmount;

    return res.status(200).json({
      success: true,
      totalPaidAmount,
      totalUnpaidAmount,
      finalRevenue
    });

  } catch (error) {
    console.error("Order Payment Summary Error:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching order payment summary",
      error: error.message
    });
  }
};

const dashboardAnalytics = async (req, res) => {
  try {
    const now = new Date();

    // 📅 Current Month
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    // 📅 Last Month
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    /* ===============================
       1️⃣ ORDER VOLUME (Avg/day)
    =============================== */
    const totalOrdersThisMonth = await Order.countDocuments({
      createdAt: { $gte: startOfMonth, $lte: endOfMonth }
    });

    const daysPassed = now.getDate();
    const avgOrdersPerDay = Math.round(totalOrdersThisMonth / daysPassed);

    /* ===============================
       2️⃣ AVERAGE ORDER VALUE
    =============================== */
    const thisMonthOrders = await Order.find({
      createdAt: { $gte: startOfMonth, $lte: endOfMonth }
    });

    const lastMonthOrders = await Order.find({
      createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth }
    });

    const thisMonthRevenue = thisMonthOrders.reduce(
      (sum, o) => sum + o.totalAmount, 0
    );

    const lastMonthRevenue = lastMonthOrders.reduce(
      (sum, o) => sum + o.totalAmount, 0
    );

    const avgOrderValue = thisMonthOrders.length
      ? Math.round(thisMonthRevenue / thisMonthOrders.length)
      : 0;

    const lastMonthAOV = lastMonthOrders.length
      ? lastMonthRevenue / lastMonthOrders.length
      : 0;

    const aovGrowth =
      lastMonthAOV === 0
        ? 0
        : Math.round(((avgOrderValue - lastMonthAOV) / lastMonthAOV) * 100);

    /* ===============================
       3️⃣ FULFILLMENT RATE
    =============================== */
    const totalDelivered = await Order.countDocuments({
      orderStatus: "DELIVERED"
    });

    const totalOrders = await Order.countDocuments();

    const fulfillmentRate = totalOrders
      ? ((totalDelivered / totalOrders) * 100).toFixed(1)
      : 0;

    /* ===============================
       FINAL RESPONSE (Screenshot Ready)
    =============================== */
    return res.status(200).json({
      success: true,
      dashboard: {
        orderVolume: {
          label: "Orders per day this month",
          value: avgOrdersPerDay
        },
        averageOrderValue: {
          label: "Mean transaction value",
          value: avgOrderValue,
          growthPercent: aovGrowth
        },
        fulfillmentRate: {
          label: "On-time delivery percentage",
          value: fulfillmentRate
        }
      }
    });

  } catch (error) {
    console.error("Dashboard Analytics Error:", error);
    res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message
    });
  }
};

const getTopSoldProducts = async (req, res) => {
  try {
    const topProducts = await Order.aggregate([
      // ✅ Only successful orders
      {
        $match: {
          orderStatus: "DELIVERED",
          paymentStatus: "PAID",
        },
      },

      { $unwind: "$items" },

      {
        $group: {
          _id: "$items.itemId",
          totalUnitsSold: { $sum: "$items.quantity" },
          totalRevenue: { $sum: "$items.totalCost" },
        },
      },

      { $sort: { totalUnitsSold: -1 } },
      { $limit: 5 },

      {
        $lookup: {
          from: "products",
          localField: "_id",
          foreignField: "_id",
          as: "product",
        },
      },

      {
        $unwind: { path: "$product", preserveNullAndEmptyArrays: true }
      },

      {
        $project: {
          _id: 0,
          productId: "$_id",
          productName: "$product.name",
          totalUnitsSold: 1,
          totalRevenue: 1,
        },
      },
    ]);

    res.status(200).json({
      success: true,
      count: topProducts.length,
      data: topProducts,
    });
  } catch (error) {
    console.error("Top Products Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch top sold products",
    });
  }
};

const getClinicAnalytics = async (req, res) => {
   try {
    // 1️⃣ Aggregate orders per clinic
    const ordersAggregation = await Order.aggregate([
      { $match: { clinicId: { $ne: null } } },
      {
        $group: {
          _id: "$clinicId",
          orders: { $sum: 1 },
          revenue: { $sum: "$totalAmount" },
          avgOrder: { $avg: "$totalAmount" }
        }
      },
      {
        $project: {
          _id: 1,
          orders: 1,
          revenue: 1,
          avgOrder: { $round: ["$avgOrder", 2] }
        }
      }
    ]);

    // 2️⃣ Get all clinic IDs from aggregation
    const clinicIds = ordersAggregation.map(c => c._id);

    // 3️⃣ Fetch clinic names from Auth Service using clinicById
    const authServiceUrl = process.env.AUTH_SERVICE_BASE_URL;

    // Use Promise.all to fetch all clinics in parallel
    const clinicsData = await Promise.all(
      clinicIds.map(async (id) => {
        try {
          const { data } = await axios.get(`${authServiceUrl}/clinic/view-clinic/${id}`);
          return data.success ? data.data : { _id: id, name: "UNKNOWN" };
        } catch (err) {
          console.error(`Error fetching clinic ${id}:`, err.message);
          return { _id: id, name: "UNKNOWN" };
        }
      })
    );

    // 4️⃣ Merge orders aggregation with clinic names
    const result = ordersAggregation.map(order => {
      const clinic = clinicsData.find(c => c._id === order._id.toString());
      return {
        clinicId: order._id,
        clinic: clinic ? clinic.name : "UNKNOWN",
        orders: order.orders,
        revenue: order.revenue,
        avgOrder: order.avgOrder
      };
    });

    // 5️⃣ Sort by revenue descending (optional)
    result.sort((a, b) => b.revenue - a.revenue);

    res.json({ success: true, data: result });

  } catch (error) {
    console.error("❌ Clinic analytics error:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch clinic analytics",
      error: error.message
    });
  }
};






export {
  createOrder, getAllOrders, getUserOrders, cancelOrder, getOrdersByClinicId, getOrderStats, getRecentOrders, getAllOrdersAnalytics, PaymentSummary, dashboardAnalytics, getTopSoldProducts, getClinicAnalytics,

}