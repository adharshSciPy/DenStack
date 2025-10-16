

// Create Pharmacy Order
import PharmacyOrder from "../model/PharmacyOrder.js"
import Medicine from "../model/medicineSchema.js"

// 🧾 Create Pharmacy Order with Stock Management
export const createPharmacyOrder = async (req, res) => {
  try {
    const { patientId, doctorId, vendorId, items } = req.body;

    let prescriptionItems = [];
    let totalAmount = 0;

    for (const item of items) {
      const medicine = await Medicine.findById(item.medicineId);

      if (!medicine) {
        return res.status(404).json({ message: `Medicine not found` });
      }
      
      if (medicine.expiryDate) {
        const today = new Date();
        const expiryDate = new Date(medicine.expiryDate);
        const diffInDays = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24));

        if (diffInDays <= 7) {
          return res.status(400).json({
            message: `Cannot order ${medicine.name}, it expires in ${diffInDays} day(s).`,
          });
        }
      }

      // 🧮 Check stock
      if (medicine.stockQuantity < item.quantity) {
        return res.status(400).json({
          message: `Insufficient stock for ${medicine.name}`,
        });
      }

      // 📉 Reduce stock
      medicine.stockQuantity -= item.quantity;
      if (medicine.stockQuantity <= 0) medicine.status = "out-of-stock";
      await medicine.save();

      const totalPrice = item.quantity * medicine.pricePerUnit;
      totalAmount += totalPrice;

      prescriptionItems.push({
        medicineName: medicine.name,
        dosage: item.dosage,
        quantity: item.quantity,
        price: totalPrice,
      });
    }

    // 🧾 Create order
    const order = new PharmacyOrder({
      patientId,
      doctorId,
      vendorId,
      prescriptionItems,
      totalAmount,
    });

    await order.save();

    res.status(201).json({ message: "Pharmacy order created", order });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};



// Get All Orders
export const getAllPharmacyOrders = async (req, res) => {
  try {
    const orders = await PharmacyOrder.find().lean();
    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get Single Order - FIXED
export const getPharmacyOrderById = async (req, res) => {
  try {
    console.log("🔍 Fetching order:", req.params.id);
    
    const order = await PharmacyOrder.findById(req.params.id).lean();
    
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }
    
    console.log("✅ Order found, returning data");
    res.json(order);
  } catch (error) {
    console.error("❌ Error:", error.message);
    res.status(500).json({ message: error.message });
  }
};

// Update Order Status
export const updatePharmacyOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const order = await PharmacyOrder.findByIdAndUpdate(
      req.params.id,
      { status, deliveredAt: status === "delivered" ? Date.now() : null },
      { new: true }
    );

    res.json({ message: "Order status updated", order });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Delete Order
export const deletePharmacyOrder = async (req, res) => {
  try {
    await PharmacyOrder.findByIdAndDelete(req.params.id);
    res.json({ message: "Pharmacy order deleted" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
