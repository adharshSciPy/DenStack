import LabOrder from "../model/LabOrderSchema.js";
import LabVendor from "../model/LabVendor.js";
import axios from "axios";

 const createLabOrder = async (req, res) => {
  try {
    const {
      labId,
      clinicId,
      doctorId,
      patientId,
      orderType,
      toothNumbers,
      consultationId,
      expectedDeliveryDate,

    } = req.body;

    // ✅ 1. Basic input validation
    if (!labId || !clinicId || !doctorId || !patientId || !orderType || !consultationId) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    // ✅ 2. Ensure lab belongs to clinic
    const lab = await LabVendor.findOne({ _id: labId, clinicId });
    if (!lab) {
      return res.status(400).json({
        message: "Invalid lab selection — lab does not belong to this clinic",
      });
    }

    // ✅ 3. Verify patient belongs to the same clinic (via Patient microservice)
    try {
      const verifyResponse = await axios.post(
        `${process.env.PATIENT_SERVICE_URL}/api/v1/patient-service/patient/verify`,
        { patientId, clinicId }
      );
      console.log("Patient verification response:", verifyResponse.data);
      
      // Check the microservice response
      if (!verifyResponse.data?.success) {
        return res.status(404).json({
          message: "Patient not found in this clinic",
        });
      }
    } catch (error) {
      console.error("Patient verification error:", error.response?.data || error.message);
      return res.status(400).json({
        message: "Failed to verify patient in clinic",
      });
    }

    // ✅ 4. Create the lab order (if patient check passes)
    const order = new LabOrder({
      labId,
      clinicId,
      doctorId,
      patientId,
      orderType,
      toothNumbers,
      consultationId,
      expectedDeliveryDate,
      statusHistory: [{ status: "Pending", note: "Order created by doctor" }],
    });

    await order.save();

    res.status(201).json({
      message: "Lab order created successfully",
      order,
    });
  } catch (error) {
    console.error("Create lab order error:", error);
    res.status(500).json({ message: error.message });
  }
};


 const updateOrderStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status, note } = req.body;

    const order = await LabOrder.findById(orderId);
    if (!order) return res.status(404).json({ message: "Order not found" });    
    const consultationId = order.consultationId;
    order.statusHistory.push({ status, note });
    order.status = status;
    await order.save();

    if (status === "Delivered") {
      try {
        await axios.patch(`${process.env.PATIENT_SERVICE_URL}/api/v1/patient-service/appointment/lab-details/${consultationId}`, {
          labOrderId: order._id,
        });
      } catch (err) {
        console.error("Error updating patient lab reports:", err.message);
      }
    }

    res.json({ message: "Order status updated", order });
  } catch (error) {
    console.error("Update order error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

const getPendingLabOrders = async (req, res) => {
  try {
    // Find all lab orders where status is 'Pending'
    const pendingOrders = await LabOrder.find({ status: "Pending" })
      .populate("patientId" ) // optional: include patient details
      .sort({ createdAt: -1 }); // newest first

    if (!pendingOrders.length) {
      return res.status(404).json({ message: "No pending lab orders found" });
    }

    res.status(200).json({
      message: "Pending lab orders fetched successfully",
      count: pendingOrders.length,
      pendingOrders,
    });
  } catch (error) {
    console.error("Error fetching pending lab orders:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

export { createLabOrder,updateOrderStatus,getPendingLabOrders };