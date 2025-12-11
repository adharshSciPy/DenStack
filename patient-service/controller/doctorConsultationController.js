import PatientHistory from "../model/patientHistorySchema.js";
import Appointment from "../model/appointmentSchema.js";
import Patient from "../model/patientSchema.js";
import mongoose from "mongoose";
import axios from "axios";
import dotenv from "dotenv";
import TreatmentPlan from "../model/treatmentPlanSchema.js";
dotenv.config();
const CLINIC_SERVICE_BASE_URL = process.env.CLINIC_SERVICE_BASE_URL;

const consultPatient = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    const { id: appointmentId } = req.params;
      const doctorId = req.doctorId; 
    // const {
    //   symptoms,
    //   diagnosis,
    //   prescriptions,
    //   notes,
    //   files = [],
    //   procedures = [],
    //   treatmentPlan,
    //   referral,
    //     dentalChart = [] 
    // } = req.body;
      const parseJSONField = (field) => {
      if (!field) return [];
      return typeof field === "string" ? JSON.parse(field) : field;
    };

    const symptoms = parseJSONField(req.body.symptoms);
    const diagnosis = parseJSONField(req.body.diagnosis);
    const prescriptions = parseJSONField(req.body.prescriptions);
    const procedures = parseJSONField(req.body.procedures);
    const dentalChart = parseJSONField(req.body.dentalChart);
    const treatmentPlan = req.body.treatmentPlan
      ? typeof req.body.treatmentPlan === "string"
        ? JSON.parse(req.body.treatmentPlan)
        : req.body.treatmentPlan
      : null;
    const referral = req.body.referral
      ? typeof req.body.referral === "string"
        ? JSON.parse(req.body.referral)
        : req.body.referral
      : null;
    const notes = req.body.notes || "";
    const files = parseJSONField(req.body.files);


    // 🧩 Basic validations
    if (!appointmentId || !mongoose.Types.ObjectId.isValid(appointmentId)) {
      return res.status(400).json({ success: false, message: "Invalid appointment ID" });
    }
    if (!doctorId) {
      return res.status(403).json({ success: false, message: "Unauthorized: Missing doctor context" });
    }

    // 🔍 Fetch appointment
    const appointment = await Appointment.findById(appointmentId).session(session);
    if (!appointment) {
      return res.status(404).json({ success: false, message: "Appointment not found" });
    }
    if (appointment.doctorId?.toString() !== doctorId?.toString()) {
      return res.status(403).json({ success: false, message: "Unauthorized: Doctor mismatch" });
    }
    if (appointment.status === "cancelled") {
      return res.status(400).json({ success: false, message: "Cannot consult a cancelled appointment" });
    }

    // 👨‍⚕️ Fetch patient
    const patient = await Patient.findById(appointment.patientId).session(session);
    if (!patient) {
      return res.status(404).json({ success: false, message: "Patient not found" });
    }

    // 💰 Fetch consultation fee
    let consultationFee = 0;
    try {
      const doctorsResp = await axios.get(`${CLINIC_SERVICE_BASE_URL}/active-doctors?clinicId=${appointment.clinicId}`);
      const doctorData = doctorsResp.data?.doctors?.find(
        (d) => d.doctorId?.toString() === doctorId.toString()
      );
      consultationFee = doctorData?.standardConsultationFee ?? 0;
    } catch (err) {
      console.error("Error fetching doctor fee:", err.message);
    }

    // ⚙️ Start transaction
    session.startTransaction();
 const uploadedFiles = (req.files || []).map((file) => ({
      url: `/uploads/${file.filename}`,
      type: file.mimetype.includes("image")
        ? "image"
        : file.mimetype.includes("pdf")
        ? "pdf"
        : "other",
      uploadedAt: new Date(),
    }));

    // Merge manually provided URLs + uploaded files
    const allFiles = [...files, ...uploadedFiles];
    // Create new patient visit record
    const newVisit = new PatientHistory({
      patientId: appointment.patientId,
      clinicId: appointment.clinicId,
      doctorId,
      appointmentId,
      symptoms: Array.isArray(symptoms) ? symptoms : symptoms ? [symptoms] : [],
      diagnosis: Array.isArray(diagnosis) ? diagnosis : diagnosis ? [diagnosis] : [],
      prescriptions: prescriptions || [],
      notes: notes || "",
      files:allFiles,
      procedures,
      consultationFee,
      createdBy: doctorId,
  dentalChart: Array.isArray(dentalChart)
        ? dentalChart.map((tooth) => ({
            toothNumber: tooth.toothNumber,
            status: tooth.status,
            notes: tooth.notes,
            procedures: Array.isArray(tooth.procedures)
              ? tooth.procedures.map((p) => ({
                  name: p.name,
                  performedBy: p.performedBy || doctorId,
                  performedAt: p.performedAt ? new Date(p.performedAt) : new Date(),
                }))
              : [],
          }))
        : []
    });

    // 🩺 Referral details (if present)
    if (referral?.referredToDoctorId) {
      newVisit.referral = {
        referredByDoctorId: doctorId,
        referredToDoctorId: referral.referredToDoctorId,
        referralReason: referral.referralReason,
        referralDate: new Date(),
        status: "pending",
      };
    }

    await newVisit.save({ session });

    // 🧠 Treatment Plan (optional)
    let newPlan = null;
    if (treatmentPlan?.planName) {
      const preparedStages = (treatmentPlan.stages || []).map((s) => ({
        stageName: s.stageName,
        description: s.description,
        scheduledDate: s.scheduledDate ? new Date(s.scheduledDate) : undefined,
        status: "pending",
        procedures: (s.procedures || []).map((p) => ({
          name: p.name,
          doctorId: p.doctorId || doctorId,
          referredByDoctorId: doctorId,
          referredToDoctorId: p.doctorId || doctorId,
          referralNotes: p.referralNotes || "",
          completed: false,
        })),
      }));

      newPlan = new TreatmentPlan({
        patientId: appointment.patientId,
        clinicId: appointment.clinicId,
        createdByDoctorId: doctorId,
        planName: treatmentPlan.planName,
        description: treatmentPlan.description || "",
        stages: preparedStages,
        status: "ongoing",
         dentalChart: Array.isArray(treatmentPlan.dentalChart)
    ? treatmentPlan.dentalChart.map((tooth) => ({
        toothNumber: tooth.toothNumber,
        status: tooth.status,
        notes: tooth.notes,
        procedures: Array.isArray(tooth.procedures)
          ? tooth.procedures.map((p) => ({
              name: p.name,
              performedBy: p.performedBy || doctorId,
              performedAt: p.performedAt ? new Date(p.performedAt) : new Date(),
            }))
          : [],
      }))
    : [],
      });

      await newPlan.save({ session });

      // Link plan to visit
      newVisit.treatmentPlanId = newPlan._id;
      await newVisit.save({ session });

      // Add to patient
      patient.treatmentPlans = [...(patient.treatmentPlans || []), newPlan._id];
    }

    // ✅ Update appointment status & link visit
    await Appointment.findByIdAndUpdate(
      appointmentId,
      { $set: { status: "completed", visitId: newVisit._id } },
      { session }
    );

    // ✅ Update patient history array
    patient.visitHistory = [...(patient.visitHistory || []), newVisit._id];
    await patient.save({ session });

    // 🔒 Commit
    await session.commitTransaction();

    return res.status(201).json({
      success: true,
      message: "Consultation saved successfully",
      patientHistoryId: newVisit._id,
      visit: newVisit,
      treatmentPlan: newPlan || null,
      files:allFiles
    });
  } catch (error) {
    console.error("❌ consultPatient error:", error);
    await session.abortTransaction();
    return res.status(500).json({
      success: false,
      message: "Server error during consultation",
      error: error.message,
    });
  } finally {
    session.endSession();
  }
};

const startTreatmentPlan = async (req, res) => {
  try {
    const { id: patientId } = req.params; // patient id from URL
    const { clinicId, planName, description, stages } = req.body;
         const doctorId = req.doctorId; 


    if (!clinicId || !planName) {
      return res
        .status(400)
        .json({ success: false, message: "Clinic ID and Plan Name are required" });
    }

    // 1️⃣ Create the treatment plan
    const newPlan = await TreatmentPlan.create({
      patientId,
      clinicId,
      createdByDoctorId: doctorId,
      planName,
      description,
      stages,
    });

    // 2️⃣ Update patient record
    await Patient.findByIdAndUpdate(
      patientId,
      { $push: { treatmentPlans: newPlan._id } },
      { new: true }
    );

    // 3️⃣ Find the latest consultation / patient history for this patient
    const latestHistory = await PatientHistory.findOne({ patientId })
      .sort({ createdAt: -1 })
      .limit(1);

    // 4️⃣ Link treatment plan to latest patient history (if exists)
    if (latestHistory) {
      latestHistory.treatmentPlanId = newPlan._id;
      await latestHistory.save();
    }

    res.status(201).json({
      success: true,
      message: "Treatment plan created successfully",
      data: newPlan,
    });
  } catch (error) {
    console.error("Error starting treatment plan:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Server Error while creating treatment plan",
    });
  }
};
const addStageToTreatmentPlan = async (req, res) => {
  try {
    const { id: treatmentPlanId } = req.params;
    const { stageName, description = "", procedures = [], scheduledDate } = req.body;

    const doctorId = req.doctorId; // from authDoctor middleware
    if (!doctorId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    if (!stageName) {
      return res.status(400).json({ success: false, message: "Stage name is required" });
    }

    const treatmentPlan = await TreatmentPlan.findById(treatmentPlanId);
    if (!treatmentPlan) {
      return res.status(404).json({ success: false, message: "Treatment plan not found" });
    }

    if (treatmentPlan.status === "completed") {
      return res.status(400).json({
        success: false,
        message: "Cannot add stage to a completed treatment plan",
      });
    }

    const newStage = {
      stageName,
      description,
      procedures: procedures.map((p) => ({
        name: p.name,
        doctorId: p.doctorId || doctorId, // assign doctor
        referredByDoctorId: doctorId,
        referredToDoctorId: p.doctorId || doctorId,
        referralNotes: p.referralNotes || "",
        completed: false,
      })),
      scheduledDate: scheduledDate || new Date().toISOString(),
      status: "pending",
    };

    treatmentPlan.stages.push(newStage);
    await treatmentPlan.save();

    return res.status(200).json({
      success: true,
      message: "New stage added successfully",
      treatmentPlan,
    });
  } catch (error) {
    console.error("addStageToTreatmentPlan error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while adding stage",
      error: error.message,
    });
  }
};


const updateProcedureStatus = async (req, res) => {
  try {
    const { id: planId, stageIndex, procedureIndex } = req.params;
    const { completed } = req.body;
    const doctorId = req.doctorId;

    if (!doctorId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    if (typeof completed !== "boolean") {
      return res
        .status(400)
        .json({ success: false, message: "Completed status must be boolean" });
    }

    const treatmentPlan = await TreatmentPlan.findById(planId);
    if (!treatmentPlan) {
      return res
        .status(404)
        .json({ success: false, message: "Treatment plan not found" });
    }

    if (treatmentPlan.status === "completed") {
      return res.status(400).json({
        success: false,
        message: "Cannot update procedure in a completed plan",
      });
    }

    const stage = treatmentPlan.stages[stageIndex];
    if (!stage) {
      return res.status(404).json({ success: false, message: "Stage not found" });
    }

    // If procedures array is empty, create a default procedure
    if (!stage.procedures || stage.procedures.length === 0) {
      stage.procedures = [
        {
          name: "Default Procedure",
          doctorId,
          referredByDoctorId: doctorId,
          referredToDoctorId: doctorId,
          referralNotes: "",
          completed: false,
        },
      ];
    }

    const procedure = stage.procedures[procedureIndex];
    if (!procedure) {
      return res
        .status(404)
        .json({ success: false, message: "Procedure not found" });
    }

    procedure.completed = completed;

    // Mark stage completed if all procedures are done
    if (stage.procedures.every((p) => p.completed)) {
      stage.status = "completed";
    }

    await treatmentPlan.save();

    return res.status(200).json({
      success: true,
      message: "Procedure status updated",
      treatmentPlan,
    });
  } catch (error) {
    console.error("updateProcedureStatus error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while updating procedure",
      error: error.message,
    });
  }
};


const finishTreatmentPlan = async (req, res) => {
  try {
    const { id: treatmentPlanId } = req.params;

    const treatmentPlan = await TreatmentPlan.findById(treatmentPlanId);
    if (!treatmentPlan) {
      return res.status(404).json({ success: false, message: "Treatment plan not found" });
    }

    treatmentPlan.status = "completed";
    treatmentPlan.completedAt = new Date();
    await treatmentPlan.save();

    return res.status(200).json({
      success: true,
      message: "Treatment plan marked as completed",
      treatmentPlan,
    });
  } catch (error) {
    console.error("finishTreatmentPlan error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while completing treatment plan",
      error: error.message,
    });
  }
};



export{ consultPatient , startTreatmentPlan,addStageToTreatmentPlan,updateProcedureStatus,finishTreatmentPlan};