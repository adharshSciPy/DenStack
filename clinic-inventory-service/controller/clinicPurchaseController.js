import Razorpay from "razorpay";
import crypto from "crypto";
import PurchaseOrder from "../model/purchaseOrder.js";
import Product from "../model/Product.js";
import ClinicInventory from "../model/departmentInventory.js";

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_SECRET,
});

// Create Razorpay Order
export const createPurchaseOrder = async (req, res) => {
  try {
    const { clinicId, items } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ message: "No items in order" });
    }

    let totalAmount = 0;
    const detailedItems = [];

    for (const item of items) {
      const product = await Product.findById(item.productId);
      if (!product) return res.status(404).json({ message: "Product not found" });

      const itemTotal = product.price * item.quantity;
      totalAmount += itemTotal;

      detailedItems.push({
        productId: product._id,
        quantity: item.quantity,
        price: product.price,
      });
    }

    // ⚠️ Simulate Razorpay order
    const fakeOrder = {
      id: "order_" + Date.now(),
      amount: totalAmount * 100,
      currency: "INR",
      status: "created",
    };

    const purchase = await PurchaseOrder.create({
      clinicId,
      items: detailedItems,
      totalAmount,
      razorpayOrderId: fakeOrder.id,
      paymentStatus: "Pending",
    });

    res.json({ success: true, message: "Test order created", order: fakeOrder, purchase });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};


// Verify Payment
export const verifyPayment = async (req, res) => {
  try {
    const { purchaseId } = req.body;

    const purchase = await PurchaseOrder.findById(purchaseId).populate("items.productId");

    if (!purchase) return res.status(404).json({ message: "Purchase not found" });

    // ✅ Simulate payment success
    purchase.paymentStatus = "Paid";
    purchase.razorpayPaymentId = "test_payment_" + Date.now();
    await purchase.save();

    // Update inventories
    for (const item of purchase.items) {
      await ClinicInventory.findOneAndUpdate(
        { clinicId: purchase.clinicId, productId: item.productId._id },
        { $inc: { quantity: item.quantity } },
        { upsert: true }
      );

      await Product.findByIdAndUpdate(item.productId._id, {
        $inc: { stock: -item.quantity },
      });
    }

    res.json({ success: true, message: "Test payment verified and inventory updated" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

