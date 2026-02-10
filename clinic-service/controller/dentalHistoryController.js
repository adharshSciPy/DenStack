// controllers/dentalHistoryController.js
import DentalHistory from "../model/dentalHistory.js";

// Create new dental history
export const createDentalHistory = async (req, res) => {
  try {
    const { name, description } = req.body;
    const clinicId = req.clinicId;

    // ===== Validations =====
    if (!name || name.trim() === "") {
      return res.status(400).json({ 
        success: false, 
        message: "Dental history name is required" 
      });
    }

    // ===== Check if dental history already exists for this clinic =====
    const existingHistory = await DentalHistory.findOne({
      clinicId,
      name: { $regex: new RegExp(`^${name.trim()}$`, 'i') },
      isActive: true
    });

    if (existingHistory) {
      return res.status(400).json({ 
        success: false, 
        message: "Dental history with this name already exists in your clinic" 
      });
    }

    // ===== Create new dental history =====
    const newHistory = await DentalHistory.create({
      clinicId,
      name: name.trim(),
      description: description?.trim() || name.trim(),
      createdBy: req.userId,
      isActive: true
    });

    res.status(201).json({
      success: true,
      message: "Dental history created successfully",
      data: newHistory
    });

  } catch (error) {
    console.error("❌ Error in createDentalHistory:", error);
    res.status(500).json({ 
      success: false, 
      message: "Server error", 
      error: error.message 
    });
  }
};

// Get all dental histories with pagination and search
export const getAllDentalHistories = async (req, res) => {
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

    // ===== Execute query with pagination =====
    const histories = await DentalHistory.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select('name description createdAt updatedAt')
      .lean();

    // ===== Get total count =====
    const total = await DentalHistory.countDocuments(query);

    res.status(200).json({
      success: true,
      data: histories,
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
    console.error("❌ Error in getAllDentalHistories:", error);
    res.status(500).json({ 
      success: false, 
      message: "Server error", 
      error: error.message 
    });
  }
};

// Get dental history by ID
export const getDentalHistoryById = async (req, res) => {
  try {
    const { id } = req.params;
    const clinicId = req.clinicId;

    if (!id) {
      return res.status(400).json({ 
        success: false, 
        message: "Dental history ID is required" 
      });
    }

    const history = await DentalHistory.findOne({ 
      _id: id, 
      clinicId,
      isActive: true 
    }).select('name description createdAt updatedAt');

    if (!history) {
      return res.status(404).json({ 
        success: false, 
        message: "Dental history not found" 
      });
    }

    res.status(200).json({
      success: true,
      data: history
    });

  } catch (error) {
    console.error("❌ Error in getDentalHistoryById:", error);
    
    if (error.name === 'CastError') {
      return res.status(400).json({ 
        success: false, 
        message: "Invalid dental history ID format" 
      });
    }
    
    res.status(500).json({ 
      success: false, 
      message: "Server error", 
      error: error.message 
    });
  }
};

// Update dental history
export const updateDentalHistory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;
    const clinicId = req.clinicId;

    if (!id) {
      return res.status(400).json({ 
        success: false, 
        message: "Dental history ID is required" 
      });
    }

    // ===== Find the dental history =====
    const history = await DentalHistory.findOne({ 
      _id: id, 
      clinicId 
    });

    if (!history) {
      return res.status(404).json({ 
        success: false, 
        message: "Dental history not found" 
      });
    }

    // ===== Check for name conflict if name is being changed =====
    if (name && name.trim() !== history.name) {
      const existingHistory = await DentalHistory.findOne({
        clinicId,
        name: { $regex: new RegExp(`^${name.trim()}$`, 'i') },
        _id: { $ne: id },
        isActive: true
      });

      if (existingHistory) {
        return res.status(400).json({ 
          success: false, 
          message: "Another dental history with this name already exists in your clinic" 
        });
      }
    }

    // ===== Update fields =====
    if (name !== undefined) history.name = name.trim();
    if (description !== undefined) history.description = description.trim();

    await history.save();

    res.status(200).json({
      success: true,
      message: "Dental history updated successfully",
      data: {
        id: history._id,
        name: history.name,
        description: history.description,
        updatedAt: history.updatedAt
      }
    });

  } catch (error) {
    console.error("❌ Error in updateDentalHistory:", error);
    
    if (error.name === 'CastError') {
      return res.status(400).json({ 
        success: false, 
        message: "Invalid dental history ID format" 
      });
    }
    
    res.status(500).json({ 
      success: false, 
      message: "Server error", 
      error: error.message 
    });
  }
};

// Delete dental history (soft delete)
export const deleteDentalHistory = async (req, res) => {
  try {
    const { id } = req.params;
    const clinicId = req.clinicId;

    if (!id) {
      return res.status(400).json({ 
        success: false, 
        message: "Dental history ID is required" 
      });
    }

    const history = await DentalHistory.findOne({ 
      _id: id, 
      clinicId 
    });

    if (!history) {
      return res.status(404).json({ 
        success: false, 
        message: "Dental history not found" 
      });
    }

    // ===== Soft delete =====
    history.isActive = false;
    await history.save();

    res.status(200).json({
      success: true,
      message: "Dental history deleted successfully"
    });

  } catch (error) {
    console.error("❌ Error in deleteDentalHistory:", error);
    
    if (error.name === 'CastError') {
      return res.status(400).json({ 
        success: false, 
        message: "Invalid dental history ID format" 
      });
    }
    
    res.status(500).json({ 
      success: false, 
      message: "Server error", 
      error: error.message 
    });
  }
};

// Search dental histories
export const searchDentalHistories = async (req, res) => {
  try {
    const clinicId = req.clinicId;
    const query = req.query.q || "";
    const limit = parseInt(req.query.limit) || 20;

    if (!query || query.trim() === "") {
      return res.status(200).json({
        success: true,
        data: [],
        message: "Please enter a search term"
      });
    }

    const searchTerm = query.trim();

    const histories = await DentalHistory.find({
      clinicId,
      isActive: true,
      $or: [
        { name: { $regex: searchTerm, $options: 'i' } },
        { description: { $regex: searchTerm, $options: 'i' } }
      ]
    })
    .select('name description')
    .limit(limit)
    .sort({ name: 1 })
    .lean();

    res.status(200).json({
      success: true,
      data: histories,
      totalResults: histories.length
    });

  } catch (error) {
    console.error("❌ Error in searchDentalHistories:", error);
    res.status(500).json({ 
      success: false, 
      message: "Server error", 
      error: error.message 
    });
  }
};

// Add common dental history items
export const addCommonDentalHistories = async (req, res) => {
  try {
    const clinicId = req.clinicId;
    const userId = req.userId;

    const commonHistories = [
      { name: "Hot Response", description: "Hot Response" },
      { name: "Cold Response", description: "Cold Response" },
      { name: "Night Pain", description: "Night Pain" },
      { name: "Pain on Biting", description: "Pain on biting" },
      { name: "Pain on Sweet", description: "Pain on sweet" },
      { name: "Spontaneous Pain", description: "Spontaneous pain" },
      { name: "Radiating Pain", description: "Radiating pain" },
      { name: "Previous Root Canal", description: "Previous root canal treatment" },
      { name: "Previous Extraction", description: "Previous tooth extraction" },
      { name: "Previous Filling", description: "Previous dental filling" },
      { name: "Previous Crown", description: "Previous dental crown" },
      { name: "Previous Bridge", description: "Previous dental bridge" },
      { name: "Previous Denture", description: "Previous denture" },
      { name: "Previous Orthodontic Treatment", description: "Previous orthodontic treatment" },
      { name: "Bruxism History", description: "History of teeth grinding" },
      { name: "TMJ Issues", description: "Temporomandibular joint issues" }
    ];

    const createdHistories = [];
    
    for (const history of commonHistories) {
      const existing = await DentalHistory.findOne({
        clinicId,
        name: { $regex: new RegExp(`^${history.name}$`, 'i') },
        isActive: true
      });

      if (!existing) {
        const newHistory = await DentalHistory.create({
          clinicId,
          name: history.name,
          description: history.description,
          createdBy: userId,
          isActive: true
        });
        createdHistories.push(newHistory);
      }
    }

    res.status(201).json({
      success: true,
      message: `Added ${createdHistories.length} common dental histories`,
      data: createdHistories,
      skipped: commonHistories.length - createdHistories.length
    });

  } catch (error) {
    console.error("❌ Error in addCommonDentalHistories:", error);
    res.status(500).json({ 
      success: false, 
      message: "Server error", 
      error: error.message 
    });
  }
};