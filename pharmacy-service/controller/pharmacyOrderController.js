import PharmacyOrder from "../models/PharmacyOrder.js";

// Create Pharmacy Order
import PharmacyOrder from "../models/PharmacyOrder.js";
import Patient from "../models/Patient.js";
import Medicine from "../models/Medicine.js";

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

      if (medicine.stockQuantity < item.quantity) {
        return res
          .status(400)
          .json({ message: `Insufficient stock for ${medicine.name}` });
      }

      // Reduce stock
      medicine.stockQuantity -= item.quantity;
      if (medicine.stockQuantity <= 0) medicine.status = "out-of-stock";
      await medicine.save();

      const totalPrice = item.quantity * medicine.pricePerUnit;
      totalAmount += totalPrice;

      prescriptionItems.push({
        medicineName: medicine.name,
        dosage: item.dosage,
        quantity: item.quantity,
        pricePerUnit: medicine.pricePerUnit,
        totalPrice,
      });
    }

    // Create order
    const order = new PharmacyOrder({
      patientId,
      doctorId,
      vendorId,
      prescriptionItems,
      totalAmount,
      status: "pending",
    });

    await order.save();

    await Patient.findByIdAndUpdate(patientId, {
      $push: { pharmacyOrders: order._id },
    });

    res.status(201).json({ message: "Pharmacy order created", order });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


// Get All Orders
export const getAllPharmacyOrders = async (req, res) => {
  try {
    const orders = await PharmacyOrder.find()
      .populate("patientId", "name age")
      .populate("doctorId", "name specialization")
      .populate("vendorId", "name");
    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get Single Order
export const getPharmacyOrderById = async (req, res) => {
  try {
    const order = await PharmacyOrder.findById(req.params.id)
      .populate("patientId")
      .populate("doctorId")
      .populate("vendorId");
    res.json(order);
  } catch (error) {
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
