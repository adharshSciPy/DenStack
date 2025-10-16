import mongoose from "mongoose";

const billingSchema = new mongoose.Schema({
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true
  },
  clinicId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true
  },
  
  // Billing details
  billNumber: {
    type: String,
    unique: true,
    required: true
  },
  
  billType: {
    type: String,
    enum: ["pharmacy", "consultation", "lab", "procedure", "other"],
    required: true
  },
  
  // Reference to original order/service
  referenceId: {
    type: String, // pharmacy orderId, appointment id, lab order id, etc.
    required: true
  },
  
  items: [{
    name: String,
    description: String,
    quantity: Number,
    unitPrice: Number,
    totalPrice: Number
  }],
  
  // Amounts
  subtotal: {
    type: Number,
    required: true,
    default: 0
  },
  discount: {
    type: Number,
    default: 0
  },
  tax: {
    type: Number,
    default: 0
  },
  totalAmount: {
    type: Number,
    required: true
  },
  
  // Payment tracking
  paymentStatus: {
    type: String,
    enum: ["pending", "partial", "paid", "cancelled", "refunded"],
    default: "pending"
  },
  
  paidAmount: {
    type: Number,
    default: 0
  },
  
  pendingAmount: {
    type: Number,
    default: 0
  },
  
  // 🔹 IMPROVED: Support multiple payments (patient can pay in installments)
  payments: [{
    amount: Number,
    method: {
      type: String,
      enum: ["cash", "card", "upi", "insurance", "online", "cheque", "other"]
    },
    transactionId: String, // for UPI/card transactions
    paidAt: {
      type: Date,
      default: Date.now
    },
    receivedBy: String, // receptionist/staff who received payment
    notes: String
  }],
  
  paymentMethod: {
    type: String,
    enum: ["cash", "card", "upi", "insurance", "online", "cheque", "other"]
  },
  
  paymentDate: Date, // date of final/first payment
  
  // Additional info
  doctorId: mongoose.Schema.Types.ObjectId,
  vendorId: mongoose.Schema.Types.ObjectId,
  
  notes: String,
  
  // Timestamps
  billDate: {
    type: Date,
    default: Date.now
  },
  
  // 🔹 IMPROVED: Track who created/modified
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User" // can reference receptionist/admin
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },

  // 🔹 NEW: Insurance tracking (if applicable)
  insurance: {
    isInsured: {
      type: Boolean,
      default: false
    },
    provider: String,
    policyNumber: String,
    claimAmount: Number,
    claimStatus: {
      type: String,
      enum: ["pending", "approved", "rejected", "not_applicable"],
      default: "not_applicable"
    }
  }

}, {
  timestamps: true
});

// Indexes for faster queries
billingSchema.index({ patientId: 1, billDate: -1 });
billingSchema.index({ clinicId: 1, billDate: -1 });
billingSchema.index({ paymentStatus: 1 });
billingSchema.index({ billType: 1 });
billingSchema.index({ referenceId: 1 }); // 🔹 NEW: Quick lookup by order/visit ID
billingSchema.index({ billNumber: 1 }); // 🔹 NEW: Search by bill number

// Auto-generate bill number
// Auto-generate bill number
// Auto-generate bill number
// Auto-generate bill number
billingSchema.pre("save", async function(next) {
  try {
    // Generate bill number only for new documents that don't have one
    if (this.isNew && !this.billNumber) {
      const count = await mongoose.model("Billing").countDocuments({ clinicId: this.clinicId });
      const date = new Date();
      const year = date.getFullYear().toString().slice(-2);
      const month = String(date.getMonth() + 1).padStart(2, "0");
      
      this.billNumber = `BILL-${year}${month}-${String(count + 1).padStart(6, "0")}`;
      console.log("✅ Generated bill number:", this.billNumber);
    }
    
    // Always recalculate pending amount
    this.pendingAmount = this.totalAmount - this.paidAmount;
    
    next();
  } catch (err) {
    console.error("❌ Pre-save hook error:", err.message);
    // Generate fallback bill number
    if (this.isNew && !this.billNumber) {
      this.billNumber = `BILL-${Date.now()}`;
    }
    next();
  }
});

// 🔹 NEW: Virtual for checking if bill is fully paid
billingSchema.virtual("isFullyPaid").get(function() {
  return this.paidAmount >= this.totalAmount;
});

// 🔹 NEW: Method to add a payment
billingSchema.methods.addPayment = function(paymentData) {
  const { amount, method, transactionId, receivedBy, notes } = paymentData;
  
  this.payments.push({
    amount,
    method,
    transactionId,
    receivedBy,
    notes,
    paidAt: new Date()
  });
  
  this.paidAmount += amount;
  this.pendingAmount = this.totalAmount - this.paidAmount;
  
  // Update payment status
  if (this.paidAmount >= this.totalAmount) {
    this.paymentStatus = "paid";
    if (!this.paymentDate) this.paymentDate = new Date();
  } else if (this.paidAmount > 0) {
    this.paymentStatus = "partial";
  }
  
  // Store last payment method
  this.paymentMethod = method;
  
  return this.save();
};

// 🔹 NEW: Method to cancel bill
billingSchema.methods.cancelBill = function(reason) {
  this.paymentStatus = "cancelled";
  this.notes = this.notes ? `${this.notes}\nCancelled: ${reason}` : `Cancelled: ${reason}`;
  return this.save();
};

export default mongoose.model("Billing", billingSchema);