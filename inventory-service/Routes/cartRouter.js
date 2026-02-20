// ============================================
// routes/cartRoutes.js
// ============================================

import express from "express";
import { verifyAuthToken, canPlaceOrder } from "../middlewares/authMiddleware.js";
import {
    addToCart,
    getCart,
    updateCartItemQuantity,
    removeCartItem,
    clearCart,
    checkoutCart
} from "../Controller/cartController.js";

const cartRouter = express.Router();

// ✅ All routes protected - only clinics & clinic-doctors
cartRouter.post("/add", verifyAuthToken, addToCart);
cartRouter.get("/get", verifyAuthToken, getCart);
cartRouter.put("/item/:itemId", verifyAuthToken, canPlaceOrder, updateCartItemQuantity);
cartRouter.delete("/item/:itemId", verifyAuthToken, canPlaceOrder, removeCartItem);
cartRouter.delete("/clear", verifyAuthToken, canPlaceOrder, clearCart);
cartRouter.post("/checkout", verifyAuthToken, canPlaceOrder, checkoutCart);

export default cartRouter;