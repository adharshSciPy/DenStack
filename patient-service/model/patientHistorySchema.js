import mongoose,{Schema} from "mongoose";
const dentalChartSchema = new Schema({
    toothNumber: { type: Number, required: true, min: 1, max: 32 },
    status: {
      type: String,
      enum: ['healthy', 'filled', 'crowned', 'root-canal', 'missing', 'decayed'],
      default: 'healthy'
    },
  notes: String,
  procedures: [
    {
      name: String,
      performedBy: { type: Schema.Types.ObjectId, ref: "Doctor" },
      performedAt: Date,
    }
  ]
});


const patientHistorySchema = new mongoose.Schema(
  {
    patientId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "Patient", 
      required: true 
    },
    clinicId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "Clinic", 
      required: true 
    },
    doctorId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "Doctor",
      required: true 
    },
    appointmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Appointment",
      required: true
    },
    visitDate: { type: Date, default: Date.now },
    
    // ✅ Doctor-entered data
    symptoms: { type: [String], default: [] },
    diagnosis: { type: [String], default: [] },
    prescriptions: [
      {
        medicineName: { type: String, required: true },
        dosage: { type: String },
        frequency: { type: String },
        duration: { type: String },
      },
    ],
    notes: { type: String, maxlength: [1000, "Notes cannot exceed 1000 characters"] },
    files: [
  {
    url: { type: String, required: true }, // Accept relative URL
    type: { type: String, enum: ["image", "pdf", "report", "other"], default: "other" },
    uploadedAt: { type: Date, default: Date.now }
  }
]
,
    labHistory: [
      {
        type: mongoose.Schema.Types.ObjectId,
      }
    ],
    treatmentPlanId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TreatmentPlan"
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
      ref: "Billing" 
    }, //Reference to billing record
    
    status: { type: String, enum: ["pending","completed"], default: "completed" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Doctor", required: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Doctor" },
       referral: {
      referredByDoctorId: { type: mongoose.Schema.Types.ObjectId, ref: "Doctor" },
      referredToDoctorId: { type: mongoose.Schema.Types.ObjectId, ref: "Doctor" },
      referralReason: { type: String, maxlength: 500 },
      referralDate: { type: Date },
      status: { type: String, enum: ["pending", "accepted", "completed"], default: "pending" },
    },
    dentalChart: { type: [dentalChartSchema], required: false },

    receptionBilling: {
  procedureCharges: [
    {
      name: { type: String, required: true },
      fee: { type: Number, required: true },
      notes: String
    }
  ],
  consumableCharges: [
    {
      item: { type: String, required: true },
      fee: { type: Number, required: true },
      notes: String
    }
  ],
  addedBy: { type: Schema.Types.ObjectId, ref: "User" },
  updatedAt: { type: Date }
},



  },
  

  { timestamps: true }
);

patientHistorySchema.methods.calculateTotalAmount = function () {
  const doctorProceduresTotal =
    this.procedures?.reduce((sum, p) => sum + (p.fee || 0), 0) || 0;

  const receptionProcedureTotal =
    this.receptionBilling?.procedureCharges?.reduce(
      (sum, p) => sum + (p.fee || 0),
      0
    ) || 0;

  const consumableTotal =
    this.receptionBilling?.consumableCharges?.reduce(
      (sum, c) => sum + (c.fee || 0),
      0
    ) || 0;

  const labTotal =
    this.labHistory?.reduce(
      (sum, labOrderId) => sum + (this.__labCharges?.[labOrderId] || 0),
      0
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