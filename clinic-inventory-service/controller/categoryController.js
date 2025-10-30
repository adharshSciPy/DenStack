import InventoryCategory from "../model/inventoryCategory.js";

export const createCategory = async (req, res) => {
  try {
    const { clinicId, name } = req.body;
    const category = await InventoryCategory.create({ clinicId, name });
    res.status(201).json({ success: true, category });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getCategories = async (req, res) => {
  try {
    const { clinicId } = req.params;

    if (!clinicId) {
      return res
        .status(400)
        .json({ success: false, message: "clinicId is required in params" });
    }

    const categories = await InventoryCategory.find({ clinicId }).sort({
      name: 1,
    });

    res.status(200).json({ success: true, categories });
  } catch (error) {
    console.error("Error fetching categories:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};