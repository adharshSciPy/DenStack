import Razorpay from "razorpay";
import crypto from "crypto";
import EcomOrder from "../Model/E-orderSchema.js";

// ─── Razorpay Instance ────────────────────────────────────────────────────────
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// ============= CREATE RAZORPAY ORDER =============
// Called by frontend AFTER your existing createEcomOrder saves to DB
// Body: { orderId }  ← your MongoDB _id from createEcomOrder response
export const createRazorpayOrder = async (req, res) => {
  try {
    const { orderId } = req.body;

    if (!orderId) {
      return res.status(400).json({ success: false, message: "orderId is required" });
    }

    const order = await EcomOrder.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    if (order.paymentDetails.method !== "RAZORPAY") {
      return res.status(400).json({ success: false, message: "Order payment method is not RAZORPAY" });
    }

    if (order.paymentDetails.status === "PAID") {
      return res.status(400).json({ success: false, message: "Order is already paid" });
    }

    // Create Razorpay order using the totalAmount already calculated by your order controller
    const razorpayOrder = await razorpay.orders.create({
      amount: Math.round(order.totalAmount * 100), // convert ₹ to paise
      currency: "INR",
      receipt: order._id.toString(),
      notes: {
        orderId: order._id.toString(),
        buyerType: order.buyerType,
      },
    });

    // Save razorpay_order_id to your DB order
    order.paymentDetails.razorpayOrderId = razorpayOrder.id;
    await order.save();

    console.log(`\n🔑 Razorpay order created: ${razorpayOrder.id} for DB order: ${order._id}`);

    return res.status(200).json({
      success: true,
      message: "Razorpay order created. Open checkout on frontend.",
      razorpay: {
        key_id: process.env.RAZORPAY_KEY_ID,
        order_id: razorpayOrder.id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
      },
    });
  } catch (error) {
    console.error("Create Razorpay Order Error:", error);
    return res.status(500).json({ success: false, message: "Failed to create Razorpay order", error: error.message });
  }
};

// ============= VERIFY RAZORPAY PAYMENT =============
// Called by frontend after Razorpay checkout success handler fires
// Body: { orderId, razorpay_order_id, razorpay_payment_id, razorpay_signature }
export const verifyRazorpayPayment = async (req, res) => {
  try {
    const { orderId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    if (!orderId || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: "Missing fields: orderId, razorpay_order_id, razorpay_payment_id, razorpay_signature",
      });
    }

    // 1. Verify HMAC-SHA256 signature
    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      console.warn(`⚠️  Signature mismatch for order ${orderId}`);
      return res.status(400).json({ success: false, message: "Payment signature verification failed" });
    }

    // 2. Find the order
    const order = await EcomOrder.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    // 3. Guard: razorpay_order_id must match what we stored at createRazorpayOrder
    if (order.paymentDetails.razorpayOrderId !== razorpay_order_id) {
      return res.status(400).json({ success: false, message: "Razorpay order ID mismatch" });
    }

    // 4. Mark order as paid and confirmed
    order.paymentDetails.status          = "PAID";
    order.paymentDetails.transactionId   = razorpay_payment_id;
    order.paymentDetails.razorpayPaymentId = razorpay_payment_id;
    order.paymentDetails.razorpaySignature = razorpay_signature;
    order.paymentDetails.paidAt          = new Date();
    order.orderStatus                    = "CONFIRMED";

    await order.save();

    console.log(`✅ Payment verified & order confirmed: ${order._id} | Payment: ${razorpay_payment_id}`);

    return res.status(200).json({
      success: true,
      message: "Payment verified. Order confirmed.",
      data: {
        orderId:       order._id,
        orderStatus:   order.orderStatus,
        paymentStatus: order.paymentDetails.status,
        paymentId:     razorpay_payment_id,
        paidAt:        order.paymentDetails.paidAt,
      },
    });
  } catch (error) {
    console.error("Verify Razorpay Payment Error:", error);
    return res.status(500).json({ success: false, message: "Payment verification failed", error: error.message });
  }
};

// ============= RAZORPAY WEBHOOK (server-to-server safety net) =============
// Register in Razorpay Dashboard → Settings → Webhooks
// URL: https://yourdomain.com/api/payments/webhook
// NOTE: This route must receive raw body — see routes file
export const razorpayWebhook = async (req, res) => {
  try {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

    if (webhookSecret) {
      const signature = req.headers["x-razorpay-signature"];
      const expectedSig = crypto
        .createHmac("sha256", webhookSecret)
        .update(req.body) // raw buffer
        .digest("hex");

      if (expectedSig !== signature) {
        console.warn("⚠️  Invalid Razorpay webhook signature");
        return res.status(400).json({ error: "Invalid signature" });
      }
    }

    const event = JSON.parse(req.body);
    console.log(`📦 Razorpay webhook received: ${event.event}`);

    switch (event.event) {

      case "payment.captured": {
        const payment = event.payload.payment.entity;
        const rzpOrder = await razorpay.orders.fetch(payment.order_id);
        const dbOrderId = rzpOrder.receipt; // receipt = our MongoDB _id

        const order = await EcomOrder.findById(dbOrderId);
        if (order && order.paymentDetails.status !== "PAID") {
          order.paymentDetails.status          = "PAID";
          order.paymentDetails.transactionId   = payment.id;
          order.paymentDetails.razorpayPaymentId = payment.id;
          order.paymentDetails.paidAt          = new Date();
          order.orderStatus                    = "CONFIRMED";
          await order.save();
          console.log(`✅ Webhook: order ${dbOrderId} marked PAID via payment.captured`);
        }
        break;
      }

      case "payment.failed": {
        const payment = event.payload.payment.entity;
        const rzpOrder = await razorpay.orders.fetch(payment.order_id);
        const dbOrderId = rzpOrder.receipt;

        const order = await EcomOrder.findById(dbOrderId);
        if (order && order.paymentDetails.status === "PENDING") {
          order.paymentDetails.status = "FAILED";
          await order.save();
          console.log(`❌ Webhook: order ${dbOrderId} payment FAILED`);
        }
        break;
      }

      case "order.paid":
        console.log(`✅ Webhook: Razorpay order paid: ${event.payload.order.entity.id}`);
        break;

      default:
        console.log(`Unhandled webhook event: ${event.event}`);
    }

    return res.status(200).json({ received: true });
  } catch (error) {
    console.error("Razorpay Webhook Error:", error);
    return res.status(500).json({ error: error.message });
  }
};