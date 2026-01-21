import LabVendor from "../model/LabVendor.js";
import axios from "axios";

const createLabVendor = async (req, res) => {
  try {
    const { name, contactPerson, email, services, isActive } = req.body;

    // Basic manual validations
    if (!name || name.trim().length < 2) {
      return res.status(400).json({
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
      type: "external",
      isActive,
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
const createAlignerVendor = async (req, res) => {
  try {
    const { name, contactPerson, email, services, isActive } = req.body;

    // Basic manual validations
    if (!name || name.trim().length < 2) {
      return res.status(400).json({
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
      type: "aligner",
      isActive,
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
const createInHouseLabVendor = async (req, res) => {
  const { name, contactPerson, email, services, isActive, clinicId } = req.body;

  try {
    if (!clinicId) {
      return res
        .status(400)
        .json({ message: "Clinic ID is required for in-house vendors" });
    }
    
    // 1️⃣ Create lab vendor
    const vendor = new LabVendor({
      name: name.trim(),
      contactPerson: contactPerson?.trim(),
      email: email?.trim(),
      services,
      type: "inHouse",
      clinicId,
      isActive,
    });

    await vendor.save();

    const labId = vendor._id;

    // 2️⃣ Update Clinic Microservice
    try {
      const clinicUpdate = await axios.patch(
        `http://localhost:8001/api/v1/auth/clinic/add-ownlabs/${clinicId}`,
        { labId }
      );

      // 3️⃣ Final response back to client
      return res.status(201).json({
        message: "In-house lab vendor created and linked successfully",
        vendor,
        clinicUpdate: clinicUpdate.data,
      });

    } catch (error) {
      console.error("Clinic update error:", error);
      return res
        .status(500)
        .json({ message: "Vendor created, but failed to link with clinic" });
    }

  } catch (error) {
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((err) => err.message);
      return res.status(400).json({ message: messages.join(", ") });
    }
    return res.status(500).json({ message: error.message });
  }
};

const getLabByClinicId = async (req, res) => {
  try {
    const { clinicId } = req.params;
    const vendor = await LabVendor.find({ clinicId });
    if (!vendor || vendor.length === 0) {
      return res.status(404).json({ message: "Lab not found for this clinic" });
    }
    res.status(200).json(vendor);
  } catch (error) {
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

// NEW: Get only in-house lab vendors
const getInHouseLabVendors = async (req, res) => {
  try {
    const vendors = await LabVendor.find({ type: "inHouse" }).sort({ createdAt: -1 });
    res.status(200).json(vendors);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// NEW: Get only external lab vendors
const getExternalLabVendors = async (req, res) => {
  try {
    const vendors = await LabVendor.find({ type: "external" }).sort({ createdAt: -1 });
    res.status(200).json(vendors);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


const getAlignerVendors = async (req, res) => {
  try {
    const vendors = await LabVendor.find({ type: "aligner" }).sort({ createdAt: -1 });
    res.status(200).json(vendors);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


// NEW: Get in-house labs by specific clinic ID
const getInHouseLabsByClinicId = async (req, res) => {
  try {
    const { clinicId } = req.params;
    const vendors = await LabVendor.find({ 
      type: "inHouse", 
      clinicId 
    }).sort({ createdAt: -1 });
    
    if (!vendors || vendors.length === 0) {
      return res.status(404).json({ 
        message: "No in-house labs found for this clinic" 
      });
    }
    
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
  deleteLabVendor,
  createInHouseLabVendor,
  getLabByClinicId,
  getInHouseLabVendors,
  getExternalLabVendors,
  getInHouseLabsByClinicId,
  createAlignerVendor,
  getAlignerVendors
};