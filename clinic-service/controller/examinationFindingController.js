// controllers/examinationFindingController.js
import ExaminationFinding from "../model/examinationFinding.js";

export const createExaminationFinding = async (req, res) => {
  try {
    const { name, description } = req.body;
    const clinicId = req.clinicId;

    // ===== Validations =====
    if (!name || name.trim() === "") {
      return res.status(400).json({ 
        success: false, 
        message: "Examination finding name is required" 
      });
    }

    // ===== Check if finding already exists for this clinic =====
    const existingFinding = await ExaminationFinding.findOne({
      clinicId,
      name: { $regex: new RegExp(`^${name.trim()}$`, 'i') },
      isActive: true
    });

    if (existingFinding) {
      return res.status(400).json({ 
        success: false, 
        message: "Examination finding with this name already exists in your clinic" 
      });
    }

    // ===== Create new examination finding =====
    const newFinding = await ExaminationFinding.create({
      clinicId,
      name: name.trim(),
      description: description?.trim() || name.trim(),
      createdBy: req.userId,
      isActive: true
    });

    res.status(201).json({
      success: true,
      message: "Examination finding created successfully",
      data: newFinding
    });

  } catch (error) {
    console.error("❌ Error in createExaminationFinding:", error);
    res.status(500).json({ 
      success: false, 
      message: "Server error", 
      error: error.message 
    });
  }
};

export const getAllExaminationFindings = async (req, res) => {
  try {
    const clinicId = req.clinicId||req.query.clinicId;
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
    const findings = await ExaminationFinding.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select('name description createdAt updatedAt')
      .lean();

    // ===== Get total count =====
    const total = await ExaminationFinding.countDocuments(query);

    res.status(200).json({
      success: true,
      data: findings,
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
    console.error("❌ Error in getAllExaminationFindings:", error);
    res.status(500).json({ 
      success: false, 
      message: "Server error", 
      error: error.message 
    });
  }
};

export const getExaminationFindingById = async (req, res) => {
  try {
    const { id } = req.params;
    const clinicId = req.clinicId;

    if (!id) {
      return res.status(400).json({ 
        success: false, 
        message: "Examination finding ID is required" 
      });
    }

    const finding = await ExaminationFinding.findOne({ 
      _id: id, 
      clinicId,
      isActive: true 
    }).select('name description createdAt updatedAt');

    if (!finding) {
      return res.status(404).json({ 
        success: false, 
        message: "Examination finding not found" 
      });
    }

    res.status(200).json({
      success: true,
      data: finding
    });

  } catch (error) {
    console.error("❌ Error in getExaminationFindingById:", error);
    
    if (error.name === 'CastError') {
      return res.status(400).json({ 
        success: false, 
        message: "Invalid examination finding ID format" 
      });
    }
    
    res.status(500).json({ 
      success: false, 
      message: "Server error", 
      error: error.message 
    });
  }
};

export const updateExaminationFinding = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;
    const clinicId = req.clinicId;

    if (!id) {
      return res.status(400).json({ 
        success: false, 
        message: "Examination finding ID is required" 
      });
    }

    // ===== Find the examination finding =====
    const finding = await ExaminationFinding.findOne({ 
      _id: id, 
      clinicId 
    });

    if (!finding) {
      return res.status(404).json({ 
        success: false, 
        message: "Examination finding not found" 
      });
    }

    // ===== Check for name conflict if name is being changed =====
    if (name && name.trim() !== finding.name) {
      const existingFinding = await ExaminationFinding.findOne({
        clinicId,
        name: { $regex: new RegExp(`^${name.trim()}$`, 'i') },
        _id: { $ne: id },
        isActive: true
      });

      if (existingFinding) {
        return res.status(400).json({ 
          success: false, 
          message: "Another examination finding with this name already exists in your clinic" 
        });
      }
    }

    // ===== Update fields =====
    if (name !== undefined) finding.name = name.trim();
    if (description !== undefined) finding.description = description.trim();

    await finding.save();

    res.status(200).json({
      success: true,
      message: "Examination finding updated successfully",
      data: {
        id: finding._id,
        name: finding.name,
        description: finding.description,
        updatedAt: finding.updatedAt
      }
    });

  } catch (error) {
    console.error("❌ Error in updateExaminationFinding:", error);
    
    if (error.name === 'CastError') {
      return res.status(400).json({ 
        success: false, 
        message: "Invalid examination finding ID format" 
      });
    }
    
    res.status(500).json({ 
      success: false, 
      message: "Server error", 
      error: error.message 
    });
  }
};

export const deleteExaminationFinding = async (req, res) => {
  try {
    const { id } = req.params;
    const clinicId = req.clinicId;

    if (!id) {
      return res.status(400).json({ 
        success: false, 
        message: "Examination finding ID is required" 
      });
    }

    const finding = await ExaminationFinding.findOne({ 
      _id: id, 
      clinicId 
    });

    if (!finding) {
      return res.status(404).json({ 
        success: false, 
        message: "Examination finding not found" 
      });
    }

    // ===== Soft delete =====
    finding.isActive = false;
    await finding.save();

    res.status(200).json({
      success: true,
      message: "Examination finding deleted successfully"
    });

  } catch (error) {
    console.error("❌ Error in deleteExaminationFinding:", error);
    
    if (error.name === 'CastError') {
      return res.status(400).json({ 
        success: false, 
        message: "Invalid examination finding ID format" 
      });
    }
    
    res.status(500).json({ 
      success: false, 
      message: "Server error", 
      error: error.message 
    });
  }
};

export const addCommonFindings = async (req, res) => {
  try {
    const clinicId = req.clinicId;
    const userId = req.userId;

    const commonFindings = [
      { name: "Pain On Palpation Positive", description: "Pain on palpation positive" },
      { name: "Sensitivity On Airblow Negative", description: "Sensitivity on airblow Negative" },
      { name: "Sensitivity On Airblow Positive", description: "Sensitivity on airblow positive" },
      { name: "TOP Negative", description: "TOP Negative" },
      { name: "TOP Positive", description: "TOP positive" },
      { name: "Percussion Positive", description: "Percussion positive" },
      { name: "Percussion Negative", description: "Percussion negative" },
      { name: "Mobility Present", description: "Mobility present" },
      { name: "Mobility Absent", description: "Mobility absent" },
      { name: "Swelling Present", description: "Swelling present" },
      { name: "Swelling Absent", description: "Swelling absent" },
      { name: "Discoloration Present", description: "Discoloration present" },
      { name: "Discoloration Absent", description: "Discoloration absent" },
      { name: "Sinus Present", description: "Sinus present" },
      { name: "Sinus Absent", description: "Sinus absent" },
      { name: "Fistula Present", description: "Fistula present" },
      { name: "Fistula Absent", description: "Fistula absent" }
    ];

    const createdFindings = [];
    
    for (const finding of commonFindings) {
      const existing = await ExaminationFinding.findOne({
        clinicId,
        name: { $regex: new RegExp(`^${finding.name}$`, 'i') },
        isActive: true
      });

      if (!existing) {
        const newFinding = await ExaminationFinding.create({
          clinicId,
          name: finding.name,
          description: finding.description,
          createdBy: userId,
          isActive: true
        });
        createdFindings.push(newFinding);
      }
    }

    res.status(201).json({
      success: true,
      message: `Added ${createdFindings.length} common examination findings`,
      data: createdFindings,
      skipped: commonFindings.length - createdFindings.length
    });

  } catch (error) {
    console.error("❌ Error in addCommonFindings:", error);
    res.status(500).json({ 
      success: false, 
      message: "Server error", 
      error: error.message 
    });
  }
};