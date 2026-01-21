import Cart from "../Model/CartSchema.js";
import Product from "../Model/ProductSchema.js";
import mongoose from "mongoose";

export const addToCart = async (req, res) => {
    try {
        const { clinicId, productId, variantId, quantity = 1 } = req.body;

        // Validate required fields
        if (!clinicId || !productId || !variantId) {
            return res.status(400).json({
                success: false,
                message: "Missing required fields: clinicId, productId, variantId"
            });
        }

        // Fetch product and variant details
        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({
                success: false,
                message: "Product not found"
            });
        }

        const variant = product.variants.id(variantId);
        if (!variant) {
            return res.status(404).json({
                success: false,
                message: "Variant not found"
            });
        }

        // Check stock availability
        if (variant.stock < quantity) {
            return res.status(400).json({
                success: false,
                message: `Insufficient stock. Available: ${variant.stock}`
            });
        }

        // Get best available price
        const price = variant.discountPrice2 || variant.discountPrice1 || variant.originalPrice;

        // Find or create cart for clinic
        let cart = await Cart.findOne({ clinic: clinicId });

        if (!cart) {
            // Create new cart
            cart = new Cart({
                clinic: clinicId,
                items: []
            });
        }

        // Check if item already exists in cart
        const existingItemIndex = cart.items.findIndex(
            item => item.product.toString() === productId && 
                    item.variant.variantId.toString() === variantId
        );

        if (existingItemIndex > -1) {
            // Update quantity if item exists
            const newQuantity = cart.items[existingItemIndex].quantity + quantity;
            
            // Check stock for new quantity
            if (variant.stock < newQuantity) {
                return res.status(400).json({
                    success: false,
                    message: `Cannot add more. Maximum available: ${variant.stock}`
                });
            }
            
            cart.items[existingItemIndex].quantity = newQuantity;
        } else {
            // Add new item to cart
            cart.items.push({
                product: productId,
                variant: {
                    variantId: variantId,
                    size: variant.size,
                    color: variant.color,
                    material: variant.material,
                    price: price
                },
                quantity: quantity
            });
        }

        await cart.save();

        // Populate cart before sending response
        await cart.populate('items.product', 'name image brand');

        res.status(200).json({
            success: true,
            message: "Item added to cart successfully",
            data: cart
        });
    } catch (error) {
        console.error("Add to Cart Error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to add item to cart",
            error: error.message
        });
    }
};

// ============= GET CART =============
export const getCart = async (req, res) => {
    try {
        const { clinicId } = req.params;

        const cart = await Cart.findOne({ clinic: clinicId })
            .populate({
                path: 'items.product',
                select: 'name description image brand mainCategory subCategory variants',
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
                data: {
                    clinic: clinicId,
                    items: [],
                    totalItems: 0,
                    subtotal: 0
                }
            });
        }

        res.status(200).json({
            success: true,
            message: "Cart retrieved successfully",
            data: cart
        });
    } catch (error) {
        console.error("Get Cart Error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch cart",
            error: error.message
        });
    }
};

// ============= UPDATE CART ITEM QUANTITY =============
export const updateCartItemQuantity = async (req, res) => {
    try {
        const { clinicId, itemId } = req.params;
        const { quantity } = req.body;

        if (!quantity || quantity < 1) {
            return res.status(400).json({
                success: false,
                message: "Quantity must be at least 1"
            });
        }

        const cart = await Cart.findOne({ clinic: clinicId });

        if (!cart) {
            return res.status(404).json({
                success: false,
                message: "Cart not found"
            });
        }

        const item = cart.items.id(itemId);
        if (!item) {
            return res.status(404).json({
                success: false,
                message: "Item not found in cart"
            });
        }

        // Check stock availability
        const product = await Product.findById(item.product);
        const variant = product.variants.id(item.variant.variantId);

        if (variant.stock < quantity) {
            return res.status(400).json({
                success: false,
                message: `Insufficient stock. Available: ${variant.stock}`
            });
        }

        item.quantity = quantity;
        await cart.save();

        await cart.populate('items.product', 'name image');

        res.status(200).json({
            success: true,
            message: "Cart updated successfully",
            data: cart
        });
    } catch (error) {
        console.error("Update Cart Item Error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to update cart item",
            error: error.message
        });
    }
};

// ============= REMOVE ITEM FROM CART =============
export const removeCartItem = async (req, res) => {
    try {
        const { clinicId, itemId } = req.params;

        const cart = await Cart.findOne({ clinic: clinicId });

        if (!cart) {
            return res.status(404).json({
                success: false,
                message: "Cart not found"
            });
        }

        // Remove item using pull
        cart.items.pull(itemId);
        await cart.save();

        await cart.populate('items.product', 'name image');

        res.status(200).json({
            success: true,
            message: "Item removed from cart successfully",
            data: cart
        });
    } catch (error) {
        console.error("Remove Cart Item Error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to remove item from cart",
            error: error.message
        });
    }
};

// ============= CLEAR CART =============
export const clearCart = async (req, res) => {
    try {
        const { clinicId } = req.params;

        const cart = await Cart.findOne({ clinic: clinicId });

        if (!cart) {
            return res.status(404).json({
                success: false,
                message: "Cart not found"
            });
        }

        cart.items = [];
        await cart.save();

        res.status(200).json({
            success: true,
            message: "Cart cleared successfully",
            data: cart
        });
    } catch (error) {
        console.error("Clear Cart Error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to clear cart",
            error: error.message
        });
    }
};

// ============= MOVE CART TO ORDER (Helper function) =============
export const moveCartToOrder = async (clinicId) => {
    try {
        const cart = await Cart.findOne({ clinic: clinicId })
            .populate('items.product');

        if (!cart || cart.items.length === 0) {
            throw new Error("Cart is empty");
        }

        // Return cart items in order format
        const orderItems = cart.items.map(item => ({
            productId: item.product._id,
            variantId: item.variant.variantId,
            quantity: item.quantity
        }));

        // Clear cart after moving to order
        cart.items = [];
        await cart.save();

        return orderItems;
    } catch (error) {
        throw error;
    }
};