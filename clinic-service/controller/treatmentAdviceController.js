// controllers/treatmentAdviceController.js
import TreatmentAdvice from "../model/treatmentAdvice.js";

// Create new treatment advice
export const createTreatmentAdvice = async (req, res) => {
  try {
    const { name, description } = req.body;
    const clinicId = req.clinicId;

    // ===== Validations =====
    if (!name || name.trim() === "") {
      return res.status(400).json({ 
        success: false, 
        message: "Treatment advice name is required" 
      });
    }

    // ===== Check if treatment advice already exists =====
    const existingAdvice = await TreatmentAdvice.findOne({
      clinicId,
      name: { $regex: new RegExp(`^${name.trim()}$`, 'i') },
      isActive: true
    });

    if (existingAdvice) {
      return res.status(400).json({ 
        success: false, 
        message: "Treatment advice with this name already exists in your clinic" 
      });
    }

    // ===== Create new treatment advice =====
    const newAdvice = await TreatmentAdvice.create({
      clinicId,
      name: name.trim(),
      description: description?.trim() || name.trim(),
      createdBy: req.userId,
      isActive: true
    });

    res.status(201).json({
      success: true,
      message: "Treatment advice created successfully",
      data: newAdvice
    });

  } catch (error) {
    console.error("❌ Error in createTreatmentAdvice:", error);
    res.status(500).json({ 
      success: false, 
      message: "Server error", 
      error: error.message 
    });
  }
};

// Get all treatment advices
export const getAllTreatmentAdvices = async (req, res) => {
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
    const advices = await TreatmentAdvice.find(query)
      .sort({ name: 1 })
      .skip(skip)
      .limit(limit)
      .select('name description createdAt updatedAt')
      .lean();

    // ===== Get total count =====
    const total = await TreatmentAdvice.countDocuments(query);

    res.status(200).json({
      success: true,
      data: advices,
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
    console.error("❌ Error in getAllTreatmentAdvices:", error);
    res.status(500).json({ 
      success: false, 
      message: "Server error", 
      error: error.message 
    });
  }
};

// Get treatment advice by ID
export const getTreatmentAdviceById = async (req, res) => {
  try {
    const { id } = req.params;
    const clinicId = req.clinicId;

    if (!id) {
      return res.status(400).json({ 
        success: false, 
        message: "Treatment advice ID is required" 
      });
    }

    const advice = await TreatmentAdvice.findOne({ 
      _id: id, 
      clinicId,
      isActive: true 
    }).select('name description createdAt updatedAt');

    if (!advice) {
      return res.status(404).json({ 
        success: false, 
        message: "Treatment advice not found" 
      });
    }

    res.status(200).json({
      success: true,
      data: advice
    });

  } catch (error) {
    console.error("❌ Error in getTreatmentAdviceById:", error);
    
    if (error.name === 'CastError') {
      return res.status(400).json({ 
        success: false, 
        message: "Invalid treatment advice ID format" 
      });
    }
    
    res.status(500).json({ 
      success: false, 
      message: "Server error", 
      error: error.message 
    });
  }
};

// Update treatment advice
export const updateTreatmentAdvice = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;
    const clinicId = req.clinicId;

    if (!id) {
      return res.status(400).json({ 
        success: false, 
        message: "Treatment advice ID is required" 
      });
    }

    // ===== Find the advice =====
    const advice = await TreatmentAdvice.findOne({ 
      _id: id, 
      clinicId 
    });

    if (!advice) {
      return res.status(404).json({ 
        success: false, 
        message: "Treatment advice not found" 
      });
    }

    // ===== Check for name conflict =====
    if (name && name.trim() !== advice.name) {
      const existingAdvice = await TreatmentAdvice.findOne({
        clinicId,
        name: { $regex: new RegExp(`^${name.trim()}$`, 'i') },
        _id: { $ne: id },
        isActive: true
      });

      if (existingAdvice) {
        return res.status(400).json({ 
          success: false, 
          message: "Another treatment advice with this name already exists" 
        });
      }
    }

    // ===== Update fields =====
    if (name !== undefined) advice.name = name.trim();
    if (description !== undefined) advice.description = description.trim();

    await advice.save();

    res.status(200).json({
      success: true,
      message: "Treatment advice updated successfully",
      data: {
        id: advice._id,
        name: advice.name,
        description: advice.description,
        updatedAt: advice.updatedAt
      }
    });

  } catch (error) {
    console.error("❌ Error in updateTreatmentAdvice:", error);
    
    if (error.name === 'CastError') {
      return res.status(400).json({ 
        success: false, 
        message: "Invalid treatment advice ID format" 
      });
    }
    
    res.status(500).json({ 
      success: false, 
      message: "Server error", 
      error: error.message 
    });
  }
};

// Delete treatment advice
export const deleteTreatmentAdvice = async (req, res) => {
  try {
    const { id } = req.params;
    const clinicId = req.clinicId;

    if (!id) {
      return res.status(400).json({ 
        success: false, 
        message: "Treatment advice ID is required" 
      });
    }

    const advice = await TreatmentAdvice.findOne({ 
      _id: id, 
      clinicId 
    });

    if (!advice) {
      return res.status(404).json({ 
        success: false, 
        message: "Treatment advice not found" 
      });
    }

    // ===== Soft delete =====
    advice.isActive = false;
    await advice.save();

    res.status(200).json({
      success: true,
      message: "Treatment advice deleted successfully"
    });

  } catch (error) {
    console.error("❌ Error in deleteTreatmentAdvice:", error);
    
    if (error.name === 'CastError') {
      return res.status(400).json({ 
        success: false, 
        message: "Invalid treatment advice ID format" 
      });
    }
    
    res.status(500).json({ 
      success: false, 
      message: "Server error", 
      error: error.message 
    });
  }
};