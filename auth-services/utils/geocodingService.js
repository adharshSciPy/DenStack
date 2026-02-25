// utils/geocodingHelpers.js
import axios from 'axios';
import Clinic from '../models/clinicSchema.js';

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';

/**
 * Manual geocoding function for bulk operations
 */
export const geocodeAddress = async (address) => {
  try {
    const formattedAddress = `${address.street}, ${address.city}, ${address.state || ''}, ${address.country || 'India'} ${address.zip || ''}`.replace(/\s+/g, ' ').trim();
    
    const response = await axios.get(NOMINATIM_URL, {
      params: {
        q: formattedAddress,
        format: 'json',
        limit: 1,
        countrycodes: 'in'
      },
      headers: {
        'User-Agent': 'DenStack/1.0'
      },
      timeout: 5000
    });

    if (response.data && response.data.length > 0) {
      const { lat, lon, display_name } = response.data[0];
      return {
        location: {
          type: 'Point',
          coordinates: [parseFloat(lon), parseFloat(lat)]
        },
        formattedAddress: display_name
      };
    }
    return null;
  } catch (error) {
    console.error('Geocoding error:', error.message);
    return null;
  }
};

/**
 * Update all clinics missing coordinates
 */
export const updateAllClinicLocations = async (req, res) => {
  try {
    const result = await Clinic.batchGeocodeMissingLocations(50); // Process 50 at a time
    
    res.json({
      success: true,
      message: 'Batch geocoding completed',
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error in batch geocoding',
      error: error.message
    });
  }
};

/**
 * Force geocode a specific clinic
 */
export const forceGeocodeClinic = async (req, res) => {
  try {
    const { clinicId } = req.params;
    
    const clinic = await Clinic.findById(clinicId);
    if (!clinic) {
      return res.status(404).json({
        success: false,
        message: 'Clinic not found'
      });
    }

    const location = await clinic.geocodeAddress();
    if (location) {
      await clinic.save();
      res.json({
        success: true,
        message: 'Clinic geocoded successfully',
        data: {
          clinicId: clinic._id,
          name: clinic.name,
          location: clinic.address.location,
          formattedAddress: clinic.address.formattedAddress
        }
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Could not geocode address'
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error geocoding clinic',
      error: error.message
    });
  }
};