import mongoose, { Schema } from "mongoose";
import {
  TOOTH_CONDITIONS,
  TOOTH_SURFACES,
} from "../middleware/toothSurfaceAndConditions.js";
//tooth based
const surfaceConditionSchema = new Schema({
  surface: { type: String, enum: TOOTH_SURFACES, required: true },
  conditions: [{ type: String}],//examination of the surface 
});
const procedureExecutionSchema = new Schema({
  name: { type: String, required: true },
  surface: { type: String, enum: TOOTH_SURFACES, required: true },

  status: {
    type: String,
    enum: ["planned", "in-progress", "completed"],
    default: "planned",
  },

  cost: Number,
  notes: String,

  performedBy: { type: Schema.Types.ObjectId, ref: "Doctor" },
  performedAt: { type: Date, default: Date.now },

  // 🔗 link to treatment plan (optional but recommended)
  treatmentPlanProcedureId: Schema.Types.ObjectId,
});

const visitToothSchema = new mongoose.Schema({
  toothNumber: { type: Number, required: true },
  // surface: { type: String, enum: TOOTH_SURFACES, required: true },

  conditions: [{ type: String }],

  surfaceConditions: [surfaceConditionSchema],

  procedures: [procedureExecutionSchema],
    notes: { type: String, maxlength: 1000 },
});
//reusable schema for both soft tissues and tmj (custom+dropdown value storing )
const clinicalEntrySchema = new Schema(
  {
    value: { type: String, required: true },
    isCustom: { type: Boolean, default: false },
  },
  { _id: false },
);
//soft tissue based
const softTissueSchema = new Schema(
  {
    id: { type: String, required: true },
    name: { type: String, required: true },
    onExamination: [clinicalEntrySchema], // Examination findings
    diagnosis: [clinicalEntrySchema],     // Diagnosis
    treatment: [clinicalEntrySchema],     // Treatment plan
    notes: { type: String, maxlength: 1000 },
  },
  { _id: false }
);
//tmj based
const tmjSchema = new Schema(
  {
    id: { type: String, required: true },
    name: { type: String, required: true },
    onExamination: [clinicalEntrySchema], // Examination findings
    diagnosis: [clinicalEntrySchema],     // Diagnosis
    treatment: [clinicalEntrySchema],     // Treatment plan
    notes: { type: String, maxlength: 1000 },
  },
  { _id: false }
);
const patientHistorySchema = new mongoose.Schema(
  {
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Patient",
      required: true,
    },
    clinicId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Clinic",
      required: true,
    },
    doctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Doctor",
      required: true,
    },
    appointmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Appointment",
      required: true,
    },
    visitDate: { type: Date, default: Date.now },

        chiefComplaints: [clinicalEntrySchema],

    // ✅ NEW: Examination Findings - Multi-select dropdown with custom entries
    examinationFindings: [clinicalEntrySchema],

    // ✅ NEW: Dental History - Multi-select dropdown with custom entries
    dentalHistory: [clinicalEntrySchema],

    // ✅ Diagnosis - Multi-line text input (keeping for backward compatibility)
    diagnosis: { type: [String], default: [] },

    // Prescriptions
    prescriptions: [
      {
        medicineName: { type: String, required: true },
        dosage: { type: String },
        frequency: { type: String },
        duration: { type: String },
        instructions: { type: String },
        medicineId: { type: Schema.Types.ObjectId, ref: "Medicine" },
        genericName: String,
        brandNames: [String],
        dosageForms: [String],
        strengths: [String],
        category: String,
      },
    ],
    notes: {
      type: String,
      maxlength: [1000, "Notes cannot exceed 1000 characters"],
    },
    files: [
      {
        url: { type: String, required: true }, // Accept relative URL
        type: {
          type: String,
          enum: ["image", "pdf", "report", "other"],
          default: "other",
        },
        uploadedAt: { type: Date, default: Date.now },
      },
    ],
    labHistory: [
      {
        type: mongoose.Schema.Types.ObjectId,
      },
    ],
    treatmentPlanId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TreatmentPlan",
    },

    // 💰 Billing Information
    consultationFee: { type: Number, default: 0 },
    procedures: [
      {
        name: { type: String, required: true },
        description: { type: String },
        fee: { type: Number, required: true, min: 0 },
      },
    ],
    totalAmount: { type: Number, default: 0 },
    isPaid: { type: Boolean, default: false }, //Payment status flag
    billId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Billing",
    }, //Reference to billing record

    status: {
      type: String,
      enum: ["pending", "completed"],
      default: "completed",
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Doctor",
      required: true,
    },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Doctor" },
    referral: {
      referredByDoctorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Doctor",
      },
      referredToDoctorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Doctor",
      },
      referralReason: { type: String, maxlength: 500 },
      referralDate: { type: Date },
      status: {
        type: String,
        enum: ["pending", "accepted", "completed"],
        default: "pending",
      },
    },
        dentalWork: [visitToothSchema],

    // ✅ Soft Tissue Examination - Updated with three dropdowns
    softTissueExamination: {
      type: [softTissueSchema],
      default: [],
    },

    // ✅ TMJ Examination - Updated with three dropdowns
    tmjExamination: {
      type: [tmjSchema],
      default: [],
    },

    // ✅ Planned Procedures from Dental Chart
    plannedProcedures: [
      {
        toothNumber: Number,
        name: String,
        surface: { type: String, enum: TOOTH_SURFACES },
        estimatedCost: { type: Number, default: 0 },
        notes: String,
      },
    ],
    receptionBilling: {
      procedureCharges: [
        {
          name: { type: String, required: true },
          fee: { type: Number, required: true },
          notes: String,
        },
      ],
      consumableCharges: [
        {
          item: { type: String, required: true },
          fee: { type: Number, required: true },
          notes: String,
        },
      ],
      addedBy: { type: Schema.Types.ObjectId, ref: "User" },
      updatedAt: { type: Date },
    },
  },

  { timestamps: true },
);

patientHistorySchema.methods.calculateTotalAmount = function () {
  const doctorProceduresTotal =
    this.procedures?.reduce((sum, p) => sum + (p.fee || 0), 0) || 0;

  const receptionProcedureTotal =
    this.receptionBilling?.procedureCharges?.reduce(
      (sum, p) => sum + (p.fee || 0),
      0,
    ) || 0;

  const consumableTotal =
    this.receptionBilling?.consumableCharges?.reduce(
      (sum, c) => sum + (c.fee || 0),
      0,
    ) || 0;

  const labTotal =
    this.labHistory?.reduce(
      (sum, labOrderId) => sum + (this.__labCharges?.[labOrderId] || 0),
      0,
    ) || 0;

  this.totalAmount =
    (this.consultationFee || 0) +
    doctorProceduresTotal +
    receptionProcedureTotal +
    consumableTotal +
    labTotal;

  return this.totalAmount;
};

// 🔹 Pre-save hook ensures totalAmount is always up-to-date
patientHistorySchema.pre("save", function (next) {
  this.calculateTotalAmount();
  next();
});

patientHistorySchema.index({ patientId: 1, visitDate: -1 });
patientHistorySchema.index({ patientId: 1, isPaid: 1 }); // ✅ Index for unpaid bills query
patientHistorySchema.index({ patientId: 1, clinicId: 1, visitDate: -1 });

export default mongoose.model("PatientHistory", patientHistorySchema);
