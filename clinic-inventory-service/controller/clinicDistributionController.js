
import ClinicInventory from "../models/ClinicInventory.js";
import DepartmentInventory from "../models/DepartmentInventory.js";

export const distributeToDepartment = async (req, res) => {
  try {
    const { clinicId, productId, quantity, department } = req.body;

    const clinicItem = await ClinicInventory.findOne({ clinicId, productId });
    if (!clinicItem || clinicItem.quantity < quantity)
      return res.status(400).json({ message: "Insufficient stock in clinic inventory" });

    // Reduce clinic inventory
    await ClinicInventory.updateOne(
      { clinicId, productId },
      { $inc: { quantity: -quantity } }
    );

    // Add to department inventory
    await DepartmentInventory.findOneAndUpdate(
      { clinicId, department, productId },
      { $inc: { quantity } },
      { upsert: true }
    );

    res.json({ success: true, message: "Distributed successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get department inventory
export const getDepartmentInventory = async (req, res) => {
  try {
    const { clinicId, department } = req.params;
    const items = await DepartmentInventory.find({ clinicId, department })
      .populate("productId");
    res.json({ success: true, items });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
