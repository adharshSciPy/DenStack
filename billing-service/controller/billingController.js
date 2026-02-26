import axios from "axios";
import Billing from "../Model/billingSchema.js";
import dotenv from "dotenv";
dotenv.config();

const PHARMACY_SERVICE_BASE_URL = process.env.PHARMACY_SERVICE_BASE_URL;
const PATIENT_SERVICE_BASE_URL = process.env.PATIENT_SERVICE_BASE_URL;

/**
 * Get COMPLETE billing for a patient (Consultation + Procedures + Pharmacy)
 * GET /api/v1/billing/patient/:patientId/complete-bills
 */
export const getPatientCompleteBills = async (req, res) => {
  try {
    const { patientId } = req.params;
    const { clinicId } = req.query; // Required for patient history

    if (!clinicId) {
      return res.status(400).json({
        success: false,
        message: "clinicId is required as query parameter"
      });
    }

    // 1️⃣ Fetch Patient History (Consultation + Procedures)
    let consultationBills = [];
    try {
      const patientHistoryResp = await axios.post(
        `${PATIENT_SERVICE_BASE_URL}/patient-service/appointment/patient-history/${patientId}?clinicId=${clinicId}`,
        { timeout: 10000 }
      );
     
      
      const visits = patientHistoryResp.data?.data || [];
      
      consultationBills = visits.map(visit => ({
        billType: "consultation",
        visitId: visit._id,
        date: visit.createdAt || visit.visitDate,
        consultationFee: visit.consultationFee || 0,
        procedures: visit.procedures?.map(p => ({
          name: p.name,
          cost: p.fee || p.cost || 0
        })) || [],
        procedureTotal: visit.procedures?.reduce((sum, p) => sum + (p.fee || p.cost || 0), 0) || 0,
        totalAmount: visit.totalAmount || visit.consultationFee || 0,
        doctor: visit.doctor?.name,
        symptoms: visit.symptoms,
        diagnosis: visit.diagnosis,
        isPaid: visit.isPaid || false,
        receptionistBilling: visit.receptionBilling || null
      }));
    } catch (error) {
      console.error("Error fetching patient history:", error.message);
    }

    // 2️⃣ Fetch Pharmacy Bills (from Billing DB, not pharmacy service)
    let pharmacyBills = [];
    try {
      // Fetch from Billing database instead of pharmacy service
      const pharmacyBillRecords = await Billing.find({
        patientId,
        billType: "pharmacy"
      }).sort({ billDate: -1 }).lean();

      pharmacyBills = pharmacyBillRecords.map(bill => ({
        billType: "pharmacy",
        billId: bill._id,
        billNumber: bill.billNumber,
        orderId: bill.referenceId,
        date: bill.billDate,
        items: bill.items,
        totalAmount: bill.totalAmount,
        paymentStatus: bill.paymentStatus,
        paidAmount: bill.paidAmount,
        pendingAmount: bill.pendingAmount
      }));
    } catch (error) {
      console.error("Error fetching pharmacy bills from billing DB:", error.message);
      
      // Fallback: Try pharmacy service if needed
      try {
        console.log("Attempting to fetch from pharmacy service...");
        const pharmacyResp = await axios.get(
          `${PHARMACY_SERVICE_BASE_URL}/pharmacy/orders`,
          { timeout: 10000 }
        );
        
        const allOrders = pharmacyResp.data;
        const patientOrders = allOrders.filter(
          order => order.patientId?._id?.toString() === patientId || 
                   order.patientId?.toString() === patientId
        );
        
        pharmacyBills = patientOrders.map(order => ({
          billType: "pharmacy",
          orderId: order._id,
          date: order.createdAt,
          medicines: order.prescriptionItems?.map(item => ({
            name: item.medicineName,
            dosage: item.dosage,
            quantity: item.quantity,
            price: item.price
          })) || [],
          totalAmount: order.totalAmount || 0,
          doctor: order.doctorId?.name,
          vendor: order.vendorId?.name
        }));
      } catch (pharmacyError) {
        console.error("Error fetching from pharmacy service:", pharmacyError.message);
      }
    }

    // 3️⃣ Combine all bills
    const allBills = [...consultationBills, ...pharmacyBills].sort(
      (a, b) => new Date(b.date) - new Date(a.date)
    );

    // 4️⃣ Calculate totals
    const summary = {
      patientId,
      totalBills: allBills.length,
      totalConsultations: consultationBills.length,
      totalPharmacyOrders: pharmacyBills.length,
      consultationTotal: consultationBills.reduce((sum, b) => sum + b.totalAmount, 0),
      pharmacyTotal: pharmacyBills.reduce((sum, b) => sum + b.totalAmount, 0),
      grandTotal: allBills.reduce((sum, b) => sum + b.totalAmount, 0)
    };

    res.status(200).json({
      success: true,
      data: {
        summary,
        bills: allBills
      }
    });

  } catch (error) {
    console.error("Error fetching complete bills:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch complete bills",
      error: error.message
    });
  }
};
/**
 * Get only consultation bills for a patient
 * GET /api/v1/billing/patient/:patientId/consultation-bills?clinicId=xxx
 */
export const getPatientConsultationBills = async (req, res) => {
  try {
    const { patientId } = req.params;
    const { clinicId } = req.query;

    if (!clinicId) {
      return res.status(400).json({
        success: false,
        message: "clinicId is required as query parameter"
      });
    }

    const response = await axios.post(
      `${PATIENT_SERVICE_BASE_URL}/patients/patient-history/${patientId}`,
      { clinicId },
      { timeout: 10000 }
    );

    const visits = response.data?.data || [];

    if (visits.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No consultation records found"
      });
    }

    const consultationBills = visits.map(visit => ({
      visitId: visit._id,
      appointmentId: visit.appointmentId,
      date: visit.createdAt || visit.visitDate,
      consultationFee: visit.consultationFee || 0,
      procedures: visit.procedures?.map(p => ({
        name: p.name,
        cost: p.cost || 0
      })) || [],
      procedureTotal: visit.procedures?.reduce((sum, p) => sum + (p.cost || 0), 0) || 0,
      totalAmount: visit.totalAmount || visit.consultationFee || 0,
      doctor: visit.doctor?.name,
      symptoms: visit.symptoms,
      diagnosis: visit.diagnosis,
      prescriptions: visit.prescriptions,
      notes: visit.notes
    }));

    const totalConsultationFees = consultationBills.reduce((sum, b) => sum + (b.consultationFee || 0), 0);
    const totalProcedureFees = consultationBills.reduce((sum, b) => sum + (b.procedureTotal || 0), 0);
    const grandTotal = consultationBills.reduce((sum, b) => sum + b.totalAmount, 0);

    res.status(200).json({
      success: true,
      data: {
        patientId,
        totalVisits: consultationBills.length,
        totalConsultationFees,
        totalProcedureFees,
        grandTotal,
        bills: consultationBills
      }
    });

  } catch (error) {
    console.error("Error fetching consultation bills:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch consultation bills",
      error: error.message
    });
  }
};

/**
 * Get only pharmacy bills for a patient
 * GET /api/v1/billing/patient/:patientId/pharmacy-bills
 */
export const getPatientPharmacyBills = async (req, res) => {
  try {
    const { patientId } = req.params;

    // Fetch pharmacy bills from Billing database
    const pharmacyBillRecords = await Billing.find({
      patientId,
      billType: "pharmacy"
    }).sort({ billDate: -1 }).lean();

    if (pharmacyBillRecords.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No pharmacy bills found for this patient"
      });
    }

    const pharmacyBills = pharmacyBillRecords.map(bill => ({
      billId: bill._id,
      billNumber: bill.billNumber,
      orderId: bill.referenceId,
      date: bill.billDate,
      items: bill.items?.map(item => ({
        name: item.name,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice
      })) || [],
      totalAmount: bill.totalAmount,
      paymentStatus: bill.paymentStatus,
      paidAmount: bill.paidAmount,
      pendingAmount: bill.pendingAmount,
      payments: bill.payments
    }));

    const totalAmount = pharmacyBills.reduce((sum, b) => sum + b.totalAmount, 0);
    const paidAmount = pharmacyBills.reduce((sum, b) => sum + b.paidAmount, 0);
    const pendingAmount = pharmacyBills.reduce((sum, b) => sum + b.pendingAmount, 0);

    res.status(200).json({
      success: true,
      data: {
        patientId,
        totalOrders: pharmacyBills.length,
        totalAmount,
        paidAmount,
        pendingAmount,
        bills: pharmacyBills
      }
    });

  } catch (error) {
    console.error("Error fetching pharmacy bills:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch pharmacy bills",
      error: error.message
    });
  }
};

/**
 * Get all patients' bills grouped by clinic
 * GET /api/v1/billing/clinic/:clinicId/all-bills
 */
export const getAllPatientsBillsByClinic = async (req, res) => {
  try {
    const { clinicId } = req.params;

    console.log('🔍 Fetching bills for clinicId:', clinicId);

    // Validate clinicId
    if (!clinicId || !/^[a-f\d]{24}$/i.test(clinicId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid clinicId format"
      });
    }

    // 1️⃣ Fetch all patients from this clinic
    console.log('📞 Fetching patients...');
    const patientsResp = await axios.get(
      `${PATIENT_SERVICE_BASE_URL}/patient-service/patient/all-patients/${clinicId}`,
      { timeout: 15000 }
    );

    const patients = patientsResp.data?.data || [];
    console.log('✅ Patients fetched:', patients.length);

    if (patients.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No patients found for this clinic"
      });
    }

    // 2️⃣ Fetch pharmacy orders
    console.log('📞 Fetching pharmacy orders...');
    console.log('📍 Pharmacy URL:', `${PHARMACY_SERVICE_BASE_URL}/pharmacy/orders`);
    let allOrders = [];
    try {
      const pharmacyResp = await axios.get(
        `${PHARMACY_SERVICE_BASE_URL}/pharmacy/orders`,
        { timeout: 15000 }
      );
      allOrders = pharmacyResp.data || [];
      console.log('✅ Pharmacy orders fetched:', allOrders.length);
    } catch (error) {
      console.error("❌ Error fetching pharmacy orders:", {
        message: error.message,
        status: error.response?.status,
        url: error.config?.url
      });
    }

    // 3️⃣ Build billing summary per patient
    console.log('📊 Building billing summary...');
    const billsByPatient = await Promise.all(
      patients.map(async (patient) => {
        const patientId = patient._id.toString();

        // Fetch patient history
        let consultationTotal = 0;
        let consultationsCount = 0;
        try {
          const historyUrl = `${PATIENT_SERVICE_BASE_URL}/patient-service/appointment/patient-history/${patientId}`;
          console.log(`  📞 Fetching history: ${historyUrl}?clinicId=${clinicId}`);
          
          const historyResp = await axios.get(historyUrl, { 
            params: { clinicId },
            timeout: 5000 
          });
          const visits = historyResp.data?.data || [];
          consultationTotal = visits.reduce((sum, v) => sum + (v.totalAmount || 0), 0);
          consultationsCount = visits.length;
          console.log(`  ✅ ${patient.name}: ${consultationsCount} visits, ₹${consultationTotal}`);
        } catch (err) {
          console.error(`  ❌ Error for patient ${patientId}:`, {
            message: err.message,
            status: err.response?.status,
            url: err.config?.url,
            data: err.response?.data
          });
        }

        // Filter pharmacy orders for this patient
        const patientOrders = allOrders.filter(
          o => o.patientId?._id?.toString() === patientId || o.patientId?.toString() === patientId
        );
        const pharmacyTotal = patientOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);

        return {
          patientId,
          patientName: patient.name,
          patientUniqueId: patient.patientUniqueId,
          consultationTotal,
          pharmacyTotal,
          grandTotal: consultationTotal + pharmacyTotal,
          consultations: consultationsCount,
          pharmacyOrders: patientOrders.length
        };
      })
    );

    const totalRevenue = billsByPatient.reduce((sum, p) => sum + p.grandTotal, 0);
    const totalConsultations = billsByPatient.reduce((sum, p) => sum + p.consultations, 0);
    const totalPharmacyOrders = billsByPatient.reduce((sum, p) => sum + p.pharmacyOrders, 0);

    console.log('✅ Summary complete');

    res.status(200).json({
      success: true,
      data: {
        clinicId,
        totalPatients: billsByPatient.length,
        totalConsultations,
        totalPharmacyOrders,
        totalRevenue,
        patients: billsByPatient
      }
    });

  } catch (error) {
    console.error("❌ Error fetching all patients bills:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch all patients bills",
      error: error.message
    });
  }
};

/**
 * Sync pharmacy order to billing database
 * POST /api/v1/billing/sync-pharmacy/:orderId
 */
export const syncPharmacyOrderToBilling = async (req, res) => {
  try {
    const { orderId } = req.params;

    console.log(`🔄 Syncing pharmacy order: ${orderId}`);

    const response = await axios.get(
      `${PHARMACY_SERVICE_BASE_URL}/pharmacy-orders/orders/${orderId}`
    );

    let order = response.data;
    
    if (order.order) {
      order = order.order;
    }

    console.log(`✅ Pharmacy order fetched successfully`);

    // Check if already exists
    const existingBill = await Billing.findOne({
      referenceId: orderId,
      billType: "pharmacy"
    });

    if (existingBill) {
      return res.status(400).json({
        success: false,
        message: "Billing record already exists for this order"
      });
    }

    // Extract IDs safely
    const patientId = typeof order.patientId === 'object' && order.patientId._id 
      ? order.patientId._id 
      : order.patientId;

    const doctorId = typeof order.doctorId === 'object' && order.doctorId._id
      ? order.doctorId._id
      : order.doctorId;

    const vendorId = typeof order.vendorId === 'object' && order.vendorId._id
      ? order.vendorId._id
      : order.vendorId;

    // ✅ FETCH CLINIC ID FROM PATIENT SERVICE
    let clinicId = null;
    
    if (patientId) {
      try {
        console.log(`🔍 Fetching clinicId for patient: ${patientId}`);
        
        const patientResponse = await axios.get(
          `${PATIENT_SERVICE_BASE_URL}/patient-service/patient/${patientId}`
        );
        
        console.log("📦 Patient response:", JSON.stringify(patientResponse.data, null, 2));
        
        const patient = patientResponse.data?.patient || patientResponse.data?.data || patientResponse.data;
        clinicId = patient?.clinicId;
        
        console.log(`✅ ClinicId found: ${clinicId}`);
        
      } catch (err) {
        console.error("❌ Error fetching patient:", err.message);
        if (err.response) {
          console.error("Response status:", err.response.status);
          console.error("Response data:", err.response.data);
        }
      }
    }

    if (!clinicId) {
      return res.status(400).json({
        success: false,
        message: "Could not determine clinicId for this order. Please ensure the patient exists and has a clinicId assigned.",
        debug: {
          patientId,
          patientServiceUrl: `${PATIENT_SERVICE_BASE_URL}/patient-service/patient/${patientId}`
        }
      });
    }

    console.log(`💾 Creating billing record...`);

    // ✅ MANUALLY GENERATE BILL NUMBER BEFORE CREATING DOCUMENT
    const count = await Billing.countDocuments({ clinicId });
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const generatedBillNumber = `BILL-${year}${month}-${String(count + 1).padStart(6, "0")}`;
    
    console.log(`📋 Generated bill number: ${generatedBillNumber}`);

    const billingRecord = new Billing({
      patientId,
      clinicId,
      billNumber: generatedBillNumber,  // ✅ Explicitly set bill number
      billType: "pharmacy",
      referenceId: orderId,
      items: order.prescriptionItems?.map(item => ({
        name: item.medicineName,
        description: `${item.dosage} - ${item.quantity} units`,
        quantity: item.quantity,
        unitPrice: item.price / item.quantity,
        totalPrice: item.price
      })),
      subtotal: order.totalAmount,
      totalAmount: order.totalAmount,
      doctorId,
      vendorId,
      billDate: order.createdAt || new Date(),
      paymentStatus: "pending",
      paidAmount: 0,
      pendingAmount: order.totalAmount
    });

    await billingRecord.save();

    console.log(`✅ Billing record created: ${billingRecord.billNumber}`);

    res.status(201).json({
      success: true,
      message: "Pharmacy order synced to billing",
      data: billingRecord
    });

  } catch (error) {
    if (error.response) {
      console.error("Service error:", {
        status: error.response.status,
        data: error.response.data,
      });
      
      return res.status(error.response.status).json({
        success: false,
        message: "Error fetching data from service",
        error: error.response.data
      });
    } 
    
    if (error.request) {
      console.error("No response from service");
      return res.status(503).json({
        success: false,
        message: "Service unavailable"
      });
    }

    console.error("Sync error:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to sync pharmacy order",
      error: error.message
    });
  }
};
/**
 * Get billing records from billing database
 * GET /api/v1/billing/patient/:patientId/records
 */
export const getPatientBillingRecords = async (req, res) => {
  try {
    const { patientId } = req.params;
    const { billType, paymentStatus } = req.query;

    const filter = { patientId };
    if (billType) filter.billType = billType;
    if (paymentStatus) filter.paymentStatus = paymentStatus;

    const billingRecords = await Billing.find(filter).sort({ billDate: -1 });

    const summary = {
      totalBills: billingRecords.length,
      totalAmount: billingRecords.reduce((sum, b) => sum + b.totalAmount, 0),
      paidAmount: billingRecords.reduce((sum, b) => sum + b.paidAmount, 0),
      pendingAmount: billingRecords.reduce((sum, b) => sum + b.pendingAmount, 0)
    };

    res.status(200).json({
      success: true,
      data: { summary, bills: billingRecords }
    });

  } catch (error) {
    console.error("Error fetching billing records:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch billing records",
      error: error.message
    });
  }
};
export const updatePaymentStatus = async (req, res) => {
  try {
    const { billId } = req.params;
    const { paidAmount, paymentMethod, paymentStatus } = req.body;

    const bill = await Billing.findById(billId);

    if (!bill) {
      return res.status(404).json({
        success: false,
        message: "Bill not found"
      });
    }

    if (paidAmount) {
      bill.paidAmount += paidAmount;
      bill.pendingAmount = bill.totalAmount - bill.paidAmount;
    }

    if (paymentMethod) bill.paymentMethod = paymentMethod;
    
    if (paymentStatus) {
      bill.paymentStatus = paymentStatus;
    } else {
      if (bill.paidAmount >= bill.totalAmount) {
        bill.paymentStatus = "paid";
      } else if (bill.paidAmount > 0) {
        bill.paymentStatus = "partial";
      }
    }

    if (bill.paymentStatus === "paid" && !bill.paymentDate) {
      bill.paymentDate = new Date();
    }

    await bill.save();

    res.status(200).json({
      success: true,
      message: "Payment updated successfully",
      data: bill
    });

  } catch (error) {
    console.error("Error updating payment:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to update payment",
      error: error.message
    });
  }
};
/*
ConsultationBilling 
*/
export const syncConsultationToBilling = async (req, res) => {
  try {
    const { patientHistoryId } = req.params;
    const { clinicId } = req.body;

    if (!clinicId) {
      return res.status(400).json({
        success: false,
        message: "clinicId is required in request body"
      });
    }

    console.log(`🔄 Syncing consultation: ${patientHistoryId}`);

    // Check if billing record already exists first (avoid unnecessary API calls)
    const existingBill = await Billing.findOne({
      referenceId: patientHistoryId,
      billType: "consultation"
    });

    if (existingBill) {
      return res.status(400).json({
        success: false,
        message: "Billing record already exists for this consultation",
        data: existingBill
      });
    }

    // We need to get the patientId from the patientHistoryId
    // Since we can't query PatientHistory directly, we'll need to:
    // 1. First, try to find if this history was already synced (we check patientId from billing records)
    // 2. Or require patientId to be passed in the request body along with clinicId
    
    // Check if we have patientId in body
    const { patientId } = req.body;
    
    if (!patientId) {
      return res.status(400).json({
        success: false,
        message: "patientId is required in request body along with clinicId"
      });
    }

    // Fetch ALL patient history for this patient and find the specific record
    const response = await axios.post(
      `${PATIENT_SERVICE_BASE_URL}/patient-service/appointment/patient-history/${patientId}`,
      { clinicId },
      { 
        timeout: 10000,
        headers: { 'Content-Type': 'application/json' }
      }
    );

    const visits = response.data?.data || [];
    const visit = visits.find(v => v._id.toString() === patientHistoryId);

    if (!visit) {
      return res.status(404).json({
        success: false,
        message: "Patient history not found"
      });
    }

    console.log(`✅ Patient history fetched successfully`);
    console.log(`📋 Visit data:`, JSON.stringify(visit, null, 2));

    // Build items array from consultation and procedures
    const items = [];

    // Add consultation fee as an item
    if (visit.consultationFee && visit.consultationFee > 0) {
      items.push({
        name: "Consultation Fee",
        description: `Doctor: ${visit.doctor?.name || "N/A"}`,
        quantity: 1,
        unitPrice: visit.consultationFee,
        totalPrice: visit.consultationFee
      });
    }

    // Add procedures as items
    if (visit.procedures && visit.procedures.length > 0) {
      visit.procedures.forEach(proc => {
        items.push({
          name: proc.name,
          description: proc.description || "",
          quantity: 1,
          unitPrice: proc.fee || 0,
          totalPrice: proc.fee || 0
        });
      });
    }

    // Calculate totals
    const subtotal = visit.totalAmount || visit.consultationFee || 0;

    // Use the patientId and clinicId from request body (since they might not be in visit object)
    const visitPatientId = visit.patientId || patientId;
    const visitClinicId = visit.clinicId || clinicId;

    // Generate bill number
    const count = await Billing.countDocuments({ clinicId: visitClinicId });
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const generatedBillNumber = `BILL-${year}${month}-${String(count + 1).padStart(6, "0")}`;

    console.log(`📋 Generated bill number: ${generatedBillNumber}`);

    // Create billing record
    const billingRecord = new Billing({
      patientId: visitPatientId,
      clinicId: visitClinicId,
      billNumber: generatedBillNumber,
      billType: "consultation",
      referenceId: patientHistoryId,
      items,
      subtotal,
      totalAmount: subtotal,
      doctorId: visit.doctorId,
      billDate: visit.visitDate || visit.createdAt || new Date(),
      paymentStatus: visit.isPaid ? "paid" : "pending",
      paidAmount: visit.isPaid ? subtotal : 0,
      pendingAmount: visit.isPaid ? 0 : subtotal,
      notes: visit.notes || ""
    });

    // If already paid, add payment record
    if (visit.isPaid) {
      billingRecord.payments.push({
        amount: subtotal,
        method: "cash", // default, can be updated later
        paidAt: visit.updatedAt || new Date(),
        notes: "Payment recorded during consultation"
      });
      billingRecord.paymentDate = visit.updatedAt || new Date();
    }

    await billingRecord.save();

    console.log(`✅ Billing record created: ${billingRecord.billNumber}`);

    res.status(201).json({
      success: true,
      message: "Consultation synced to billing",
      data: billingRecord
    });

  } catch (error) {
    if (error.response) {
      console.error("Service error:", {
        status: error.response.status,
        data: error.response.data,
      });
      
      return res.status(error.response.status).json({
        success: false,
        message: "Error fetching data from service",
        error: error.response.data
      });
    }
    
    if (error.request) {
      console.error("No response from service");
      return res.status(503).json({
        success: false,
        message: "Service unavailable"
      });
    }

    console.error("Sync error:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to sync consultation",
      error: error.message
    });
  }
};

/**
 * Mark consultation as paid and sync to billing
 * POST /api/v1/billing/mark-paid/:patientHistoryId
 * Body: { amount?, method?, transactionId?, receivedBy?, notes? }
 */
export const markConsultationAsPaid = async (req, res) => {
  try {
    const { patientHistoryId } = req.params;
    const { amount, method, transactionId, receivedBy, notes } = req.body;
    console.log(patientHistoryId);
    
    // First sync to billing if not already synced
    let bill = await Billing.findOne({
      referenceId: patientHistoryId,
      billType: "consultation"
    });
    console.log("jhb",bill);
    
    if (!bill) {
      const { clinicId } = req.body;
      
      if (!clinicId) {
        return res.status(400).json({
          success: false,
          message: "clinicId is required in request body"
        });
      }
      console.log(clinicId);
      
      // Fetch and create billing record first
      try {
        const response = await axios.post(
        `${PATIENT_SERVICE_BASE_URL}/patient-service/appointment/patient-history/${patientHistoryId}?clinicId=${clinicId}`,
      );
      
      console.log("sasa",response);
    } catch (error) {
      console.error("Error fetching patient history:", error.message);
      return res.status(500).json({
        success: false,
        message: "Failed to fetch patient history"
      });
    }
    

      const visit = response.data?.data || response.data;
      
      if (!visit) {
        return res.status(404).json({
          success: false,
          message: "Patient history not found"
        });
      }

      // Create billing record (similar to syncConsultationToBilling)
      const items = [];
      
      if (visit.consultationFee > 0) {
        items.push({
          name: "Consultation Fee",
          description: `Doctor: ${visit.doctor?.name || "N/A"}`,
          quantity: 1,
          unitPrice: visit.consultationFee,
          totalPrice: visit.consultationFee
        });
      }

      if (visit.procedures && visit.procedures.length > 0) {
        visit.procedures.forEach(proc => {
          items.push({
            name: proc.name,
            description: proc.description || "",
            quantity: 1,
            unitPrice: proc.fee || 0,
            totalPrice: proc.fee || 0
          });
        });
      }

      const subtotal = visit.totalAmount || visit.consultationFee || 0;
      const count = await Billing.countDocuments({ clinicId: visit.clinicId });
      const date = new Date();
      const year = date.getFullYear().toString().slice(-2);
      const month = String(date.getMonth() + 1).padStart(2, "0");
      
      bill = new Billing({
        patientId: visit.patientId,
        clinicId: visit.clinicId,
        billNumber: `BILL-${year}${month}-${String(count + 1).padStart(6, "0")}`,
        billType: "consultation",
        referenceId: patientHistoryId,
        items,
        subtotal,
        totalAmount: subtotal,
        doctorId: visit.doctorId,
        billDate: visit.visitDate || visit.createdAt || new Date(),
        paymentStatus: "pending",
        paidAmount: 0,
        pendingAmount: subtotal
      });
    }

    // Add payment
    const paymentAmount = amount || bill.pendingAmount;
    
    await bill.addPayment({
      amount: paymentAmount,
      method: method || "cash",
      transactionId,
      receivedBy,
      notes
    });

    // Update PatientHistory isPaid flag
    try {
      await axios.patch(
        `${PATIENT_SERVICE_BASE_URL}/patients/history/${patientHistoryId}/mark-paid`,
        { isPaid: bill.paymentStatus === "paid" }
      );
    } catch (err) {
      console.error("Warning: Could not update PatientHistory isPaid flag:", err.message);
    }

    res.status(200).json({
      success: true,
      message: "Payment recorded successfully",
      data: {
        billId: bill._id,
        billNumber: bill.billNumber,
        paymentStatus: bill.paymentStatus,
        totalAmount: bill.totalAmount,
        paidAmount: bill.paidAmount,
        pendingAmount: bill.pendingAmount,
        payments: bill.payments
      }
    });

  } catch (error) {
    console.error("Error marking consultation as paid:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to record payment",
      error: error.message
    });
  }
};

/**
 * Get unpaid consultations for a patient
 * GET /api/v1/billing/patient/:patientId/unpaid-consultations
 */
export const getUnpaidConsultations = async (req, res) => {
  try {
    const { patientId } = req.params;
    const { clinicId } = req.query;

    // Get unpaid bills from billing service
    const unpaidBills = await Billing.find({
      patientId,
      billType: "consultation",
      paymentStatus: { $in: ["pending", "partial"] }
    }).sort({ billDate: -1 });

    // Also check PatientHistory for visits not yet synced to billing
    let unsyncedVisits = [];
    if (clinicId) {
      try {
        const response = await axios.post(
          `${PATIENT_SERVICE_BASE_URL}/patients/patient-history/${patientId}`,
          { clinicId },
          { timeout: 10000 }
        );

        const visits = response.data?.data || [];
        
        // Find visits that are unpaid and not in billing
        const syncedReferenceIds = new Set(unpaidBills.map(b => b.referenceId));
        
        unsyncedVisits = visits
          .filter(v => !v.isPaid && !syncedReferenceIds.has(v._id.toString()))
          .map(v => ({
            visitId: v._id,
            visitDate: v.visitDate || v.createdAt,
            consultationFee: v.consultationFee || 0,
            procedures: v.procedures,
            totalAmount: v.totalAmount || v.consultationFee || 0,
            doctor: v.doctor?.name,
            needsSync: true
          }));
      } catch (err) {
        console.error("Error fetching unsynced visits:", err.message);
      }
    }

    const total = unpaidBills.reduce((sum, b) => sum + b.pendingAmount, 0) +
                  unsyncedVisits.reduce((sum, v) => sum + v.totalAmount, 0);

    res.status(200).json({
      success: true,
      data: {
        syncedUnpaidBills: unpaidBills,
        unsyncedVisits,
        summary: {
          totalUnpaidBills: unpaidBills.length,
          totalUnsyncedVisits: unsyncedVisits.length,
          totalPendingAmount: total
        }
      }
    });

  } catch (error) {
    console.error("Error fetching unpaid consultations:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch unpaid consultations",
      error: error.message
    });
  }
};
/**
 * Add payment to bill (supports multiple payments)
 * POST /api/v1/billing/:billId/add-payment
 */
export const addPaymentToBill = async (req, res) => {
  try {
    const { billId } = req.params;
    const { amount, method, transactionId, receivedBy, notes } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid payment amount is required"
      });
    }

    if (!method) {
      return res.status(400).json({
        success: false,
        message: "Payment method is required"
      });
    }

    const bill = await Billing.findById(billId);

    if (!bill) {
      return res.status(404).json({
        success: false,
        message: "Bill not found"
      });
    }

    // Check if payment exceeds pending amount
    if (amount > bill.pendingAmount) {
      return res.status(400).json({
        success: false,
        message: `Payment amount (${amount}) exceeds pending amount (${bill.pendingAmount})`
      });
    }

    // Use the schema method to add payment
    await bill.addPayment({ amount, method, transactionId, receivedBy, notes });

    res.status(200).json({
      success: true,
      message: "Payment added successfully",
      data: {
        billId: bill._id,
        billNumber: bill.billNumber,
        totalAmount: bill.totalAmount,
        paidAmount: bill.paidAmount,
        pendingAmount: bill.pendingAmount,
        paymentStatus: bill.paymentStatus,
        payments: bill.payments
      }
    });

  } catch (error) {
    console.error("Error adding payment:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to add payment",
      error: error.message
    });
  }
};

/**
 * Cancel a bill
 * PATCH /api/v1/billing/:billId/cancel
 */
export const cancelBill = async (req, res) => {
  try {
    const { billId } = req.params;
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({
        success: false,
        message: "Cancellation reason is required"
      });
    }

    const bill = await Billing.findById(billId);

    if (!bill) {
      return res.status(404).json({
        success: false,
        message: "Bill not found"
      });
    }

    if (bill.paymentStatus === "paid") {
      return res.status(400).json({
        success: false,
        message: "Cannot cancel a paid bill. Please process a refund instead."
      });
    }

    await bill.cancelBill(reason);

    res.status(200).json({
      success: true,
      message: "Bill cancelled successfully",
      data: bill
    });

  } catch (error) {
    console.error("Error cancelling bill:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to cancel bill",
      error: error.message
    });
  }
};

/**
 * Get bill by ID
 * GET /api/v1/billing/:billId
 */
export const getBillById = async (req, res) => {
  try {
    const { billId } = req.params;

    const bill = await Billing.findById(billId);

    if (!bill) {
      return res.status(404).json({
        success: false,
        message: "Bill not found"
      });
    }

    res.status(200).json({
      success: true,
      data: bill
    });

  } catch (error) {
    console.error("Error fetching bill:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch bill",
      error: error.message
    });
  }
};

/**
 * Get bill by bill number
 * GET /api/v1/billing/number/:billNumber
 */
export const getBillByNumber = async (req, res) => {
  try {
    const { billNumber } = req.params;

    const bill = await Billing.findOne({ billNumber });

    if (!bill) {
      return res.status(404).json({
        success: false,
        message: "Bill not found"
      });
    }

    res.status(200).json({
      success: true,
      data: bill
    });

  } catch (error) {
    console.error("Error fetching bill:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch bill",
      error: error.message
    });
  }
};