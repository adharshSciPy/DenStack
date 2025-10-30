import ClinicInventory from "../models/ClinicInventory.js";

export const getClinicInventory = async (req, res) => {
  try {
    const { clinicId } = req.params;
    const inventory = await ClinicInventory.find({ clinicId }).populate("productId");
    res.json({ success: true, inventory });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
