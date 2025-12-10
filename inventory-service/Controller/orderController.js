import Order from "../Model/OrderSchema.js";
import Product from "../Model/ProductSchema.js";

import axios from "axios"
const AUTH_BASE = process.env.AUTH_SERVICE_BASE_URL;

const createOrder = async (req, res) => {
    try {
        const { clinicId, vendorId, superadminId, items } = req.body;

        if (!items || items.length === 0)
            return res.status(400).json({ message: "No items provided" });

        let totalAmount = 0;
        const orderItems = [];

        for (const item of items) {
            let product = null;

            // SUPERADMIN ORDER
            if (superadminId) {
                product = await Product.findOne({
                    _id: item.productId,
                    addedByType: "superadmin",
                    addedById: superadminId,
                });
            }

            // CLINIC ORDER
            if (!product && clinicId) {
                product = await Product.findOne({
                    _id: item.productId,
                    addedByType: "clinic",
                    addedById: clinicId,
                });
            }

            // VENDOR ORDER
            if (!product && vendorId) {
                product = await Product.findOne({
                    _id: item.productId,
                    addedByType: "vendor",
                    addedById: vendorId,
                });
            }

            // PRODUCT DOES NOT BELONG TO THIS USER
            if (!product) {
                return res.status(404).json({
                    message: `Product does not belong to this owner or not found: ${item.productId}`,
                });
            }

            if (!product)
                return res.status(404).json({ message: `Product not found: ${item.productId}` });

            if (product.stock < item.quantity)
                return res.status(400).json({ message: `Not enough stock for ${product.name}` });

            // Check expiry
            const now = new Date();
            if (product.expiryDate && product.expiryDate < now) {
                return res.status(400).json({ message: `Product expired: ${product.name}` });
            }

            // Pricing
            const unitCost = product.price;
            const totalCost = unitCost * item.quantity;

            totalAmount += totalCost;

            // ⭐ FIXED — match schema
            orderItems.push({
                itemId: product._id,      // product reference
                quantity: item.quantity,
                unitCost: unitCost,
                totalCost: totalCost
            });

            // Low stock flag
            product.isLowStock = product.stock - item.quantity < 10;

            // Reduce stock
            product.stock -= item.quantity;
            await product.save();
        }

        const newOrder = new Order({
            clinicId,
            superadminId,
            vendorId,
            items: orderItems,
            totalAmount,
            paymentStatus: "PENDING",
            orderStatus: "PROCESSING",
        });

        await newOrder.save();

        res.status(201).json({
            message: "Order created successfully",
            order: newOrder
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
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
            console.log("order", order)

            try {
                const clinicRes = await axios.get(
                    `${AUTH_BASE}/clinic/view-clinic/${order.clinicId}`
                );
                clinicName = clinicRes.data?.data.name || "Unknown Clinic";
                console.log(clinicRes)
            } catch (err) {
                console.log("❌ Clinic API failed:", err);
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
                priority: order.priority || "Standard",  // ⭐ NEW FIELD ADDED
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

export {
    createOrder, getAllOrders, getUserOrders, cancelOrder, getOrdersByClinicId, getOrderStats, getRecentOrders
}