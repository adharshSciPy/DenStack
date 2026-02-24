import PendingBooking from "../model/pendingBooking.js";
import Appointment from "../model/appointmentSchema.js";
import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config()
const submitBookingRequest = async (req, res) => {
  try {
    const { clinicId } = req.params;
    const {
      firstName,
      lastName,
      email,
      phone,
      age,
      gender,
      department,
      doctorId,
      doctorName,
      preferredDate,
      preferredTime,
      message,
      reason
    } = req.body;

    // Validate required fields
    if (!firstName || !lastName || !email || !phone || !age || !gender || 
        !department || !preferredDate || !preferredTime) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields"
      });
    }

    // Validate clinicId
    if (!clinicId || !mongoose.Types.ObjectId.isValid(clinicId)) {
      return res.status(400).json({ success: false, message: "Invalid clinic ID" });
    }

    // Validate phone number (10 digits)
    if (!/^\d{10}$/.test(phone)) {
      return res.status(400).json({
        success: false,
        message: "Invalid phone number. Must be 10 digits."
      });
    }

    // Check for existing pending booking from this phone/email
    const existingPending = await PendingBooking.findOne({
      clinicId,
      status: "pending",
      $or: [
        { "patientDetails.phone": phone },
        { "patientDetails.email": email.toLowerCase() }
      ]
    });

    if (existingPending) {
      return res.status(409).json({
        success: false,
        message: "You already have a pending booking request. Please wait for it to be processed.",
        data: {
          bookingId: existingPending._id,
          submittedAt: existingPending.createdAt
        }
      });
    }

    // Check if this time slot is already booked (optional - just for info)
    const existingAppointment = await Appointment.findOne({
      clinicId,
      department,
      appointmentDate: preferredDate,
      appointmentTime: preferredTime,
      status: { $in: ["scheduled", "confirmed"] }
    });

    // Create pending booking
    const pendingBooking = new PendingBooking({
      clinicId,
      patientDetails: {
        firstName,
        lastName,
        email: email.toLowerCase(),
        phone,
        age: Number(age),
        gender,
        message
      },
      requestedAppointment: {
        department,
        doctorId: doctorId || null,
        doctorName: doctorName || null,
        preferredDate,
        preferredTime,
        reason
      },
      status: "pending"
    });

    await pendingBooking.save();

    return res.status(201).json({
      success: true,
      message: existingAppointment 
        ? "Note: This time slot is currently booked. The clinic will contact you with alternatives."
        : "Your booking request has been submitted successfully. The clinic will review and confirm shortly.",
      data: {
        bookingId: pendingBooking._id,
        status: pendingBooking.status,
        submittedAt: pendingBooking.createdAt,
        timeSlotAvailable: !existingAppointment
      }
    });

  } catch (error) {
    console.error("Error submitting booking request:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to submit booking request",
      error: error.message
    });
  }
};

// controllers/pendingBookingController.js

const autoProcessBooking = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { clinicId, userId, userRole } = req.body;

    // Validate permissions
    if (!["receptionist", "admin"].includes(userRole)) {
      return res.status(403).json({ success: false, message: "Unauthorized" });
    }

    // Find the pending booking
    const booking = await PendingBooking.findOne({
      _id: bookingId,
      clinicId,
      status: "pending"
    });

    if (!booking) {
      return res.status(404).json({ success: false, message: "Pending booking not found" });
    }

    // ===================== STEP 1: Find or Create Patient =====================
    const fullName = `${booking.patientDetails.firstName} ${booking.patientDetails.lastName}`.trim();
    const phone = booking.patientDetails.phone;
    const email = booking.patientDetails.email;

    // Try to find existing patient (by phone OR email with name match)
    let patient = await Patient.findOne({
      clinicId,
      $or: [
        { phone: phone },
        { email: email }
      ]
    });

    let isNewPatient = false;

    if (!patient) {
      // Create new patient
      const patientData = {
        clinicId,
        name: fullName,
        phone: phone,
        email: email,
        age: booking.patientDetails.age,
        gender: booking.patientDetails.gender,
        createdBy: userId,
        createdByRole: userRole === "receptionist" ? "Receptionist" : "Admin",
        medicalHistory: {
          conditions: [],
          surgeries: [],
          allergies: [],
          familyHistory: []
        }
      };

      patient = new Patient(patientData);
      await patient.save();
      isNewPatient = true;
      
      console.log(`✅ New patient created: ${patient.name} (${patient.patientUniqueId})`);
    } else {
      console.log(`✅ Existing patient found: ${patient.name} (${patient.patientUniqueId})`);
      
      // Update patient info if needed (optional)
      if (!patient.email && email) {
        patient.email = email;
        await patient.save();
      }
    }

    // ===================== STEP 2: Create Appointment =====================
    // Check if the requested time slot is available
    const existingAppointment = await Appointment.findOne({
      clinicId,
      department: booking.requestedAppointment.department,
      appointmentDate: booking.requestedAppointment.preferredDate,
      appointmentTime: booking.requestedAppointment.preferredTime,
      doctorId: booking.requestedAppointment.doctorId,
      status: { $in: ["scheduled", "confirmed"] }
    });

    let appointment;
    let appointmentStatus = "scheduled";
    let actualDate = booking.requestedAppointment.preferredDate;
    let actualTime = booking.requestedAppointment.preferredTime;

    if (existingAppointment) {
      // Time slot is taken - mark for reschedule
      appointmentStatus = "needs_reschedule";
      
      // Find next available slot (optional - you can implement this)
      // For now, we'll still create but mark as needs_reschedule
    }

    // Get next OP number
    const lastAppointment = await Appointment.findOne({
      clinicId,
      appointmentDate: actualDate
    }).sort({ opNumber: -1 });
    
    const nextOpNumber = lastAppointment ? Number(lastAppointment.opNumber) + 1 : 1;

    // Create appointment
    const appointmentData = {
      patientId: patient._id,
      clinicId,
      doctorId: booking.requestedAppointment.doctorId,
      department: booking.requestedAppointment.department,
      appointmentDate: actualDate,
      appointmentTime: actualTime,
      status: appointmentStatus,
      createdBy: userId,
      opNumber: nextOpNumber,
      approvedBy: userId,
      approvedAt: new Date()
    };

    // Add notes if provided
    if (booking.requestedAppointment.reason) {
      appointmentData.notes = booking.requestedAppointment.reason;
    }

    appointment = new Appointment(appointmentData);
    await appointment.save();

    // ===================== STEP 3: Update Booking Record =====================
    booking.status = "approved";
    booking.processedBy = userId;
    booking.processedAt = new Date();
    booking.result = {
      patientId: patient._id,
      appointmentId: appointment._id,
      opNumber: nextOpNumber,
      wasExistingPatient: !isNewPatient
    };
    await booking.save();

    // ===================== STEP 4: Return Success Response =====================
    return res.json({
      success: true,
      message: existingAppointment
        ? "Patient processed but requested time slot was taken. Appointment marked for reschedule."
        : `Booking approved successfully. ${isNewPatient ? 'New patient registered' : 'Existing patient used'}.`,
      data: {
        booking: {
          id: booking._id,
          status: booking.status
        },
        patient: {
          id: patient._id,
          name: patient.name,
          uniqueId: patient.patientUniqueId,
          isNew: isNewPatient
        },
        appointment: {
          id: appointment._id,
          date: appointment.appointmentDate,
          time: appointment.appointmentTime,
          opNumber: appointment.opNumber,
          status: appointment.status,
          requiresReschedule: appointment.status === "needs_reschedule"
        }
      }
    });

  } catch (error) {
    console.error("Error auto-processing booking:", error);
    
    // Handle duplicate key errors
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "This appointment slot is already booked. Please choose another time."
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to process booking",
      error: error.message
    });
  }
};

// controllers/pendingBookingController.js

const getPendingBookings = async (req, res) => {
  try {
    const { clinicId } = req.params;
    const { status = "pending" } = req.query;

    const bookings = await PendingBooking.find({
      clinicId,
      status
    })
    .sort({ createdAt: -1 })
    .lean();

    // Enhance with additional info
    const enhancedBookings = await Promise.all(bookings.map(async (booking) => {
      // Check if patient already exists in system
      const existingPatient = await Patient.findOne({
        clinicId,
        $or: [
          { phone: booking.patientDetails.phone },
          { email: booking.patientDetails.email }
        ]
      }).select('_id name patientUniqueId');

      // Check if time slot is available
      const timeSlotTaken = await Appointment.findOne({
        clinicId,
        department: booking.requestedAppointment.department,
        appointmentDate: booking.requestedAppointment.preferredDate,
        appointmentTime: booking.requestedAppointment.preferredTime,
        status: { $in: ["scheduled", "confirmed"] }
      });

      return {
        ...booking,
        patientExists: !!existingPatient,
        existingPatientData: existingPatient || null,
        timeSlotAvailable: !timeSlotTaken,
        timeSlotConflict: !!timeSlotTaken
      };
    }));

    return res.json({
      success: true,
      data: enhancedBookings
    });

  } catch (error) {
    console.error("Error fetching pending bookings:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};
// controllers/pendingBookingController.js

const rejectBooking = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { clinicId, userId, userRole, rejectionReason } = req.body;

    if (!["receptionist", "admin"].includes(userRole)) {
      return res.status(403).json({ success: false, message: "Unauthorized" });
    }

    const booking = await PendingBooking.findOne({
      _id: bookingId,
      clinicId,
      status: "pending"
    });

    if (!booking) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }

    booking.status = "rejected";
    booking.rejectionReason = rejectionReason;
    booking.processedBy = userId;
    booking.processedAt = new Date();
    await booking.save();

    return res.json({
      success: true,
      message: "Booking request rejected",
      data: booking
    });

  } catch (error) {
    console.error("Error rejecting booking:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};
export  {submitBookingRequest,autoProcessBooking,getPendingBookings,rejectBooking};