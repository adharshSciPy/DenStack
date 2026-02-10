// controllers/medicalHistoryController.js
import MedicalHistory from "../model/medicalHistory.js";

// Create new medical history
export const createMedicalHistory = async (req, res) => {
  try {
    const { name, description } = req.body;
    const clinicId = req.clinicId;

    // ===== Validations =====
    if (!name || name.trim() === "") {
      return res.status(400).json({ 
        success: false, 
        message: "Medical history name is required" 
      });
    }

    // ===== Check if medical history already exists =====
    const existingMedicalHistory = await MedicalHistory.findOne({
      clinicId,
      name: { $regex: new RegExp(`^${name.trim()}$`, 'i') },
      isActive: true
    });

    if (existingMedicalHistory) {
      return res.status(400).json({ 
        success: false, 
        message: "Medical history with this name already exists in your clinic" 
      });
    }

    // ===== Create new medical history =====
    const newMedicalHistory = await MedicalHistory.create({
      clinicId,
      name: name.trim(),
      description: description?.trim() || name.trim(),
      createdBy: req.userId,
      isActive: true
    });

    res.status(201).json({
      success: true,
      message: "Medical history created successfully",
      data: newMedicalHistory
    });

  } catch (error) {
    console.error("❌ Error in createMedicalHistory:", error);
    res.status(500).json({ 
      success: false, 
      message: "Server error", 
      error: error.message 
    });
  }
};

// Get all medical histories
export const getAllMedicalHistories = async (req, res) => {
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
    const medicalHistories = await MedicalHistory.find(query)
      .sort({ name: 1 })
      .skip(skip)
      .limit(limit)
      .select('name description createdAt updatedAt')
      .lean();

    // ===== Get total count =====
    const total = await MedicalHistory.countDocuments(query);

    res.status(200).json({
      success: true,
      data: medicalHistories,
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
    console.error("❌ Error in getAllMedicalHistories:", error);
    res.status(500).json({ 
      success: false, 
      message: "Server error", 
      error: error.message 
    });
  }
};

// Get medical history by ID
export const getMedicalHistoryById = async (req, res) => {
  try {
    const { id } = req.params;
    const clinicId = req.clinicId;

    if (!id) {
      return res.status(400).json({ 
        success: false, 
        message: "Medical history ID is required" 
      });
    }

    const medicalHistory = await MedicalHistory.findOne({ 
      _id: id, 
      clinicId,
      isActive: true 
    }).select('name description createdAt updatedAt');

    if (!medicalHistory) {
      return res.status(404).json({ 
        success: false, 
        message: "Medical history not found" 
      });
    }

    res.status(200).json({
      success: true,
      data: medicalHistory
    });

  } catch (error) {
    console.error("❌ Error in getMedicalHistoryById:", error);
    
    if (error.name === 'CastError') {
      return res.status(400).json({ 
        success: false, 
        message: "Invalid medical history ID format" 
      });
    }
    
    res.status(500).json({ 
      success: false, 
      message: "Server error", 
      error: error.message 
    });
  }
};

// Update medical history
export const updateMedicalHistory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;
    const clinicId = req.clinicId;

    if (!id) {
      return res.status(400).json({ 
        success: false, 
        message: "Medical history ID is required" 
      });
    }

    // ===== Find the medical history =====
    const medicalHistory = await MedicalHistory.findOne({ 
      _id: id, 
      clinicId 
    });

    if (!medicalHistory) {
      return res.status(404).json({ 
        success: false, 
        message: "Medical history not found" 
      });
    }

    // ===== Check for name conflict =====
    if (name && name.trim() !== medicalHistory.name) {
      const existingMedicalHistory = await MedicalHistory.findOne({
        clinicId,
        name: { $regex: new RegExp(`^${name.trim()}$`, 'i') },
        _id: { $ne: id },
        isActive: true
      });

      if (existingMedicalHistory) {
        return res.status(400).json({ 
          success: false, 
          message: "Another medical history with this name already exists" 
        });
      }
    }

    // ===== Update fields =====
    if (name !== undefined) medicalHistory.name = name.trim();
    if (description !== undefined) medicalHistory.description = description.trim();

    await medicalHistory.save();

    res.status(200).json({
      success: true,
      message: "Medical history updated successfully",
      data: {
        id: medicalHistory._id,
        name: medicalHistory.name,
        description: medicalHistory.description,
        updatedAt: medicalHistory.updatedAt
      }
    });

  } catch (error) {
    console.error("❌ Error in updateMedicalHistory:", error);
    
    if (error.name === 'CastError') {
      return res.status(400).json({ 
        success: false, 
        message: "Invalid medical history ID format" 
      });
    }
    
    res.status(500).json({ 
      success: false, 
      message: "Server error", 
      error: error.message 
    });
  }
};

// Delete medical history
export const deleteMedicalHistory = async (req, res) => {
  try {
    const { id } = req.params;
    const clinicId = req.clinicId;

    if (!id) {
      return res.status(400).json({ 
        success: false, 
        message: "Medical history ID is required" 
      });
    }

    const medicalHistory = await MedicalHistory.findOne({ 
      _id: id, 
      clinicId 
    });

    if (!medicalHistory) {
      return res.status(404).json({ 
        success: false, 
        message: "Medical history not found" 
      });
    }

    // ===== Soft delete =====
    medicalHistory.isActive = false;
    await medicalHistory.save();

    res.status(200).json({
      success: true,
      message: "Medical history deleted successfully"
    });

  } catch (error) {
    console.error("❌ Error in deleteMedicalHistory:", error);
    
    if (error.name === 'CastError') {
      return res.status(400).json({ 
        success: false, 
        message: "Invalid medical history ID format" 
      });
    }
    
    res.status(500).json({ 
      success: false, 
      message: "Server error", 
      error: error.message 
    });
  }
};