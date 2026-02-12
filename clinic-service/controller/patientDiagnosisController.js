// controllers/patientDiagnosisController.js
import PatientDiagnosis from "../model/patientDiagnosis.js";

export const createPatientDiagnosis = async (req, res) => {
  try {
    const { name, description } = req.body;
    const clinicId = req.clinicId;

    // ===== Validations =====
    if (!name || name.trim() === "") {
      return res.status(400).json({ 
        success: false, 
        message: "Diagnosis name is required" 
      });
    }

    // ===== Check if diagnosis already exists for this clinic =====
    const existingDiagnosis = await PatientDiagnosis.findOne({
      clinicId,
      name: { $regex: new RegExp(`^${name.trim()}$`, 'i') },
      isActive: true
    });

    if (existingDiagnosis) {
      return res.status(400).json({ 
        success: false, 
        message: "Diagnosis with this name already exists in your clinic" 
      });
    }

    // ===== Create new diagnosis =====
    const newDiagnosis = await PatientDiagnosis.create({
      clinicId,
      name: name.trim(),
      description: description?.trim() || name.trim(),
      createdBy: req.userId,
      isActive: true
    });

    res.status(201).json({
      success: true,
      message: "Patient diagnosis created successfully",
      data: newDiagnosis
    });

  } catch (error) {
    console.error("❌ Error in createPatientDiagnosis:", error);
    res.status(500).json({ 
      success: false, 
      message: "Server error", 
      error: error.message 
    });
  }
};

export const getAllPatientDiagnoses = async (req, res) => {
  try {
    const clinicId = req.query.clinicId;
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
    const diagnoses = await PatientDiagnosis.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select('name description createdAt updatedAt')
      .lean();

    // ===== Get total count =====
    const total = await PatientDiagnosis.countDocuments(query);

    res.status(200).json({
      success: true,
      data: diagnoses,
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
    console.error("❌ Error in getAllPatientDiagnoses:", error);
    res.status(500).json({ 
      success: false, 
      message: "Server error", 
      error: error.message 
    });
  }
};

export const getPatientDiagnosisById = async (req, res) => {
  try {
    const { id } = req.params;
    const clinicId = req.query.clinicId;

    if (!id) {
      return res.status(400).json({ 
        success: false, 
        message: "Diagnosis ID is required" 
      });
    }

    const diagnosis = await PatientDiagnosis.findOne({ 
      _id: id, 
      clinicId,
      isActive: true 
    }).select('name description createdAt updatedAt');

    if (!diagnosis) {
      return res.status(404).json({ 
        success: false, 
        message: "Patient diagnosis not found" 
      });
    }

    res.status(200).json({
      success: true,
      data: diagnosis
    });

  } catch (error) {
    console.error("❌ Error in getPatientDiagnosisById:", error);
    
    if (error.name === 'CastError') {
      return res.status(400).json({ 
        success: false, 
        message: "Invalid diagnosis ID format" 
      });
    }
    
    res.status(500).json({ 
      success: false, 
      message: "Server error", 
      error: error.message 
    });
  }
};

export const updatePatientDiagnosis = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;
    const clinicId = req.clinicId;

    if (!id) {
      return res.status(400).json({ 
        success: false, 
        message: "Diagnosis ID is required" 
      });
    }

    // ===== Find the diagnosis =====
    const diagnosis = await PatientDiagnosis.findOne({ 
      _id: id, 
      clinicId 
    });

    if (!diagnosis) {
      return res.status(404).json({ 
        success: false, 
        message: "Patient diagnosis not found" 
      });
    }

    // ===== Check for name conflict if name is being changed =====
    if (name && name.trim() !== diagnosis.name) {
      const existingDiagnosis = await PatientDiagnosis.findOne({
        clinicId,
        name: { $regex: new RegExp(`^${name.trim()}$`, 'i') },
        _id: { $ne: id },
        isActive: true
      });

      if (existingDiagnosis) {
        return res.status(400).json({ 
          success: false, 
          message: "Another diagnosis with this name already exists in your clinic" 
        });
      }
    }

    // ===== Update fields =====
    if (name !== undefined) diagnosis.name = name.trim();
    if (description !== undefined) diagnosis.description = description.trim();

    await diagnosis.save();

    res.status(200).json({
      success: true,
      message: "Patient diagnosis updated successfully",
      data: {
        id: diagnosis._id,
        name: diagnosis.name,
        description: diagnosis.description,
        updatedAt: diagnosis.updatedAt
      }
    });

  } catch (error) {
    console.error("❌ Error in updatePatientDiagnosis:", error);
    
    if (error.name === 'CastError') {
      return res.status(400).json({ 
        success: false, 
        message: "Invalid diagnosis ID format" 
      });
    }
    
    res.status(500).json({ 
      success: false, 
      message: "Server error", 
      error: error.message 
    });
  }
};

export const deletePatientDiagnosis = async (req, res) => {
  try {
    const { id } = req.params;
    const clinicId = req.clinicId;

    if (!id) {
      return res.status(400).json({ 
        success: false, 
        message: "Diagnosis ID is required" 
      });
    }

    const diagnosis = await PatientDiagnosis.findOne({ 
      _id: id, 
      clinicId 
    });

    if (!diagnosis) {
      return res.status(404).json({ 
        success: false, 
        message: "Patient diagnosis not found" 
      });
    }

    // ===== Soft delete =====
    diagnosis.isActive = false;
    await diagnosis.save();

    res.status(200).json({
      success: true,
      message: "Patient diagnosis deleted successfully"
    });

  } catch (error) {
    console.error("❌ Error in deletePatientDiagnosis:", error);
    
    if (error.name === 'CastError') {
      return res.status(400).json({ 
        success: false, 
        message: "Invalid diagnosis ID format" 
      });
    }
    
    res.status(500).json({ 
      success: false, 
      message: "Server error", 
      error: error.message 
    });
  }
};

export const addCommonDiagnoses = async (req, res) => {
  try {
    const clinicId = req.clinicId;
    const userId = req.userId;

    const commonDiagnoses = [
      { name: "Gingivitis", description: "Gingivitis" },
      { name: "Reversible Pulpitis", description: "Reversible pulpitis" },
      { name: "Irreversible Pulpitis", description: "Irreversible pulpitis" },
      { name: "Dental Caries", description: "Dental caries" },
      { name: "Periodontitis", description: "Periodontitis" },
      { name: "Apical Periodontitis", description: "Apical periodontitis" },
      { name: "Periapical Abscess", description: "Periapical abscess" },
      { name: "Tooth Fracture", description: "Tooth fracture" },
      { name: "Root Fracture", description: "Root fracture" },
      { name: "Dental Hypersensitivity", description: "Dental hypersensitivity" },
      { name: "Tooth Discoloration", description: "Tooth discoloration" },
      { name: "Malocclusion", description: "Malocclusion" },
      { name: "Bruxism", description: "Bruxism" },
      { name: "Temporomandibular Joint Disorder", description: "Temporomandibular joint disorder" },
      { name: "Oral Candidiasis", description: "Oral candidiasis" },
      { name: "Aphthous Ulcer", description: "Aphthous ulcer" }
    ];

    const createdDiagnoses = [];
    
    for (const diagnosis of commonDiagnoses) {
      const existing = await PatientDiagnosis.findOne({
        clinicId,
        name: { $regex: new RegExp(`^${diagnosis.name}$`, 'i') },
        isActive: true
      });

      if (!existing) {
        const newDiagnosis = await PatientDiagnosis.create({
          clinicId,
          name: diagnosis.name,
          description: diagnosis.description,
          createdBy: userId,
          isActive: true
        });
        createdDiagnoses.push(newDiagnosis);
      }
    }

    res.status(201).json({
      success: true,
      message: `Added ${createdDiagnoses.length} common diagnoses`,
      data: createdDiagnoses,
      skipped: commonDiagnoses.length - createdDiagnoses.length
    });

  } catch (error) {
    console.error("❌ Error in addCommonDiagnoses:", error);
    res.status(500).json({ 
      success: false, 
      message: "Server error", 
      error: error.message 
    });
  }
};