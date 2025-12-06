import LabInventory from "../model/LabInventoryModel.js";

// ➕ ADD INVENTORY
export const addLabInventory = async (req, res) => {
  try {
    const { assignId, productId, productName, quantity } = req.body;
    const labId = assignId || null; // assignId is labId here
    console.log("this" ,labId);
    
    if (!labId || !productId || !productName || !quantity) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    // check if inventory already exists
    let existingItem = await LabInventory.findOne({ labId, productId });

    if (existingItem) {
      // update quantity
      existingItem.quantity += Number(quantity);
      existingItem.lowStock = existingItem.quantity < 15; // recalc low stock

      await existingItem.save();

      return res.status(200).json({
        message: "Quantity updated successfully",
        data: existingItem,
      });
    }

    // If not found → create new entry
    const newItem = await LabInventory.create({
      labId,
      productId,
      productName,
      quantity,
      lowStock: quantity < 15,
    });

    return res.status(201).json({
      message: "New product added to lab inventory",
      data: newItem,
    });

  } catch (error) {
    console.log("Add Inventory Error:", error);
    res.status(500).json({ message: "Server error", error });
  }
};

// 📌 GET ALL INVENTORY
export const getAllLabInventory = async (req, res) => {
    try {
        const data = await LabInventory.find();
        res.status(200).json(data);
    } catch (error) {
        console.log("Get All Error:", error);
        res.status(500).json({ message: "Server error", error });
    }
};

// 📌 GET INVENTORY BY LAB ID
export const getLabInventoryByLab = async (req, res) => {
    try {
        const { labId } = req.params;

        const data = await LabInventory.find({ labId });

        res.status(200).json(data);
    } catch (error) {
        console.log("Get By Lab Error:", error);
        res.status(500).json({ message: "Server error", error });
    }
};

// 🔧 PATCH INVENTORY
export const patchLabInventory = async (req, res) => {
    try {
        const updates = req.body;

        // AUTO LOW STOCK ON UPDATE
        if (updates.quantity !== undefined) {
            updates.lowStock = updates.quantity < 15;
        }

        const updated = await LabInventory.findByIdAndUpdate(
            req.params.id,
            updates,
            { new: true }
        );

        res.status(200).json(updated);
    } catch (error) {
        console.log("PATCH ERROR:", error);
        res.status(500).json({ message: "Server error", error });
    }
};

// ❌ DELETE INVENTORY
export const deleteLabInventory = async (req, res) => {
    try {
        const { id } = req.params;

        await LabInventory.findByIdAndDelete(id);

        res.status(200).json({ message: "Deleted successfully" });
    } catch (error) {
        console.log("Delete Error:", error);
        res.status(500).json({ message: "Server error", error });
    }
};

// 📌 GET ALL LOW STOCK PRODUCTS (quantity < 15)
export const getLowStockProducts = async (req, res) => {
    try {
        const lowStockItems = await LabInventory.find({ lowStock: true });

        res.status(200).json(lowStockItems);
    } catch (error) {
        console.log("Low Stock Error:", error);
        res.status(500).json({ message: "Server error", error });
    }
};
// 🔄 UPDATE LAB INVENTORY (Full Update)
export const updateLabInventory = async (req, res) => {
    try {
        const { id } = req.params;
        const { labId, productName, quantity } = req.body;

        // Auto low-stock calculation
        let lowStock;
        if (quantity !== undefined) {
            lowStock = quantity < 15;
        }

        const updates = {
            ...(labId && { labId }),
            ...(productName && { productName }),
            ...(quantity !== undefined && { quantity }),
            ...(lowStock !== undefined && { lowStock })
        };

        const updatedItem = await LabInventory.findByIdAndUpdate(
            id,
            updates,
            { new: true }
        );

        if (!updatedItem) {
            return res.status(404).json({ message: "Inventory item not found" });
        }

        res.status(200).json({
            message: "Lab inventory updated successfully",
            updatedItem
        });

    } catch (error) {
        console.log("Update Inventory Error:", error);
        res.status(500).json({ message: "Server error", error });
    }
};