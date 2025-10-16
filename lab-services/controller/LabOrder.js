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
    
    // Extract query parameters
    const { 
      cursor, // cursor for pagination (typically the _id or createdAt of last item)
      limit = 10, 
      status, 
      search 
    } = req.query;

    // Convert limit to number
    const limitNum = parseInt(limit);
    
    // Find lab
    const lab = await LabVendor.findOne({ clinicId });
    if (!lab) {
      return res.status(404).json({
        message: "Lab not found or not registered under this clinic",
      });
    }

    // Build filter query
    const filterQuery = { labId: lab._id };
    
    // Add cursor condition (for next page)
    if (cursor) {
      // Assuming cursor is based on createdAt timestamp
      // For descending order (newest first), we want documents older than cursor
      filterQuery.createdAt = { $lt: new Date(cursor) };
    }
    
    // Add status filter if provided and not "all"
    if (status && status !== 'all') {
      filterQuery.status = status;
    }

    // Add search filter if provided
    if (search) {
      filterQuery.$or = [
        { orderType: { $regex: search, $options: 'i' } },
        // Add more searchable fields as needed
      ];
    }

    // Fetch lab orders with limit + 1 to check if there are more results
    const labOrders = await LabOrder.find(filterQuery)
      .sort({ createdAt: -1 })
      .limit(limitNum + 1);

    // Check if there are more results
    const hasNextPage = labOrders.length > limitNum;
    
    // Remove the extra document if it exists
    const results = hasNextPage ? labOrders.slice(0, limitNum) : labOrders;

    if (!results.length) {
      return res.status(200).json({
        message: "No lab orders found for this lab",
        labOrders: [],
        hasNextPage: false,
        nextCursor: null,
      });
    }

    // Extract all patient IDs and doctor IDs
    const patientIds = results.map(order => order.patientId);
    const doctorIds = results.map(order => order.doctorId);

    // Fetch patient details from patient microservice
    const patientResponses = await Promise.all(
      patientIds.map(id =>
        axios
          .get(`${process.env.PATIENT_SERVICE_URL}/api/v1/patient-service/patient/details/${id}`)
          .then(res => res.data)
          .catch(() => null)
      )
    );

    // Fetch doctor details from doctor microservice
    const doctorResponse = await Promise.all(
      doctorIds.map(id =>
        axios
          .get(`${process.env.DOCTOR_SERVICE_URL}/api/v1/auth/doctor/details/${id}`)
          .then(res => res.data)
          .catch(() => null)
      )
    );

    // Filter out failed ones
    const patientData = patientResponses.filter(Boolean);
    const doctorData = doctorResponse.filter(Boolean);

    // Merge patient and doctor names into labOrders
    const enrichedOrders = results.map(order => {
      const patient = patientData.find(p => p.data._id === order.patientId.toString());
      const doctor = doctorData.find(d => d.data._id === order.doctorId.toString());
      
      return {
        ...order.toObject(),  
        patientName: patient ? patient.data.name : "Unknown",
        doctorName: doctor ? doctor.data.name : "Unknown"
      };
    });

    // Generate next cursor (use createdAt of last item)
    const nextCursor = hasNextPage 
      ? results[results.length - 1].createdAt.toISOString() 
      : null;

    res.status(200).json({
      message: "Lab orders fetched successfully",
      count: results.length,
      labOrders: enrichedOrders,
      hasNextPage,
      nextCursor,
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