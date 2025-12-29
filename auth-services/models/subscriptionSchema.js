import mongoose, { Schema } from "mongoose";



const subscriptionSchema = new Schema(
  {
    // ========================= CLINIC REFERENCE ========================= //
    clinicId: { 
      type: String, 
      required: true, 
      unique: true,
      index: true 
    },
    
    clinicName: { 
      type: String, 
      required: true, 
      trim: true 
    },
    
    clinicEmail: { 
      type: String, 
      required: true, 
      lowercase: true, 
      trim: true 
    },

    clinicType: { 
      type: String, 
      enum: ["single", "clinic", "hospital"], 
      default: "clinic" 
    },

    clinicRole: {
      type: String,
      default: "700" // Role from clinic microservice
    },

    // ========================= SUBSCRIPTION DETAILS ========================= //
    subscription: {
      package: {
        type: String,
        enum: ["starter", "growth", "enterprise"],
        default: "starter",
      },
      type: {
        type: String,
        enum: ["annual"],
        default: "annual",
      },
      price: {
        type: Number,
        default: 0,
        required: true
      },
      startDate: { 
        type: Date, 
        required: true,
        index: true 
      },
      endDate: { 
        type: Date,
        required: true,
        index: true 
      },
      isActive: { 
        type: Boolean, 
        default: true,
        index: true 
      },
      nextBillingDate: { type: Date },
      lastPaymentDate: { type: Date },
      transactionId: { type: String },
    },

    // ========================= ADDITIONAL METADATA ========================= //
    features: {
      patientTreatmentPlans: { type: Boolean, default: true },
      appointmentBooking: { type: Boolean, default: true },
      billing: { type: Boolean, default: true },
      reporting: { type: Boolean, default: true },
      smartDashboard: { type: Boolean, default: false },
      whatsappReminder: { type: Boolean, default: false },
      miniAccounts: { type: Boolean, default: false },
      vendorDashboard: { type: Boolean, default: false },
      pharmacyInventory: { type: Boolean, default: false },
      multiBranch: { type: Boolean, default: false },
      doctorWiseReports: { type: Boolean, default: false },
      analytics: { type: Boolean, default: false },
    },

    // ========================= SYNC METADATA ========================= //
    lastSyncedAt: { 
      type: Date, 
      default: Date.now 
    },
    
    isDeleted: { 
      type: Boolean, 
      default: false 
    }
  },
  { 
    timestamps: true,
    collection: 'subscriptions' // Explicit collection name
  }
);

// ========================= INDEXES ========================= //
subscriptionSchema.index({ 'subscription.startDate': 1 });
subscriptionSchema.index({ 'subscription.endDate': 1 });
subscriptionSchema.index({ 'subscription.isActive': 1 });
subscriptionSchema.index({ 'subscription.package': 1 });

// ========================= STATIC METHODS ========================= //

// Method to sync subscription data from clinic microservice
subscriptionSchema.statics.syncFromClinic = async function(clinicData) {
  const subscriptionDoc = {
    clinicId: clinicData._id.toString(),
    clinicName: clinicData.name,
    clinicEmail: clinicData.email,
    clinicType: clinicData.type,
    subscription: clinicData.subscription,
    features: clinicData.features,
    lastSyncedAt: new Date()
  };

  return await this.findOneAndUpdate(
    { clinicId: subscriptionDoc.clinicId },
    subscriptionDoc,
    { upsert: true, new: true }
  );
};

// Method to mark subscription as deleted
subscriptionSchema.statics.markAsDeleted = async function(clinicId) {
  return await this.findOneAndUpdate(
    { clinicId },
    { isDeleted: true, 'subscription.isActive': false },
    { new: true }
  );
};

const SubscriptionModel = mongoose.model("Subscription", subscriptionSchema);
export default SubscriptionModel;