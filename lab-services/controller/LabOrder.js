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
    const { clinicId } = req.params;
    const { status } = req.query;
    if (!clinicId) {
      return res.status(400).json({ message: "Clinic ID is required" });
    }
    const query = {
      clinicId
    };
    if (status && status.trim() !== "") {
      query.status = status;
    }
    // Find all lab orders where status is 'Pending' and clinicId matches
     const labOrders = await LabOrder.find(query)
      .populate("patientId")
      .sort({ createdAt: -1 });

    // if (!labOrders.length) {
    //   return res.status(404).json({
    //     message:
    //       status && status.trim() !== ""
    //         ? `No ${status} lab orders found for this clinic`
    //         : "No lab orders found for this clinic",
    //   });
    // }
    // if (!labOrders.length) {
    //   return res.status(404).json({ message: "No pending lab orders found for this clinic" });
    // }

    res.status(200).json({
      message: "Pending lab orders fetched successfully",
      count: labOrders.length,
      labOrders,
    });
  } catch (error) {
    console.error("Error fetching pending lab orders:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

const getLabOrdersbyClinicId = async (req, res) => {
  try {
    const { clinicId } = req.params;

    const lab = await LabVendor.findOne({ clinicId });
    if (!lab) {
      return res.status(404).json({
        message: "Lab not found or not registered under this clinic",
      });
    }

    const labOrders = await LabOrder.find({ labId: lab._id })
      .sort({ createdAt: -1 });

    if (!labOrders.length) {
      return res.status(404).json({
        message: "No lab orders found for this lab",
        count: 0,
        labOrders: [],
      });
    }

    // Extract all patient IDs
    const patientIds = labOrders.map(order => order.patientId);

    // Fetch patient details from patient microservice
    const patientResponses = await Promise.all(
      patientIds.map(id =>
        axios
          .get(`${process.env.PATIENT_SERVICE_URL}/api/v1/patient-service/patient/details/${id}`)
          .then(res => res.data)
          .catch(() => null) // handle if one fails
      )
    );

    console.log(patientResponses);
    // Filter out failed ones
    const patientData = patientResponses.filter(Boolean);

    // Merge patient names into labOrders
    const enrichedOrders = labOrders.map(order => {
      const patient = patientData.find(p => p._id === order.patientId.toString());
      
      return {
        ...order.toObject(),
        patientName:  patient ,
      };
    });

    res.status(200).json({
      message: "Lab orders fetched successfully",
      count: enrichedOrders.length,
      labOrders: enrichedOrders,
    });
  } catch (error) {
    console.error("Error fetching lab orders:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};


 const getLabOrdersStatus = async (req, res) => {
  try {
    const { clinicId, labId } = req.params;
    const { status } = req.query; // ✅ Extract status properly

    if (!clinicId) {
      return res.status(400).json({ message: "Clinic ID is required" });
    }

    // Step 1: Verify lab belongs to this clinic
    const lab = await LabVendor.findOne({ _id: labId, clinicId });
    if (!lab) {
      return res.status(404).json({
        message: "Lab not found or not registered under this clinic",
      });
    }

    // Step 2: Build query dynamically
    const query = {
      clinicId,
      labId,
    };

    // ✅ Apply status condition only if present in query
    if (status && status.trim() !== "") {
      query.status = status;
    }

    // Step 3: Fetch orders
    const labOrders = await LabOrder.find(query)
      .populate("patientId")
      .sort({ createdAt: -1 });

    if (!labOrders.length) {
      return res.status(404).json({
        message:
          status && status.trim() !== ""
            ? `No ${status} lab orders found for this clinic`
            : "No lab orders found for this clinic",
      });
    }

    // Step 4: Return results
    res.status(200).json({
      message:
        status && status.trim() !== ""
          ? `${status} lab orders fetched successfully`
          : "All lab orders fetched successfully",
      count: labOrders.length,
      labOrders,
    });
  } catch (error) {
    console.error("Error fetching lab orders:", error);
    res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};

const getlabOrdersbyLabId= async (req, res) => {
  try {
    const { labId,clinicId } = req.params;
    const lab = await LabVendor.findOne({ _id: labId, clinicId: clinicId });
    if (!lab) {
      return res.status(404).json({ message: "Lab not found or not registered under this clinic" });
    }
      const labOrders = await LabOrder.find({ labId })
      .populate("patientId") // optional: populate linked data
      .sort({ createdAt: -1 });
    if (!labOrders.length) {
      return res.status(404).json({ message: "No lab orders found for this lab" });
    }
    const orderCount = labOrders.length;
    if (orderCount === 0) {
      return res.status(404).json({
        message: "No lab orders found for this lab",
        count: 0,
        labOrders: [],
      });
    }
    res.status(200).json({
      message: "Lab orders fetched successfully",
      labOrders,
      count: orderCount,
    });
  }
  catch (error) {
    console.error("Error fetching lab orders:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
}

const getClinicLabStats = async (req, res) => {
  try {
    const { clinicId } = req.params;

    if (!clinicId) {
      return res.status(400).json({ message: "Clinic ID is required" });
    }

    // Step 1: Get all labs under the clinic
    const labs = await LabVendor.find({ clinicId });
    const totalLabs = labs.length;

    if (totalLabs === 0) {
      return res.status(404).json({
        message: "No labs found for this clinic",
        totalLabs: 0,
        totalOrders: 0,
        pendingOrders: 0,
        completedOrders: 0,
      });
    }

    // Step 2: Get all lab IDs for the clinic
    const labIds = labs.map((lab) => lab._id);

    // Step 3: Aggregate lab order stats
    const totalOrders = await LabOrder.countDocuments({ clinicId });
    const pendingOrders = await LabOrder.countDocuments({
      clinicId,
      status: "Pending",
    });
    const completedOrders = await LabOrder.countDocuments({
      clinicId,
      status: "Delivered",
    });

    // Step 4: Return combined stats
    res.status(200).json({
      message: "Clinic lab statistics fetched successfully",
      data: {
        totalLabs,
        totalOrders,
        pendingOrders,
        completedOrders,
      },
    });
  } catch (error) {
    console.error("Error fetching clinic lab stats:", error);
    res.status(500).json({
      message: "Server error while fetching clinic lab stats",
      error: error.message,
    });
  }
};
export { createLabOrder,updateOrderStatus,getPendingLabOrders,getLabOrdersbyClinicId,getLabOrdersStatus,getlabOrdersbyLabId,getClinicLabStats };