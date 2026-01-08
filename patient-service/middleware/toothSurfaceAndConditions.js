// middleware/toothSurfaceAndConditions.js
export const TOOTH_SURFACES = [
  'mesial', 'distal', 'occlusal', 'buccal', 'lingual', 'palatal', 'incisal', 'entire'
];

// Update TOOTH_CONDITIONS to include ALL conditions from frontend DentalChart
export const TOOTH_CONDITIONS = [
  // From frontend DENTAL_CONDITIONS array
  'Caries',
  'Filling',
  'Crown',
  'Root Canal',
  'Extraction Needed',
  'Impacted',
  'Missing',
  'Hypoplastic',
  'Discolored',
  'Fractured',
  'Sensitive',
  'Mobile',
  'Periapical Lesion',
  'Periodontal Pocket',
  'Calculus',
  'Plaque',
  'Gingivitis',
  'Pericoronitis',
  
  // From frontend DENTAL_PROCEDURES array (for procedures field)
  'Cleaning/Prophylaxis',
  'Scaling & Root Planing',
  'Filling (Composite)',
  'Filling (Amalgam)',
  'Root Canal Treatment',
  'Crown Placement',
  'Bridge',
  'Denture',
  'Extraction',
  'Implant',
  'Orthodontic Treatment',
  'Whitening',
  'Veneer',
  'Gum Surgery',
  'Frenectomy',
  'Apicoectomy',
  
  // Also add lowercase versions just in case
  'caries', 'filling', 'crown', 'root canal', 'extraction needed', 'impacted',
  'missing', 'hypoplastic', 'discolored', 'fractured', 'sensitive', 'mobile',
  'periapical lesion', 'periodontal pocket', 'calculus', 'plaque', 'gingivitis',
  'pericoronitis',
  
  // Any other conditions you might have in your frontend
  'Discolored', // You already have this but adding for clarity
  'Sensitive',  // Already have but adding for clarity
  'Filling',    // Already have but adding for clarity
  'Periapical Lesion', // Already have but adding for clarity
];