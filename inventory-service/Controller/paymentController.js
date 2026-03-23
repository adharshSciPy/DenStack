import Razorpay from "razorpay";
import crypto from "crypto";
import EcomOrder from "../Model/E-orderSchema.js";
import Coupon from "../Model/CouponSchema.js";

// ─── Razorpay Instance ────────────────────────────────────────────────────────
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// ─── Helper: record coupon usage after confirmed payment ──────────────────────
const recordCouponUsage = async (order) => {
  // Step 1 — does the order even have a coupon?
  console.log(`\n🎟️  recordCouponUsage called`);
  console.log(`   order._id      : ${order._id}`);
  console.log(`   order.orderId  : ${order.orderId}`);
  console.log(`   order.couponCode: "${order.couponCode}"`);

  if (!order.couponCode) {
    console.log(`   ⏭️  No couponCode — skipping`);
    return;
  }

  try {
    // Step 2 — look up the coupon
    const searchCode = order.couponCode.toString().trim().toUpperCase();
    console.log(`   🔍 Searching for coupon code: "${searchCode}"`);

    const coupon = await Coupon.findOne({ code: searchCode });
    console.log(`   🔍 Coupon found: ${coupon ? `YES — _id: ${coupon._id}, code: "${coupon.code}"` : "NO"}`);

    if (!coupon) {
      // Try case-insensitive fallback
      const couponCI = await Coupon.findOne({ code: { $regex: new RegExp(`^${searchCode}$`, "i") } });
      console.log(`   🔍 Case-insensitive fallback: ${couponCI ? `YES — "${couponCI.code}"` : "NO"}`);

      if (!couponCI) {
        console.warn(`   ⚠️  Coupon "${searchCode}" not found in DB — skipping`);
        return;
      }

      // Use the found coupon
      await pushUsedBy(couponCI, order);
      return;
    }

    await pushUsedBy(coupon, order);

  } catch (err) {
    console.warn(`   ❌ recordCouponUsage error (non-blocking): ${err.message}`);
    console.warn(err.stack);
  }
};

// ─── Push usedBy entry ────────────────────────────────────────────────────────
const pushUsedBy = async (coupon, order) => {
  const entry = {
    userId:  order.user  || null,
    name:    order.clinicDetails?.name  || "User",
    email:   order.clinicDetails?.email || "",
    usedAt:  new Date(),
    orderId: order.orderId || order._id.toString(),
  };

  console.log(`   📝 Pushing usedBy entry:`, JSON.stringify(entry));

  const result = await Coupon.findByIdAndUpdate(
    coupon._id,
    { $push: { usedBy: entry } },
    { new: true },
  );

  console.log(`   ✅ usedBy updated. New count: ${result?.usedBy?.length ?? "unknown"}`);
};

// ============= CREATE RAZORPAY ORDER =============
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

    const razorpayOrder = await razorpay.orders.create({
      amount:   Math.round(order.totalAmount * 100),
      currency: "INR",
      receipt:  order._id.toString(),
      notes: {
        orderId:   order._id.toString(),
        buyerType: order.buyerType,
      },
    });

    order.paymentDetails.razorpayOrderId = razorpayOrder.id;
    await order.save();

    console.log(`\n🔑 Razorpay order created: ${razorpayOrder.id} for DB order: ${order._id}`);

    return res.status(200).json({
      success: true,
      message: "Razorpay order created. Open checkout on frontend.",
      razorpay: {
        key_id:   process.env.RAZORPAY_KEY_ID,
        order_id: razorpayOrder.id,
        amount:   razorpayOrder.amount,
        currency: razorpayOrder.currency,
      },
    });
  } catch (error) {
    console.error("Create Razorpay Order Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create Razorpay order",
      error: error.message,
    });
  }
};

// ============= VERIFY RAZORPAY PAYMENT =============
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
    const body              = razorpay_order_id + "|" + razorpay_payment_id;
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

    // 3. Guard: razorpay_order_id must match
    if (order.paymentDetails.razorpayOrderId !== razorpay_order_id) {
      return res.status(400).json({ success: false, message: "Razorpay order ID mismatch" });
    }

    // 4. Mark as paid
    order.paymentDetails.status             = "PAID";
    order.paymentDetails.transactionId      = razorpay_payment_id;
    order.paymentDetails.razorpayPaymentId  = razorpay_payment_id;
    order.paymentDetails.razorpaySignature  = razorpay_signature;
    order.paymentDetails.paidAt             = new Date();
    order.orderStatus                       = "CONFIRMED";

    await order.save();
    console.log(`\n✅ Payment verified & order confirmed: ${order._id} | Payment: ${razorpay_payment_id}`);

    // 5. Re-fetch so orderId (EORD#xxxx) is populated from pre-save hook
    const freshOrder = await EcomOrder.findById(order._id);
    console.log(`🔄 Re-fetched: orderId=${freshOrder?.orderId} | couponCode="${freshOrder?.couponCode}"`);

    // 6. Record coupon usage
    await recordCouponUsage(freshOrder);

    return res.status(200).json({
      success: true,
      message: "Payment verified. Order confirmed.",
      data: {
        orderId:       freshOrder.orderId,
        _id:           freshOrder._id,
        orderStatus:   freshOrder.orderStatus,
        paymentStatus: freshOrder.paymentDetails.status,
        paymentId:     razorpay_payment_id,
        paidAt:        freshOrder.paymentDetails.paidAt,
      },
    });
  } catch (error) {
    console.error("Verify Razorpay Payment Error:", error);
    return res.status(500).json({
      success: false,
      message: "Payment verification failed",
      error: error.message,
    });
  }
};

// ============= RAZORPAY WEBHOOK =============
export const razorpayWebhook = async (req, res) => {
  try {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

    if (webhookSecret) {
      const signature   = req.headers["x-razorpay-signature"];
      const expectedSig = crypto
        .createHmac("sha256", webhookSecret)
        .update(req.body)
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
        const payment   = event.payload.payment.entity;
        const rzpOrder  = await razorpay.orders.fetch(payment.order_id);
        const dbOrderId = rzpOrder.receipt;

        const order = await EcomOrder.findById(dbOrderId);

        if (order && order.paymentDetails.status !== "PAID") {
          order.paymentDetails.status             = "PAID";
          order.paymentDetails.transactionId      = payment.id;
          order.paymentDetails.razorpayPaymentId  = payment.id;
          order.paymentDetails.paidAt             = new Date();
          order.orderStatus                       = "CONFIRMED";
          await order.save();
          console.log(`✅ Webhook: order ${dbOrderId} marked PAID`);

          const freshOrder = await EcomOrder.findById(dbOrderId);
          await recordCouponUsage(freshOrder);
        } else if (order?.paymentDetails.status === "PAID") {
          console.log(`⏭️  Webhook: order ${dbOrderId} already PAID — skipping`);
        }
        break;
      }

      case "payment.failed": {
        const payment   = event.payload.payment.entity;
        const rzpOrder  = await razorpay.orders.fetch(payment.order_id);
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