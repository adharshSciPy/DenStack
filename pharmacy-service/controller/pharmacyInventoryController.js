import PharmacyInventory from "../model/PharmacyInventoryModel.js";
import PharmacyVendor from "../model/PharmacyVendor.js";

// ===================================================================
// Validate clinic → pharmacy relation
// ===================================================================
const validateClinicPharmacy = async (clinicId, pharmacyId) => {
  const pharmacy = await PharmacyVendor.findById(pharmacyId);

  if (!pharmacy) return { error: "Pharmacy not found" };

  if (pharmacy.clinicId.toString() !== clinicId)
    return { error: "This pharmacy does not belong to this clinic" };

  return { pharmacy };
};

// ===================================================================
// ADD INVENTORY ITEM (MERGE IF SAME PRODUCT + BATCH)
// ===================================================================
export const addPharmacyInventory = async (req, res) => {
  try {
    console.log("REQ BODY RECEIVED IN PHARMACY SERVICE:", req.body);
    const { clinicId, assignId, productName, productId, quantity } = req.body;
    const  pharmacyId  = assignId || "";
    console.log("pharmacyId", pharmacyId);
    // assignId is pharmacyId here

    if (!pharmacyId)
      return res
        .status(400)
        .json({ message: "clinicId and pharmacyId are required" });

    // Validate relation
    const { error } = await validateClinicPharmacy(clinicId, pharmacyId);
    if (error) return res.status(400).json({ message: error });

    // Check if same product + batch exists → MERGE
    const existingItem = await PharmacyInventory.findOne({
      clinicId,
      productId,
    });

    if (existingItem) {
      existingItem.quantity += quantity ?? 0;

      await existingItem.save();

      return res.status(200).json({
        message: "Existing product+batch found. Merged successfully.",
        data: existingItem,
      });
    }

    // Create new item
    const newItem = await PharmacyInventory.create({
      clinicId,
      pharmacyId,
      productId,
      productName,
      quantity,
    });

    res.status(201).json({
      message: "Inventory added successfully",
      data: newItem,
    });
  } catch (err) {
    console.error("ADD INVENTORY ERROR:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ===================================================================
// GET ALL INVENTORY IN ONE PHARMACY
// ===================================================================
export const getPharmacyInventory = async (req, res) => {
  try {
    const { pharmacyId } = req.params;

    const items = await PharmacyInventory.find({ pharmacyId }).sort({
      productName: 1,
    });

    res.status(200).json(items);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ===================================================================
// GET INVENTORY ITEM BY ID
// ===================================================================
export const getPharmacyInventoryById = async (req, res) => {
  try {
    const item = await PharmacyInventory.findById(req.params.id);

    if (!item) return res.status(404).json({ message: "Item not found" });

    res.status(200).json(item);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ===================================================================
// UPDATE INVENTORY ITEM (MERGE IF SAME PRODUCT + SAME BATCH)
// ===================================================================
export const updatePharmacyInventory = async (req, res) => {
  try {
    const { productName, pharmacyId, batchNumber, quantity } = req.body;

    // Current item
    const currentItem = await PharmacyInventory.findById(req.params.id);
    if (!currentItem)
      return res.status(404).json({ message: "Item not found" });

    // Find another matching product (name + batch + pharmacy)
    const existing = await PharmacyInventory.findOne({
      _id: { $ne: req.params.id },
      pharmacyId,
      productName,
    });

    if (existing) {
      // MERGE LOGIC
      existing.quantity += quantity ?? 0;

      if (req.body.expiryDate) existing.expiryDate = req.body.expiryDate;
      if (req.body.price) existing.price = req.body.price;

      await existing.save();

      // Delete duplicate
      await PharmacyInventory.findByIdAndDelete(req.params.id);

      return res.status(200).json({
        message: "Merged with existing inventory item",
        data: existing,
      });
    }

    // Normal update
    const updated = await PharmacyInventory.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );

    res.status(200).json({
      message: "Inventory updated successfully",
      data: updated,
    });
  } catch (err) {
    console.error("UPDATE ERROR:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ===================================================================
// REDUCE STOCK
// ===================================================================
export const reducePharmacyStock = async (req, res) => {
  try {
    const { quantity } = req.body;

    const item = await PharmacyInventory.findById(req.params.id);
    if (!item) return res.status(404).json({ message: "Item not found" });

    if (item.quantity < quantity)
      return res.status(400).json({ message: "Not enough stock available" });

    item.quantity -= quantity;
    await item.save();

    res.status(200).json({
      message: "Stock reduced",
      remainingStock: item.quantity,
      isLowStock: item.quantity < 15,
    });
  } catch (err) {
    console.error("REDUCE STOCK ERROR:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ===================================================================
// DELETE INVENTORY ITEM
// ===================================================================
export const deletePharmacyInventory = async (req, res) => {
  try {
    const deleted = await PharmacyInventory.findByIdAndDelete(req.params.id);

    if (!deleted) return res.status(404).json({ message: "Item not found" });

    res.status(200).json({ message: "Item deleted successfully" });
  } catch (err) {
    console.error("DELETE ERROR:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ===================================================================
// GET LOW STOCK ITEMS
// ===================================================================
export const getLowStockItems = async (req, res) => {
  try {
    const { pharmacyId } = req.params;

    const items = await PharmacyInventory.find({
      pharmacyId,
      quantity: { $lt: 15 },
    });

    res.status(200).json({
      message: "Low stock items",
      totalLowStock: items.length,
      items,
    });
  } catch (err) {
    console.error("LOW STOCK ERROR:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};
