import { Router } from "express";
import {
  getPatientCompleteBills,
  getPatientConsultationBills,
  getPatientPharmacyBills,
  getAllPatientsBillsByClinic,
  syncPharmacyOrderToBilling,
  getPatientBillingRecords,
  updatePaymentStatus,
  addPaymentToBill,
  cancelBill,
  getBillById,
  getBillByNumber,
  // ✅ NEW: Consultation billing functions
  syncConsultationToBilling,
  markConsultationAsPaid,
 
  getUnpaidConsultations
} from "../controller/billingController.js";
import { financialDashboard } from "../controller/financialDashboard.js";
import { verifyAuthToken } from "../middleware/authMiddleware.js";
import { authorizeRoles } from "../middleware/authMiddleware.js";
import { authorizeClinicAccess } from "../middleware/authMiddleware.js";
const billingRouter = Router();

// Get complete bills (consultation + pharmacy) for a patient
billingRouter.route("/patient/:patientId/complete-bills").get(getPatientCompleteBills);

// Get only consultation bills for a patient
billingRouter.route("/patient/:patientId/consultation-bills").get(getPatientConsultationBills);

// Get only pharmacy bills for a patient
billingRouter.route("/patient/:patientId/pharmacy-bills").get(getPatientPharmacyBills);

// Get all patients' bills for a clinic (admin dashboard)
billingRouter.route("/clinic/:clinicId/all-bills").get(getAllPatientsBillsByClinic);

// Get billing records from billing database (with filters)
billingRouter.route("/patient/:patientId/records").get(getPatientBillingRecords);

// ✅ NEW: Get unpaid consultations for a patient
billingRouter.route("/patient/:patientId/unpaid-consultations").get(getUnpaidConsultations);

// Get single bill by ID
billingRouter.route("/:billId").get(getBillById);

// Get bill by bill number
billingRouter.route("/number/:billNumber").get(getBillByNumber);

// ============================================
// 🔄 SYNC OPERATIONS
// ============================================

// Sync pharmacy order to billing database
billingRouter.route("/sync-pharmacy/:orderId").post(syncPharmacyOrderToBilling);

// ✅ NEW: Sync consultation/visit to billing database
billingRouter.route("/sync-consultation/:patientHistoryId").post(syncConsultationToBilling);

// ✅ NEW: Mark consultation as paid (auto-syncs if needed)
billingRouter.route("/mark-paid/:patientHistoryId").post(markConsultationAsPaid);

// Add payment to a bill (supports multiple payments)
billingRouter.route("/:billId/add-payment").post(addPaymentToBill);

// Update payment status (legacy - use add-payment instead)
billingRouter.route("/:billId/payment").patch(updatePaymentStatus);

// Cancel a bill
billingRouter.route("/:billId/cancel").patch(cancelBill);


billingRouter.get(
  "/dashboard/:clinicId",
  verifyAuthToken,
  authorizeRoles(500, 700),
  authorizeClinicAccess,
  financialDashboard
);


export default billingRouter;