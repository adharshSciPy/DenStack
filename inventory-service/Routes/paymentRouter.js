import express from "express";
import {
  createRazorpayOrder,
  verifyRazorpayPayment,
  razorpayWebhook,
} from "../Controller/paymentController.js";

const router = express.Router();

// Step 1 — After createEcomOrder succeeds, call this to get a Razorpay order_id
// POST /api/payments/create-razorpay-order
// Body: { orderId }
router.post("/create-razorpay-order", createRazorpayOrder);

// Step 2 — After Razorpay checkout succeeds on frontend, call this to verify
// POST /api/payments/verify
// Body: { orderId, razorpay_order_id, razorpay_payment_id, razorpay_signature }
router.post("/verify", verifyRazorpayPayment);

// Webhook — registered in Razorpay Dashboard
// POST /api/payments/webhook
// IMPORTANT: needs raw body BEFORE express.json() parses it
router.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  razorpayWebhook,
);

export default router;


// ─────────────────────────────────────────────────────────────────────────────
// In your main app.js / server.js, mount the router:
// ─────────────────────────────────────────────────────────────────────────────
//
// import paymentRoutes from "./Routes/paymentRoutes.js";
// app.use("/api/payments", paymentRoutes);
//
// ─────────────────────────────────────────────────────────────────────────────
// Add to E-orderSchema.js paymentDetails object:
// ─────────────────────────────────────────────────────────────────────────────
//
// razorpayOrderId:   { type: String },
// razorpayPaymentId: { type: String },
// razorpaySignature: { type: String },
//
// ─────────────────────────────────────────────────────────────────────────────
// Add to .env:
// ─────────────────────────────────────────────────────────────────────────────
//
// RAZORPAY_KEY_ID=rzp_test_XXXXXXXXXXXXXXXX
// RAZORPAY_KEY_SECRET=XXXXXXXXXXXXXXXXXXXXXXXX
// RAZORPAY_WEBHOOK_SECRET=your_webhook_secret
//
// ─────────────────────────────────────────────────────────────────────────────
// Install:
// ─────────────────────────────────────────────────────────────────────────────
//
// npm install razorpay