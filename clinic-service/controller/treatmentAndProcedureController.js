
import TreatmentProcedure from "../model/treatmentAndProcedure.js";

// Create new treatment procedure
export const createTreatmentProcedure = async (req, res) => {
  try {
    const { name, description, price } = req.body;
    const clinicId = req.clinicId;

    // ===== Validations =====
    if (!name || name.trim() === "") {
      return res.status(400).json({ 
        success: false, 
        message: "Procedure name is required" 
      });
    }

    if (price === undefined || price === null) {
      return res.status(400).json({ 
        success: false, 
        message: "Price is required" 
      });
    }

    if (typeof price !== "number" || price < 0) {
      return res.status(400).json({ 
        success: false, 
        message: "Price must be a non-negative number" 
      });
    }

    // ===== Check if procedure already exists for this clinic =====
    const existingProcedure = await TreatmentProcedure.findOne({
      clinicId,
      name: { $regex: new RegExp(`^${name.trim()}$`, 'i') },
      isActive: true
    });

    if (existingProcedure) {
      return res.status(400).json({ 
        success: false, 
        message: "Treatment procedure with this name already exists in your clinic" 
      });
    }

    // ===== Create new procedure =====
    const newProcedure = await TreatmentProcedure.create({
      clinicId,
      name: name.trim(),
      description: description?.trim() || name.trim(),
      price,
      createdBy: req.userId,
      isActive: true
    });

    res.status(201).json({
      success: true,
      message: "Treatment procedure created successfully",
      data: newProcedure
    });

  } catch (error) {
    console.error("❌ Error in createTreatmentProcedure:", error);
    res.status(500).json({ 
      success: false, 
      message: "Server error", 
      error: error.message 
    });
  }
};

// Get all treatment procedures with pagination and search
export const getAllTreatmentProcedures = async (req, res) => {
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
    const procedures = await TreatmentProcedure.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select('name description price createdAt updatedAt')
      .lean();

    // ===== Get total count =====
    const total = await TreatmentProcedure.countDocuments(query);

    // ===== Calculate total value for procedures =====
    const totalValue = procedures.reduce((sum, procedure) => sum + (procedure.price || 0), 0);

    res.status(200).json({
      success: true,
      data: procedures,
      summary: {
        totalRecords: total,
        totalValue: totalValue
      },
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
    console.error("❌ Error in getAllTreatmentProcedures:", error);
    res.status(500).json({ 
      success: false, 
      message: "Server error", 
      error: error.message 
    });
  }
};

// Get treatment procedure by ID
export const getTreatmentProcedureById = async (req, res) => {
  try {
    const { id } = req.params;
    const clinicId = req.clinicId;

    if (!id) {
      return res.status(400).json({ 
        success: false, 
        message: "Procedure ID is required" 
      });
    }

    const procedure = await TreatmentProcedure.findOne({ 
      _id: id, 
      clinicId,
      isActive: true 
    }).select('name description price createdAt updatedAt');

    if (!procedure) {
      return res.status(404).json({ 
        success: false, 
        message: "Treatment procedure not found" 
      });
    }

    res.status(200).json({
      success: true,
      data: procedure
    });

  } catch (error) {
    console.error("❌ Error in getTreatmentProcedureById:", error);
    
    if (error.name === 'CastError') {
      return res.status(400).json({ 
        success: false, 
        message: "Invalid procedure ID format" 
      });
    }
    
    res.status(500).json({ 
      success: false, 
      message: "Server error", 
      error: error.message 
    });
  }
};

// Update treatment procedure
export const updateTreatmentProcedure = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, price } = req.body;
    const clinicId = req.clinicId;

    if (!id) {
      return res.status(400).json({ 
        success: false, 
        message: "Procedure ID is required" 
      });
    }

    // ===== Find the procedure =====
    const procedure = await TreatmentProcedure.findOne({ 
      _id: id, 
      clinicId 
    });

    if (!procedure) {
      return res.status(404).json({ 
        success: false, 
        message: "Treatment procedure not found" 
      });
    }

    // ===== Check for name conflict if name is being changed =====
    if (name && name.trim() !== procedure.name) {
      const existingProcedure = await TreatmentProcedure.findOne({
        clinicId,
        name: { $regex: new RegExp(`^${name.trim()}$`, 'i') },
        _id: { $ne: id },
        isActive: true
      });

      if (existingProcedure) {
        return res.status(400).json({ 
          success: false, 
          message: "Another treatment procedure with this name already exists in your clinic" 
        });
      }
    }

    // ===== Update fields =====
    if (name !== undefined) procedure.name = name.trim();
    if (description !== undefined) procedure.description = description.trim();
    if (price !== undefined) {
      if (typeof price !== "number" || price < 0) {
        return res.status(400).json({ 
          success: false, 
          message: "Price must be a non-negative number" 
        });
      }
      procedure.price = price;
    }

    await procedure.save();

    res.status(200).json({
      success: true,
      message: "Treatment procedure updated successfully",
      data: {
        id: procedure._id,
        name: procedure.name,
        description: procedure.description,
        price: procedure.price,
        updatedAt: procedure.updatedAt
      }
    });

  } catch (error) {
    console.error("❌ Error in updateTreatmentProcedure:", error);
    
    if (error.name === 'CastError') {
      return res.status(400).json({ 
        success: false, 
        message: "Invalid procedure ID format" 
      });
    }
    
    res.status(500).json({ 
      success: false, 
      message: "Server error", 
      error: error.message 
    });
  }
};

// Delete treatment procedure (soft delete)
export const deleteTreatmentProcedure = async (req, res) => {
  try {
    const { id } = req.params;
    const clinicId = req.clinicId;

    if (!id) {
      return res.status(400).json({ 
        success: false, 
        message: "Procedure ID is required" 
      });
    }

    const procedure = await TreatmentProcedure.findOne({ 
      _id: id, 
      clinicId 
    });

    if (!procedure) {
      return res.status(404).json({ 
        success: false, 
        message: "Treatment procedure not found" 
      });
    }

    // ===== Soft delete =====
    procedure.isActive = false;
    await procedure.save();

    res.status(200).json({
      success: true,
      message: "Treatment procedure deleted successfully"
    });

  } catch (error) {
    console.error("❌ Error in deleteTreatmentProcedure:", error);
    
    if (error.name === 'CastError') {
      return res.status(400).json({ 
        success: false, 
        message: "Invalid procedure ID format" 
      });
    }
    
    res.status(500).json({ 
      success: false, 
      message: "Server error", 
      error: error.message 
    });
  }
};

// Search treatment procedures
export const searchTreatmentProcedures = async (req, res) => {
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

    const procedures = await TreatmentProcedure.find({
      clinicId,
      isActive: true,
      $or: [
        { name: { $regex: searchTerm, $options: 'i' } },
        { description: { $regex: searchTerm, $options: 'i' } }
      ]
    })
    .select('name description price')
    .limit(limit)
    .sort({ name: 1 })
    .lean();

    res.status(200).json({
      success: true,
      data: procedures,
      totalResults: procedures.length
    });

  } catch (error) {
    console.error("❌ Error in searchTreatmentProcedures:", error);
    res.status(500).json({ 
      success: false, 
      message: "Server error", 
      error: error.message 
    });
  }
};