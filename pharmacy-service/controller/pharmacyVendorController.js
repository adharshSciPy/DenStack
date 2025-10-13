import PharmacyVendor from "../model/PharmacyVendor.js";

// Create Vendor
export const createVendor = async (req, res) => {
  try {
    const vendor = new PharmacyVendor(req.body);
    await vendor.save();
    res.status(201).json({ message: "Pharmacy vendor created", vendor });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get All Vendors
export const getVendors = async (req, res) => {
  try {
    const vendors = await PharmacyVendor.find();
    res.json(vendors);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update Vendor
export const updateVendor = async (req, res) => {
  try {
    const vendor = await PharmacyVendor.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json({ message: "Pharmacy vendor updated", vendor });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Delete Vendor
export const deleteVendor = async (req, res) => {
  try {
    await PharmacyVendor.findByIdAndDelete(req.params.id);
    res.json({ message: "Pharmacy vendor deleted" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export default { createVendor, getVendors, updateVendor, deleteVendor };