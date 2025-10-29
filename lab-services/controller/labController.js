import LabVendor from "../model/LabVendor.js";

const createLabVendor = async (req, res) => {
  try {
    const { name, contactPerson, email, services, isActive } =
      req.body;

    // Basic manual validations
    if (!name || name.trim().length < 2) {
      return res
        .status(400)
        .json({
          message:
            "Vendor name is required and must be at least 2 characters long",
        });
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ message: "Invalid email format" });
    }

    
    const vendor = new LabVendor({
      name: name.trim(),
      contactPerson: contactPerson?.trim(),
      email: email?.trim(),
      services,
      isActive
    });

    await vendor.save();

    res.status(201).json({
      message: "Lab vendor created successfully",
      vendor,
    });
  } catch (error) {
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((err) => err.message);
      return res.status(400).json({ message: messages.join(", ") });
    }
    res.status(500).json({ message: error.message });
  }
};

const getAllLabVendors = async (req, res) => {
  try {
    const vendors = await LabVendor.find().sort({ createdAt: -1 });
    res.status(200).json(vendors);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
const getLabVendorById = async (req, res) => {
  try {
    const vendor = await LabVendor.findById(req.params.id);
    if (!vendor) return res.status(404).json({ message: "Vendor not found" });
    res.status(200).json(vendor);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
const updateLabVendor = async (req, res) => {
  try {
    const updatedVendor = await LabVendor.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!updatedVendor)
      return res.status(404).json({ message: "Vendor not found" });
    res.json({ message: "Vendor updated successfully", vendor: updatedVendor });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
const deleteLabVendor = async (req, res) => {
  try {
    const vendor = await LabVendor.findByIdAndDelete(req.params.id);
    if (!vendor) return res.status(404).json({ message: "Vendor not found" });
    res.json({ message: "Vendor deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


export {
  createLabVendor,
  getAllLabVendors,
  getLabVendorById,
  updateLabVendor,
  deleteLabVendor
};
