import purchaseOrder from "../model/purchaseOrder.js";
import InventoryItem from "../model/inventoryItem.js";


export const createPurchase = async (req, res) => {
  try {
    const { clinicId, supplierName, invoiceNumber, items } = req.body;

    if (!clinicId || !supplierName || !items?.length) {
      return res
        .status(400)
        .json({ success: false, message: "Missing required fields" });
    }

    // Calculate total amount
    let totalAmount = 0;
    for (let item of items) {
      item.totalCost = item.quantity * item.unitCost;
      totalAmount += item.totalCost;
    }

    // Create purchase entry
    const purchase = await purchaseOrder.create({
      clinicId,
      supplierName,
      invoiceNumber,
      items,
      totalAmount,
    });

    // Update Inventory stock
    for (let pItem of items) {
      const invItem = await InventoryItem.findById(pItem.itemId);
      if (invItem) {
        invItem.currentStock += pItem.quantity;
        invItem.unitCost = pItem.unitCost; // update cost if changed
        await invItem.save();
      }
    }

    res
      .status(201)
      .json({ success: true, message: "Purchase recorded", purchase });
  } catch (error) {
    console.error("Error creating purchase:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};