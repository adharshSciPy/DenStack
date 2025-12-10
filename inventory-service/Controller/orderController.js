import Order from "../Model/OrderSchema.js";
import Product from "../Model/ProductSchema.js";
import Notification from "../Model/NotificationSchema.js";

const createOrder = async (req, res) => {
  try {
    const { clinicId, items } = req.body;

    if (!items || items.length === 0)
      return res.status(400).json({ message: "No items provided" });

    let totalAmount = 0;
    const orderItems = [];
    let vendorId = null; // ⭐ FINAL vendor assigned here

    for (const item of items) {
      const product = await Product.findById(item.productId);

      if (!product)
        return res.status(404).json({ message: `Product not found: ${item.productId}` });

      if (product.stock < item.quantity)
        return res.status(400).json({ message: `Not enough stock for ${product.name}` });

      if (product.expiryDate < new Date())
        return res.status(400).json({ message: `Product expired: ${product.name}` });

      // ⭐ Extract vendorId once
      if (!vendorId) vendorId = product.addedById;

      const unitCost = product.price;
      const totalCost = unitCost * item.quantity;

      totalAmount += totalCost;

      orderItems.push({
        productId: product._id,
        quantity: item.quantity,
        vendorId: product.addedById,
        unitCost,
        totalCost
      });

      product.stock -= item.quantity;
      product.isLowStock = product.stock < 10;
      await product.save();
    }
    console.log("this",orderItems);
    
    // ⭐ Create order with vendorId at ROOT level
    const newOrder = await Order.create({
      clinicId,
      vendorId,
      items: orderItems,
      totalAmount,
      paymentStatus: "PENDING",
      orderStatus: "PROCESSING",
    });

    // ⭐ Create notification correctly
    await Notification.create({
      vendorId,
      orderId: newOrder._id,
      message: `New order received from Clinic ${clinicId}`,
    });

    return res.status(201).json({
      message: "Order created successfully",
      order: newOrder
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Server error", error: error.message });
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

export {
    createOrder, getAllOrders, getUserOrders, cancelOrder ,getOrdersByClinicId
}