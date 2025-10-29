import axios from "axios";
import StockTransfer from "../model/stockTransfer.js";
import InventoryItem from "../model/inventoryItem.js";

export const transferToLabService = async (req, res) => {
  try {
    const { clinicId, itemId, labInventoryId, quantity, transferredBy } =
      req.body;

    // 1️⃣ Validate
    if (
      !clinicId ||
      !itemId ||
      !labInventoryId ||
      !quantity ||
      !transferredBy
    ) {
      return res
        .status(400)
        .json({ success: false, message: "Missing required fields" });
    }

    const item = await InventoryItem.findById(itemId);
    if (!item)
      return res
        .status(404)
        .json({ success: false, message: "Item not found" });

    if (item.currentStock < quantity)
      return res
        .status(400)
        .json({ success: false, message: "Insufficient stock" });

    // 2️⃣ Call Lab Service API to add stock
    const labResponse = await axios.post(
      `${process.env.LAB_SERVICE_URL}lab-inventory/add-item`,
      {
        clinicId,
        itemName: item.name,
        quantity,
        unit: item.unit || "pcs",
        // category: labCategory,
        threshold: item.minimumStock,
        lastUpdatedBy: transferredBy,
      }
    );

    if (labResponse.data.success) {
      // 3️⃣ Deduct stock in clinic
      item.currentStock -= quantity;
      await item.save();

      // 4️⃣ Create StockTransfer record
      const transfer = await StockTransfer.create({
        clinicId,
        item: item._id,
        from: "Clinic Inventory",
        to: "LabService",
        toService: "LabService",
        quantity,
        transferredBy,
        reference: labInventoryId,
      });

      // 5️⃣ Notification
      

      return res.status(201).json({ success: true, transfer });
    }

    return res
      .status(500)
      .json({ success: false, message: "Lab service failed to add stock" });
  } catch (error) {
    console.error("Error transferring stock to Lab Service:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};
