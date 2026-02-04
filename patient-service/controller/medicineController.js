import MedicineMaster from "../model/medicineMasterSchema.js";
import{ getMedicineSuggestions, findOrCreateMedicine, getPopularMedicines } from '../utils/medicineUtils.js';
const getMedicineSuggestionsController = async (req, res) => {
  try {
    const { q, limit = 15 } = req.query;
    
    if (!q || q.length < 2) {
      return res.json({ success: true, suggestions: [] });
    }
    
    const suggestions = await getMedicineSuggestions(q, parseInt(limit));
    
    res.json({
      success: true,
      suggestions
    });
  } catch (error) {
    console.error('Error in medicine suggestions:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching medicine suggestions'
    });
  }
};
 const createMedicineController = async (req, res) => {
  try {
    const { medicineName, doctorId, clinicId, dosageForm, strength, category } = req.body;
    
    if (!medicineName || !doctorId) {
      return res.status(400).json({
        success: false,
        message: 'Medicine name and doctor ID are required'
      });
    }
    
    const medicine = await findOrCreateMedicine(medicineName, doctorId, clinicId);
    
    if (!medicine) {
      return res.status(400).json({
        success: false,
        message: 'Could not create medicine'
      });
    }
    
    // Update additional fields if provided
    if (dosageForm || strength || category) {
      const updateData = {};
      if (dosageForm) updateData.dosageForms = [dosageForm];
      if (strength) updateData.strengths = [strength];
      if (category) updateData.category = category;
      
      await MedicineMaster.findByIdAndUpdate(medicine._id, updateData);
    }
    
    res.json({
      success: true,
      medicine
    });
  } catch (error) {
    console.error('Error creating medicine:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating medicine'
    });
  }
};
const getPopularMedicinesController = async (req, res) => {
  try {
    const { limit = 20 } = req.query;
    const medicines = await getPopularMedicines(parseInt(limit));
    
    res.json({
      success: true,
      medicines
    });
  } catch (error) {
    console.error('Error getting popular medicines:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching popular medicines'
    });
  }
};
const getMedicineByIdController = async (req, res) => {
  try {
    const { id } = req.params;
    
    const medicine = await MedicineMaster.findById(id);
    
    if (!medicine) {
      return res.status(404).json({
        success: false,
        message: 'Medicine not found'
      });
    }
    
    res.json({
      success: true,
      medicine
    });
  } catch (error) {
    console.error('Error getting medicine by ID:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching medicine details'
    });
  }
};
const searchMedicinesController = async (req, res) => {
  try {
    const { 
      search, 
      category, 
      dosageForm, 
      prescriptionRequired,
      limit = 50,
      page = 1 
    } = req.query;
    
    const query = {};
    
    if (search && search.length >= 2) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { brandNames: { $regex: search, $options: 'i' } },
        { genericName: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (category) {
      query.category = category;
    }
    
    if (dosageForm) {
      query.dosageForms = dosageForm;
    }
    
    if (prescriptionRequired !== undefined) {
      query.prescriptionRequired = prescriptionRequired === 'true';
    }
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [medicines, total] = await Promise.all([
      MedicineMaster.find(query)
        .sort({ usageCount: -1, lastUsed: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      MedicineMaster.countDocuments(query)
    ]);
    
    res.json({
      success: true,
      medicines,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error searching medicines:', error);
    res.status(500).json({
      success: false,
      message: 'Error searching medicines'
    });
  }
};
export {
  getMedicineSuggestionsController,
  createMedicineController,
  getPopularMedicinesController,
  getMedicineByIdController,
  searchMedicinesController
};  