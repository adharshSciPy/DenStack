import mongoose from "mongoose";
import DoctorAvailability from "../model/doctorAvailabilitySchema.js";
import axios from "axios";
import dotenv from 'dotenv';
dotenv.config();

const AUTH_SERVICE_BASE_URL = process.env.AUTH_SERVICE_BASE_URL;

const addDoctorAvailability = async (req, res) => {
//   console.log("AUTH_SERVICE_BASE_URL =", AUTH_SERVICE_BASE_URL);

  try {
    const { id: doctorId } = req.params;
    const { clinicId, dayOfWeek, startTime, endTime, createdBy } = req.body;

    // Validate ObjectIds
    if (!mongoose.Types.ObjectId.isValid(doctorId)) {
      return res.status(400).json({ success: false, message: "Invalid doctorId" });
    }
    if (!mongoose.Types.ObjectId.isValid(clinicId)) {
      return res.status(400).json({ success: false, message: "Invalid clinicId" });
    }

    if (!clinicId || !dayOfWeek || !startTime || !endTime) {
      return res.status(400).json({
        success: false,
        message: "clinicId, dayOfWeek, startTime, and endTime are required",
      });
    }

    // Fetch doctor from auth-service
    let doctor;
    try {
      const url = `${AUTH_SERVICE_BASE_URL}/doctor/details/${doctorId}`;
    //   console.log("Fetching doctor from:", url);
      const response = await axios.get(url);
    //   console.log(response)

      if (response.data?.success && response.data.doctor) {
        doctor = response.data.doctor;
      } else {
        return res.status(404).json({
          success: false,
          message: "Doctor not found in doctor-service",
        });
      }
    } catch (error) {
      console.error("Axios error fetching doctor:", error.response?.data || error.message);
      return res.status(500).json({
        success: false,
        message: "Error fetching doctor from doctor-service",
      });
    }

    // Check existing availability
    const existingAvailability = await DoctorAvailability.findOne({
      doctorId: new mongoose.Types.ObjectId(doctorId),
      clinicId: new mongoose.Types.ObjectId(clinicId),
      dayOfWeek,
    });

    if (existingAvailability) {
      return res.status(400).json({
        success: false,
        message: `Availability already exists for ${dayOfWeek}`,
      });
    }

    // Save availability
    const availability = new DoctorAvailability({
      doctorId: new mongoose.Types.ObjectId(doctorId),
      clinicId: new mongoose.Types.ObjectId(clinicId),
      dayOfWeek,
      startTime,
      endTime,
      createdBy: createdBy ? new mongoose.Types.ObjectId(createdBy) : undefined,
    });

    await availability.save();

    return res.status(201).json({
      success: true,
      message: "Doctor availability added successfully",
      data: availability,
    });
  } catch (error) {
    console.error("❌ Error in addDoctorAvailability:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

export { addDoctorAvailability };
