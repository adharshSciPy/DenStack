import EcomOrder from "../Model/E-orderSchema.js";
import Product from "../Model/ProductSchema.js";
import mongoose from "mongoose";
import axios from "axios";
import { getPriceForUser, calculateOrderTotal } from "../utils/pricingHelper.js";

const AUTH_BASE = process.env.AUTH_SERVICE_BASE_URL;

// Helper function to fetch clinic details
const fetchClinicDetails = async (clinicId) => {
    try {
        // Change from /clinic/${clinicId} to /view-clinic/${clinicId}
        const response = await axios.get(`${AUTH_BASE}/clinic/view-clinic/${clinicId}`);
        const clinicData = response.data;
        
        return {
            name: clinicData.name,
            email: clinicData.email,
            phone: clinicData.phoneNumber,
            address: clinicData.address 
                ? `${clinicData.address.street || ''}, ${clinicData.address.city || ''}, ${clinicData.address.state || ''}, ${clinicData.address.zip || ''}`.replace(/^,\s*|,\s*$/g, '')
                : ''
        };
    } catch (error) {
        console.error("Error fetching clinic details:", error.message);
        throw new Error("Failed to fetch clinic details");
    }
};

// Helper function to get user role and clinic-doctor status
const getUserRoleInfo = async (userId) => {
    try {
        // Try multiple possible endpoints
        let response;
        try {
            response = await axios.get(`${AUTH_BASE}/user/${userId}`);
        } catch (err) {
            // Try alternate endpoint if first one fails
            response = await axios.get(`${AUTH_BASE}/doctor/details/${userId}`);
        }

        const userData = response.data?.data || response.data;
        
        return {
            role: userData.role || userData.roleId || "600",
            isClinicDoctor: userData.isClinicDoctor || false
        };
    } catch (error) {
        console.error("Error fetching user role:", error.message);
        // Default to a standard user role if fetch fails
        return {
            role: "600", // Default to doctor role
            isClinicDoctor: false
        };
    }
};

// ============= CREATE ECOM ORDER =============
export const createEcomOrder = async (req, res) => {
    try {
        const {
            clinicId,
            userId, // User placing the order (to determine pricing)
            items, // [{ productId, variantId, quantity }]
            shippingAddress,
            paymentMethod,
            orderNotes
        } = req.body;

        // Validate required fields
        if (!clinicId || !items || !items.length || !shippingAddress || !paymentMethod) {
            return res.status(400).json({
                success: false,
                message: "Missing required fields: clinicId, items, shippingAddress, paymentMethod"
            });
        }

        // Fetch clinic details from auth microservice
        let clinicDetails;
        try {
            clinicDetails = await fetchClinicDetails(clinicId);
        } catch (error) {
            return res.status(404).json({
                success: false,
                message: "Clinic not found or unable to fetch clinic details"
            });
        }

        // Get user role information for pricing
        let userRole = "600"; // Default to doctor role
        let isClinicDoctor = false;
        
        if (userId) {
            const roleInfo = await getUserRoleInfo(userId);
            userRole = roleInfo.role;
            isClinicDoctor = roleInfo.isClinicDoctor;
        }

        // Process items and calculate totals with role-based pricing
        let orderItems = [];
        let cartItems = [];

        for (const item of items) {
            const product = await Product.findById(item.productId);
            if (!product) {
                return res.status(404).json({
                    success: false,
                    message: `Product not found: ${item.productId}`
                });
            }

            // Find the variant
            const variant = product.variants.id(item.variantId);
            if (!variant) {
                return res.status(404).json({
                    success: false,
                    message: `Variant not found for product: ${product.name}`
                });
            }

            // Check stock
            if (variant.stock < item.quantity) {
                return res.status(400).json({
                    success: false,
                    message: `Insufficient stock for ${product.name}. Available: ${variant.stock}`
                });
            }

            // Add to cart items for pricing calculation
            cartItems.push({
                variant: variant,
                quantity: item.quantity,
                product: product
            });

            // Reduce stock
            variant.stock -= item.quantity;
            await product.save();
        }

        // Calculate order total with role-based pricing
        const orderTotals = calculateOrderTotal(cartItems, userRole, isClinicDoctor);

        // Build order items with pricing details
        for (let i = 0; i < cartItems.length; i++) {
            const item = cartItems[i];
            const pricedItem = orderTotals.items[i];

            orderItems.push({
                product: new mongoose.Types.ObjectId(item.product._id),
                productName: item.product.name,
                variant: {
                    variantId: item.variant._id,
                    size: item.variant.size,
                    color: item.variant.color,
                    material: item.variant.material
                },
                quantity: item.quantity,
                price: pricedItem.unitPrice,
                originalPrice: pricedItem.originalUnitPrice,
                totalCost: pricedItem.itemTotal,
                discount: pricedItem.itemDiscount,
                priceType: pricedItem.priceType,
                appliedDiscount: pricedItem.appliedDiscount,
                image: item.product.image[0] || null
            });
        }

        // Calculate additional charges
        const subtotal = orderTotals.finalTotal; // Use discounted total as subtotal
        const shippingCharge = subtotal > 500 ? 0 : 50; // Free shipping above 500
        const tax = parseFloat((subtotal * 0.18).toFixed(2)); // 18% GST
        const discount = orderTotals.totalDiscount; // Total discount from role-based pricing
        const totalAmount = subtotal + shippingCharge + tax;

        // Create order
        const newOrder = new EcomOrder({
            clinic: clinicId,
            clinicDetails,
            items: orderItems,
            shippingAddress,
            paymentDetails: {
                method: paymentMethod,
                status: paymentMethod === "COD" ? "PENDING" : "PENDING"
            },
            subtotal: orderTotals.subtotal, // Original subtotal before discount
            shippingCharge,
            tax,
            discount,
            totalAmount,
            orderNotes: orderNotes || "",
            estimatedDelivery: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
            userRole: userRole,
            isClinicDoctor: isClinicDoctor,
            discountPercentage: orderTotals.discountPercentage
        });

        await newOrder.save();

        res.status(201).json({
            success: true,
            message: "Order created successfully",
            data: newOrder,
            pricing: {
                originalSubtotal: orderTotals.subtotal,
                totalDiscount: orderTotals.totalDiscount,
                discountPercentage: orderTotals.discountPercentage,
                discountedSubtotal: orderTotals.finalTotal,
                shippingCharge,
                tax,
                finalTotal: totalAmount
            }
        });
    } catch (error) {
        console.error("Create Ecom Order Error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to create order",
            error: error.message
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
            endDate
        } = req.query;

        // Build filter
        let filter = {};
        if (status) filter.orderStatus = status;
        if (paymentStatus) filter['paymentDetails.status'] = paymentStatus;
        if (clinicId) filter.clinic = clinicId;
        
        // Date range filter
        if (startDate || endDate) {
            filter.createdAt = {};
            if (startDate) filter.createdAt.$gte = new Date(startDate);
            if (endDate) filter.createdAt.$lte = new Date(endDate);
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const orders = await EcomOrder.find(filter)
            .populate('items.product', 'name image')
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
                limit: parseInt(limit)
            }
        });
    } catch (error) {
        console.error("Get All Ecom Orders Error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch orders",
            error: error.message
        });
    }
};

// ============= GET ECOM ORDER BY ID =============
export const getEcomOrderById = async (req, res) => {
    try {
        const { orderId } = req.params;

        const order = await EcomOrder.findById(orderId)
            .populate('items.product', 'name description image brand mainCategory subCategory');

        if (!order) {
            return res.status(404).json({
                success: false,
                message: "Order not found"
            });
        }

        res.status(200).json({
            success: true,
            message: "Order retrieved successfully",
            data: order
        });
    } catch (error) {
        console.error("Get Ecom Order Error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch order",
            error: error.message
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
            .populate('items.product', 'name image')
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
                totalOrders: total
            }
        });
    } catch (error) {
        console.error("Get Clinic Ecom Orders Error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch clinic orders",
            error: error.message
        });
    }
};

// ============= UPDATE ECOM ORDER STATUS =============
export const updateEcomOrderStatus = async (req, res) => {
    try {
        const { orderId } = req.params;
        const { orderStatus, trackingNumber } = req.body;

        const validStatuses = ["PENDING", "CONFIRMED", "PROCESSING", "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED", "RETURNED"];
        
        if (orderStatus && !validStatuses.includes(orderStatus)) {
            return res.status(400).json({
                success: false,
                message: `Invalid status. Valid statuses: ${validStatuses.join(", ")}`
            });
        }

        const updateData = {};
        if (orderStatus) updateData.orderStatus = orderStatus;
        if (trackingNumber) updateData.trackingNumber = trackingNumber;

        const order = await EcomOrder.findByIdAndUpdate(
            orderId,
            updateData,
            { new: true, runValidators: true }
        );

        if (!order) {
            return res.status(404).json({
                success: false,
                message: "Order not found"
            });
        }

        res.status(200).json({
            success: true,
            message: "Order status updated successfully",
            data: order
        });
    } catch (error) {
        console.error("Update Ecom Order Status Error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to update order status",
            error: error.message
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
                message: `Invalid payment status. Valid statuses: ${validStatuses.join(", ")}`
            });
        }

        const updateData = {
            'paymentDetails.status': paymentStatus
        };

        if (transactionId) {
            updateData['paymentDetails.transactionId'] = transactionId;
        }

        if (paymentStatus === 'PAID') {
            updateData['paymentDetails.paidAt'] = new Date();
        }

        const order = await EcomOrder.findByIdAndUpdate(
            orderId,
            updateData,
            { new: true, runValidators: true }
        );

        if (!order) {
            return res.status(404).json({
                success: false,
                message: "Order not found"
            });
        }

        res.status(200).json({
            success: true,
            message: "Payment status updated successfully",
            data: order
        });
    } catch (error) {
        console.error("Update Ecom Payment Status Error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to update payment status",
            error: error.message
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
                message: "Order not found"
            });
        }

        // Only allow cancellation if order is not shipped/delivered
        if (['SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED'].includes(order.orderStatus)) {
            return res.status(400).json({
                success: false,
                message: "Cannot cancel order that is already shipped or delivered"
            });
        }

        // Restore stock
        for (const item of order.items) {
            const product = await Product.findById(item.product);
            if (product) {
                const variant = product.variants.id(item.variant.variantId);
                if (variant) {
                    variant.stock += item.quantity;
                    await product.save();
                }
            }
        }

        order.orderStatus = 'CANCELLED';
        order.cancelledAt = new Date();
        order.cancellationReason = cancellationReason || "Cancelled by user";

        await order.save();

        res.status(200).json({
            success: true,
            message: "Order cancelled successfully",
            data: order
        });
    } catch (error) {
        console.error("Cancel Ecom Order Error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to cancel order",
            error: error.message
        });
    }
};

// ============= GET RECENT ECOM ORDERS =============
export const getRecentEcomOrders = async (req, res) => {
    try {
        const { limit = 10 } = req.query;

        const recentOrders = await EcomOrder.find()
            .populate('items.product', 'name image')
            .sort({ createdAt: -1 })
            .limit(parseInt(limit));

        res.status(200).json({
            success: true,
            message: "Recent orders retrieved successfully",
            count: recentOrders.length,
            data: recentOrders
        });
    } catch (error) {
        console.error("Get Recent Ecom Orders Error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch recent orders",
            error: error.message
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
                    averageOrderValue: { $avg: "$totalAmount" }
                }
            }
        ]);

        // Orders by status
        const ordersByStatus = await EcomOrder.aggregate([
            { $match: dateFilter },
            {
                $group: {
                    _id: "$orderStatus",
                    count: { $sum: 1 }
                }
            }
        ]);

        // Orders by payment status
        const ordersByPaymentStatus = await EcomOrder.aggregate([
            { $match: dateFilter },
            {
                $group: {
                    _id: "$paymentDetails.status",
                    count: { $sum: 1 }
                }
            }
        ]);

        // Orders by payment method
        const ordersByPaymentMethod = await EcomOrder.aggregate([
            { $match: dateFilter },
            {
                $group: {
                    _id: "$paymentDetails.method",
                    count: { $sum: 1 },
                    totalAmount: { $sum: "$totalAmount" }
                }
            }
        ]);

        // Daily order trends (last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const dailyTrends = await EcomOrder.aggregate([
            { 
                $match: { 
                    createdAt: { $gte: thirtyDaysAgo }
                } 
            },
            {
                $group: {
                    _id: {
                        $dateToString: { format: "%Y-%m-%d", date: "$createdAt" }
                    },
                    orders: { $sum: 1 },
                    revenue: { $sum: "$totalAmount" }
                }
            },
            { $sort: { _id: 1 } }
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
                dailyTrends
            }
        });
    } catch (error) {
        console.error("Get Ecom Order Analytics Error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch order analytics",
            error: error.message
        });
    }
};