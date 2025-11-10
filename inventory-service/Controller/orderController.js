import Order from "../Model/OrderSchema.js";
import Product from "../Model/ProductSchema.js";

const createOrder = async (req, res) => {
    try {
        const { userId, items } = req.body;

        // Validate items
        if (!items || items.length === 0)
            return res.status(400).json({ message: "No items provided" });

        // Fetch product prices from DB (to prevent tampering)
        let totalAmount = 0;
        const orderItems = [];

        for (const item of items) {
            const product = await Product.findById(item.productId);
            if (!product)
                return res.status(404).json({ message: `Product not found: ${item.productId}` });

            if (product.stock < item.quantity)
                return res.status(400).json({ message: `Not enough stock for ${product.name}` });

            // ⚡ Check if product is expired
            const now = new Date();
            if (product.expiryDate && product.expiryDate < now) {
                return res.status(400).json({ message: `Product expired: ${product.name}` });
            }

            totalAmount += product.price * item.quantity;
            orderItems.push({
                productId: product._id,
                quantity: item.quantity,
                price: product.price,
            });

            // ✅ Update low-stock flag immediately
            if (product.stock < 10) {
                product.isLowStock = true;
            } else {
                product.isLowStock = false;
            }

            // Update low-stock flag immediately
            product.isLowStock = product.stock - item.quantity < 10;


            // (Optional) Reduce stock
            product.stock -= item.quantity;
            await product.save();
        }

        // Create order
        const newOrder = new Order({
            userId,
            items: orderItems,
            totalAmount,
            paymentStatus: "PENDING",
            orderStatus: "PROCESSING",
        });

        await newOrder.save();
        res.status(201).json({ message: "Order created successfully", order: newOrder });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
};

// ✅ GET ALL ORDERS (SuperAdmin or for Admin Dashboard)
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


export {
    createOrder, getAllOrders, getUserOrders
}