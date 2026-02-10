// controllers/patientComplaintController.js
import PatientComplaint from "../model/patientComplaint.js";

// Create new patient complaint
export const createPatientComplaint = async (req, res) => {
  try {
    const { name, description } = req.body;
    const clinicId = req.clinicId;

    // ===== Validations =====
    if (!name || name.trim() === "") {
      return res.status(400).json({ 
        success: false, 
        message: "Complaint name is required" 
      });
    }

    // ===== Check if complaint already exists =====
    const existingComplaint = await PatientComplaint.findOne({
      clinicId,
      name: { $regex: new RegExp(`^${name.trim()}$`, 'i') },
      isActive: true
    });

    if (existingComplaint) {
      return res.status(400).json({ 
        success: false, 
        message: "Patient complaint with this name already exists in your clinic" 
      });
    }

    // ===== Create new complaint =====
    const newComplaint = await PatientComplaint.create({
      clinicId,
      name: name.trim(),
      description: description?.trim() || name.trim(),
      createdBy: req.userId,
      isActive: true
    });

    res.status(201).json({
      success: true,
      message: "Patient complaint created successfully",
      data: newComplaint
    });

  } catch (error) {
    console.error("❌ Error in createPatientComplaint:", error);
    res.status(500).json({ 
      success: false, 
      message: "Server error", 
      error: error.message 
    });
  }
};

// Get all patient complaints
export const getAllPatientComplaints = async (req, res) => {
  try {
    const clinicId = req.clinicId;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || "";
    const skip = (page - 1) * limit;

    // ===== Build query =====
    const query = { clinicId, isActive: true };
    
    if (search && search.trim() !== "") {
      query.$or = [
        { name: { $regex: search.trim(), $options: 'i' } },
        { description: { $regex: search.trim(), $options: 'i' } }
      ];
    }

    // ===== Execute query =====
    const complaints = await PatientComplaint.find(query)
      .sort({ name: 1 })
      .skip(skip)
      .limit(limit)
      .select('name description createdAt updatedAt')
      .lean();

    // ===== Get total count =====
    const total = await PatientComplaint.countDocuments(query);

    res.status(200).json({
      success: true,
      data: complaints,
      pagination: {
        currentPage: page,
        itemsPerPage: limit,
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        hasNextPage: page < Math.ceil(total / limit),
        hasPreviousPage: page > 1
      }
    });

  } catch (error) {
    console.error("❌ Error in getAllPatientComplaints:", error);
    res.status(500).json({ 
      success: false, 
      message: "Server error", 
      error: error.message 
    });
  }
};

// Get patient complaint by ID
export const getPatientComplaintById = async (req, res) => {
  try {
    const { id } = req.params;
    const clinicId = req.clinicId;

    if (!id) {
      return res.status(400).json({ 
        success: false, 
        message: "Complaint ID is required" 
      });
    }

    const complaint = await PatientComplaint.findOne({ 
      _id: id, 
      clinicId,
      isActive: true 
    }).select('name description createdAt updatedAt');

    if (!complaint) {
      return res.status(404).json({ 
        success: false, 
        message: "Patient complaint not found" 
      });
    }

    res.status(200).json({
      success: true,
      data: complaint
    });

  } catch (error) {
    console.error("❌ Error in getPatientComplaintById:", error);
    
    if (error.name === 'CastError') {
      return res.status(400).json({ 
        success: false, 
        message: "Invalid complaint ID format" 
      });
    }
    
    res.status(500).json({ 
      success: false, 
      message: "Server error", 
      error: error.message 
    });
  }
};

// Update patient complaint
export const updatePatientComplaint = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;
    const clinicId = req.clinicId;

    if (!id) {
      return res.status(400).json({ 
        success: false, 
        message: "Complaint ID is required" 
      });
    }

    // ===== Find the complaint =====
    const complaint = await PatientComplaint.findOne({ 
      _id: id, 
      clinicId 
    });

    if (!complaint) {
      return res.status(404).json({ 
        success: false, 
        message: "Patient complaint not found" 
      });
    }

    // ===== Check for name conflict =====
    if (name && name.trim() !== complaint.name) {
      const existingComplaint = await PatientComplaint.findOne({
        clinicId,
        name: { $regex: new RegExp(`^${name.trim()}$`, 'i') },
        _id: { $ne: id },
        isActive: true
      });

      if (existingComplaint) {
        return res.status(400).json({ 
          success: false, 
          message: "Another patient complaint with this name already exists" 
        });
      }
    }

    // ===== Update fields =====
    if (name !== undefined) complaint.name = name.trim();
    if (description !== undefined) complaint.description = description.trim();

    await complaint.save();

    res.status(200).json({
      success: true,
      message: "Patient complaint updated successfully",
      data: {
        id: complaint._id,
        name: complaint.name,
        description: complaint.description,
        updatedAt: complaint.updatedAt
      }
    });

  } catch (error) {
    console.error("❌ Error in updatePatientComplaint:", error);
    
    if (error.name === 'CastError') {
      return res.status(400).json({ 
        success: false, 
        message: "Invalid complaint ID format" 
      });
    }
    
    res.status(500).json({ 
      success: false, 
      message: "Server error", 
      error: error.message 
    });
  }
};

// Delete patient complaint
export const deletePatientComplaint = async (req, res) => {
  try {
    const { id } = req.params;
    const clinicId = req.clinicId;

    if (!id) {
      return res.status(400).json({ 
        success: false, 
        message: "Complaint ID is required" 
      });
    }

    const complaint = await PatientComplaint.findOne({ 
      _id: id, 
      clinicId 
    });

    if (!complaint) {
      return res.status(404).json({ 
        success: false, 
        message: "Patient complaint not found" 
      });
    }

    // ===== Soft delete =====
    complaint.isActive = false;
    await complaint.save();

    res.status(200).json({
      success: true,
      message: "Patient complaint deleted successfully"
    });

  } catch (error) {
    console.error("❌ Error in deletePatientComplaint:", error);
    
    if (error.name === 'CastError') {
      return res.status(400).json({ 
        success: false, 
        message: "Invalid complaint ID format" 
      });
    }
    
    res.status(500).json({ 
      success: false, 
      message: "Server error", 
      error: error.message 
    });
  }
};