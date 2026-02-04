// utils/medicineUtils.js
import MedicineMaster from '../model/medicineMasterSchema.js';

/**
 * Clean medicine name by removing dosage forms and extra words
 */
export const cleanMedicineName = (input) => {
  if (!input) return '';
  
  const lowerInput = input.toLowerCase().trim();
  
  // Remove common dosage forms and their abbreviations
  const dosagePatterns = [
    /\s*(tab|tablet|caps|capsule|cap|syrup|inj|injection|oint|ointment|cream|drop|drops|gel|spray|susp|suspension|powder|inh|inhaler|lozenge|paste)s?\.?\s*$/i,
    /\s*\d+\s*(mg|g|ml|mcg|iu|%)\s*/gi,
    /\s*(sr|cr|er|xl|mr|od|bd|tds|qid)\s*/gi
  ];
  
  let cleaned = lowerInput;
  dosagePatterns.forEach(pattern => {
    cleaned = cleaned.replace(pattern, ' ');
  });
  
  // Remove extra spaces and trim
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  
  // Keep only alphabets, numbers, and spaces
  cleaned = cleaned.replace(/[^a-z0-9\s]/gi, '');
  
  return cleaned;
};

/**
 * Extract dosage form from medicine name
 */
export const extractDosageForm = (medicineName) => {
  const forms = [
    { pattern: /\b(tab|tablet)s?\b/i, form: 'tablet' },
    { pattern: /\b(caps|capsule|cap)s?\b/i, form: 'capsule' },
    { pattern: /\b(syrup|syp)s?\b/i, form: 'syrup' },
    { pattern: /\b(inj|injection)s?\b/i, form: 'injection' },
    { pattern: /\b(oint|ointment|cream)s?\b/i, form: 'ointment' },
    { pattern: /\b(drop|drops)s?\b/i, form: 'drops' },
    { pattern: /\b(inhaler|inh)s?\b/i, form: 'inhaler' },
    { pattern: /\b(powder|pow)s?\b/i, form: 'powder' },
    { pattern: /\b(susp|suspension)s?\b/i, form: 'suspension' },
    { pattern: /\b(gel)s?\b/i, form: 'gel' },
    { pattern: /\b(spray)s?\b/i, form: 'spray' },
    { pattern: /\b(lozenge)s?\b/i, form: 'lozenge' },
    { pattern: /\b(paste)s?\b/i, form: 'paste' }
  ];
  
  for (const { pattern, form } of forms) {
    if (pattern.test(medicineName)) {
      return form;
    }
  }
  
  return null;
};

/**
 * Extract strength from medicine name
 */
export const extractStrength = (medicineName) => {
  const strengthMatch = medicineName.match(/(\d+(?:\.\d+)?)\s*(mg|g|mcg|ml|iu|%)/i);
  return strengthMatch ? `${strengthMatch[1]}${strengthMatch[2].toLowerCase()}` : null;
};

/**
 * Get medicine suggestions
 */
export const getMedicineSuggestions = async (searchTerm, limit = 15) => {
  if (!searchTerm || searchTerm.length < 2) {
    return [];
  }

  const cleanedTerm = cleanMedicineName(searchTerm);
  
  try {
    // First, try exact or starts with matches
    const suggestions = await MedicineMaster.find({
      $or: [
        { name: { $regex: `^${cleanedTerm}`, $options: 'i' } },
        { brandNames: { $regex: `^${cleanedTerm}`, $options: 'i' } },
        { genericName: { $regex: `^${cleanedTerm}`, $options: 'i' } }
      ],
      isApproved: true
    })
    .sort({ 
      usageCount: -1,
      lastUsed: -1
    })
    .limit(limit)
    .lean();

    // If no exact matches, try partial matches
    if (suggestions.length === 0 && cleanedTerm.length >= 3) {
      const partialSuggestions = await MedicineMaster.find({
        $or: [
          { name: { $regex: cleanedTerm, $options: 'i' } },
          { brandNames: { $regex: cleanedTerm, $options: 'i' } },
          { genericName: { $regex: cleanedTerm, $options: 'i' } }
        ],
        isApproved: true
      })
      .sort({ 
        usageCount: -1,
        lastUsed: -1
      })
      .limit(limit)
      .lean();
      
      return partialSuggestions.map(formatSuggestion);
    }

    return suggestions.map(formatSuggestion);
  } catch (error) {
    console.error('Error getting medicine suggestions:', error);
    return [];
  }
};

/**
 * Format suggestion for frontend
 */
const formatSuggestion = (medicine) => {
  const commonForm = medicine.dosageForms?.[0] || '';
  const commonStrength = medicine.strengths?.[0] || '';
  
  return {
    _id: medicine._id,
    name: medicine.name,
    displayName: `${medicine.name} ${commonStrength} ${commonForm}`.trim(),
    genericName: medicine.genericName,
    brandNames: medicine.brandNames || [],
    dosageForms: medicine.dosageForms || [],
    strengths: medicine.strengths || [],
    category: medicine.category,
    prescriptionRequired: medicine.prescriptionRequired,
    usageCount: medicine.usageCount
  };
};

/**
 * Find or create medicine in master database
 */
export const findOrCreateMedicine = async (medicineName, doctorId, clinicId = null) => {
  try {
    const cleanedName = cleanMedicineName(medicineName);
    
    if (!cleanedName || cleanedName.length < 2) {
      return null;
    }

    // Check if medicine already exists
    const existingMedicine = await MedicineMaster.findOne({
      $or: [
        { name: { $regex: `^${cleanedName}$`, $options: 'i' } },
        { brandNames: { $regex: `^${cleanedName}$`, $options: 'i' } }
      ]
    });

    if (existingMedicine) {
      // Update usage stats
      await MedicineMaster.findByIdAndUpdate(existingMedicine._id, {
        $inc: { usageCount: 1 },
        lastUsed: new Date()
      });
      
      return existingMedicine;
    }

    // Extract info from medicine name
    const dosageForm = extractDosageForm(medicineName);
    const strength = extractStrength(medicineName);
    
    // Determine category (you can enhance this logic)
    const determineCategory = (name) => {
      const lowerName = name.toLowerCase();
      if (lowerName.includes('amox') || lowerName.includes('cef')) return 'antibiotic';
      if (lowerName.includes('para') || lowerName.includes('ibu')) return 'analgesic';
      if (lowerName.includes('antacid') || lowerName.includes('raniti')) return 'antacid';
      if (lowerName.includes('vitamin') || lowerName.includes('vit')) return 'vitamin';
      if (lowerName.includes('mouthwash') || lowerName.includes('rinse')) return 'mouthwash';
      return 'other';
    };

    // Create new medicine
    const newMedicine = new MedicineMaster({
      name: cleanedName,
      dosageForms: dosageForm ? [dosageForm] : [],
      strengths: strength ? [strength] : [],
      category: determineCategory(cleanedName),
      createdByDoctor: doctorId,
      clinicId: clinicId,
      usageCount: 1,
      lastUsed: new Date()
    });

    await newMedicine.save();
    return newMedicine;
  } catch (error) {
    console.error('Error finding/creating medicine:', error);
    return null;
  }
};

/**
 * Update medicine usage statistics
 */
export const updateMedicineUsage = async (medicineName) => {
  try {
    const cleanedName = cleanMedicineName(medicineName);
    
    await MedicineMaster.findOneAndUpdate(
      { 
        $or: [
          { name: { $regex: `^${cleanedName}$`, $options: 'i' } },
          { brandNames: { $regex: `^${cleanedName}$`, $options: 'i' } }
        ]
      },
      {
        $inc: { usageCount: 1 },
        $set: { lastUsed: new Date() }
      }
    );
  } catch (error) {
    console.error('Error updating medicine usage:', error);
  }
};

/**
 * Get popular medicines
 */
export const getPopularMedicines = async (limit = 20) => {
  try {
    const medicines = await MedicineMaster.find({ isApproved: true })
      .sort({ usageCount: -1, lastUsed: -1 })
      .limit(limit)
      .lean();
    
    return medicines.map(formatSuggestion);
  } catch (error) {
    console.error('Error getting popular medicines:', error);
    return [];
  }
};