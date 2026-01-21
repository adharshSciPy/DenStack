import express from "express";
import {
    addToCart,
    getCart,
    updateCartItemQuantity,
    removeCartItem,
    clearCart
} from "../Controller/cartController.js";

const cartRouter = express.Router();

// ============= CART ROUTES =============

// Add item to cart
cartRouter.post("/add", addToCart);

// Get cart by clinic ID
cartRouter.get("/:clinicId", getCart);

// Update cart item quantity
cartRouter.put("/:clinicId/item/:itemId", updateCartItemQuantity);

// Remove item from cart
cartRouter.delete("/:clinicId/item/:itemId", removeCartItem);

// Clear entire cart
cartRouter.delete("/:clinicId/clear", clearCart);

export default cartRouter;