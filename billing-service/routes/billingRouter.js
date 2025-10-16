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
  getBillByNumber
} from "../controller/billingController.js";

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

// Get single bill by ID
billingRouter.route("/:billId").get(getBillById);

// Get bill by bill number
billingRouter.route("/number/:billNumber").get(getBillByNumber);

// ============================================
// 🔄 SYNC OPERATIONS
// ============================================

// Sync pharmacy order to billing database
billingRouter.route("/sync-pharmacy/:orderId").post(syncPharmacyOrderToBilling);

// Add payment to a bill (supports multiple payments)
billingRouter.route("/:billId/add-payment").post(addPaymentToBill);

// Update payment status (legacy - use add-payment instead)
billingRouter.route("/:billId/payment").patch(updatePaymentStatus);

// Cancel a bill
billingRouter.route("/:billId/cancel").patch(cancelBill);

export default billingRouter;