    import mongoose from "mongoose";

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
            url: { 
              type: String,
              match: [/^https?:\/\/.+\..+/, "Please enter a valid URL"] 
            },
            type: { type: String, enum: ["image", "pdf", "report", "other"], default: "other" },
            uploadedAt: { type: Date, default: Date.now }
          }
        ],

      labHistory: [
      {
        type: mongoose.Schema.Types.ObjectId,
      }
    ],
    consultationFee: { type: Number, default: 0 }, // standard consultation fee
        procedures: [
          {
            name: { type: String, required: true },
            description: { type: String },
            fee: { type: Number, required: true, min: 0 }, // each procedure has its own fee
          },
        ],
        totalAmount: { type: Number, default: 0 }, 


        status: { type: String, enum: ["pending","completed"], default: "completed" },
        createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Doctor", required: true },
        updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Doctor" },
      },
      { timestamps: true }
    );

    patientHistorySchema.methods.calculateTotalAmount = function () {
      const proceduresTotal =
        this.procedures?.reduce((sum, p) => sum + (p.fee || 0), 0) || 0;
      this.totalAmount = (this.consultationFee || 0) + proceduresTotal;
      return this.totalAmount;
    };

    // 🔹 Pre-save hook ensures totalAmount is always up-to-date
    patientHistorySchema.pre("save", function (next) {
      this.calculateTotalAmount();
      next();
    });
    patientHistorySchema.index({ patientId: 1, visitDate: -1 });

    export default mongoose.model("PatientHistory", patientHistorySchema);
