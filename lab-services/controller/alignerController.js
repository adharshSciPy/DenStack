import AlignerOrder from "../model/aligerModel.js";
import mongoose from "mongoose";
const { DOCTOR_SERVICE_URL, PATIENT_SERVICE_URL } = process.env;
import axios from "axios";

const createAlignerOrder = async (req, res) => {
  try {
    const {
      patientId,
      vendorId,
      caseId,
      doctorName,
      clinicName,
      treatmentDuration,
      notes,
      totalAmount,
      upperArch,
      lowerArch,
    } = req.body;

    // ✅ STL files from multer
    const upperFile = req.files?.upperFile?.[0];
    const lowerFile = req.files?.lowerFile?.[0];
    const totalJaw = req.files?.totalJaw?.[0];
    
    const upperStl = upperFile
      ? `/uploads/dental-orders/${upperFile.filename}`
      : null;

    const totalJawStl = totalJaw
      ? `/uploads/dental-orders/${totalJaw.filename}`
      : null;
    const lowerStl = lowerFile
      ? `/uploads/dental-orders/${lowerFile.filename}`
      : null;

    // basic validation
    if (!patientId || !vendorId) {
      return res.status(400).json({
        message: "patientId and vendorId are required",
      });
    }

    const newOrder = await AlignerOrder.create({
      patientId,
      vendorId,
      caseId,
      doctorName,
      clinicName,

      trays: {
        upperArch,
        lowerArch,
      },

      treatmentDuration,
      notes,
      totalAmount,

      stlFiles: {
        upper: upperStl,
        lower: lowerStl,
        total: totalJawStl,
      },
    });

    res.status(201).json({
      message: "Aligner order created successfully",
      order: newOrder,
    });
  } catch (error) {
    console.error("Aligner order error:", error);

    res.status(500).json({
      message: "Failed to create aligner order",
      error: error.message,
    });
  }
};

const getAlignerOrderById = async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await AlignerOrder.findById(orderId).populate(
      "patientId",
      "name age gender phone",
    );

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Aligner order not found",
      });
    }

    res.status(200).json({
      success: true,
      data: order,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const updateAlignerOrderStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status, paymentStatus, notes } = req.body;

    const updatedOrder = await AlignerOrder.findByIdAndUpdate(
      orderId,
      {
        status,
        paymentStatus,
        notes,
      },
      { new: true },
    );

    if (!updatedOrder) {
      return res.status(404).json({
        success: false,
        message: "Aligner order not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Aligner order updated successfully",
      data: updatedOrder,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const getAlignerOrdersByPatientId = async (req, res) => {
  try {
    const { patientId } = req.params;

    const orders = await AlignerOrder.find({ patientId }).sort({
      createdAt: -1,
    });

    res.status(200).json({
      success: true,
      count: orders.length,
      data: orders,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};


export const getLatestAlignerOrdersByVendorId = async (req, res) => {
  try {
    const { vendorId } = req.params;
    const { cursor, limit = 10, status } = req.query;

    if (!mongoose.Types.ObjectId.isValid(vendorId)) {
      return res.status(400).json({ message: "Invalid vendorId" });
    }

    // 🔹 Step 1: Match condition
    let matchCondition = {
      vendorId: new mongoose.Types.ObjectId(vendorId),
    };

    if (status && status !== "all") {
      matchCondition.status = status;
    }

    if (cursor) {
      matchCondition.createdAt = { $lte: new Date(cursor) };
    }

    // 🔹 Step 2: Cursor pagination
    let orders = await AlignerOrder.find(matchCondition)
      .sort({ createdAt: -1 })
      .limit(Number(limit) + 1);

    let hasNextPage = orders.length > limit;
    let nextCursor = null;

    if (hasNextPage) {
      nextCursor = orders[limit].createdAt.toISOString();
      orders.pop();
    }

    // 🔹 Step 3: Collect IDs
    const doctorIds = [
      ...new Set(orders.map(o => o.doctorName).filter(Boolean)),
    ];

    const patientIds = [
      ...new Set(orders.map(o => o.patientId?.toString()).filter(Boolean)),
    ];
    
    const doctorCache = {};
    const patientCache = {};

    // 🔹 Step 4: Doctor API
    await Promise.all(
      doctorIds.map(async (id) => {
        try {
          const resp = await axios.get(
            `http://localhost:8001/api/v1/auth/doctor/details/${id}`
          );
          doctorCache[id] = resp.data?.data?.name || "";          
        } catch(error) {
          console.log(`Failed to fetch doctor name for ID: ${id}` ,error);
          doctorCache[id] = "";
        }
      })
    );

    // 🔹 Step 5: Patient API
    await Promise.all(
      patientIds.map(async (id) => {
        try {
          const resp = await axios.get(
            `${PATIENT_SERVICE_URL}/api/v1/patient-service/patient/details/${id}`
          );
          patientCache[id] = resp.data?.data?.name || "";
        } catch {
          patientCache[id] = "";
        }
      })
    );
    
    // 🔹 Step 6: Merge names
    const finalOrders = orders.map(order => ({
      ...order.toObject(),
      doctorName: doctorCache[order.doctorName] || "",
      patientName: patientCache[order.patientId?.toString()] || "",
    }));

    return res.status(200).json({
      count: finalOrders.length,
      alignerOrders: finalOrders,
      hasNextPage,
      nextCursor,
      message: "Aligner orders fetched successfully",
    });

  } catch (error) {
    console.error("Aligner order fetch error:", error);
    return res.status(500).json({
      message: "Internal server error",
      error: error.message,
    });
  }
};
export const getMonthlyLabRevenueByVendor = async (req, res) => {
  try {
    const { labVendorId } = req.params;
    let { month, year } = req.query;
    console.log("Received labVendorId:", labVendorId);
    
    if (!labVendorId) {
      return res.status(400).json({
        success: false,
        message: "labVendorId is required",
      });
    }

    // Convert string ID to ObjectId
    let vendorObjectId;
    try {
      vendorObjectId = new mongoose.Types.ObjectId(labVendorId);
    } catch (err) {
      return res.status(400).json({
        success: false,
        message: "Invalid labVendorId format",
      });
    }

    const now = new Date();
    month = month ? Number(month) : now.getMonth() + 1;
    year = year ? Number(year) : now.getFullYear();

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 1);
    

    const stats = await AlignerOrder.aggregate([
      {
        $match: {
          vendorId: vendorObjectId, // ✅ Now using ObjectId
          createdAt: { $gte: startDate, $lt: endDate },
        },
      },
      {
        $group: {
          _id: null,
          totalPrice: { $sum: "$totalAmount" },
          totalOrders: { $sum: 1 },
        },
      },
    ]);


    return res.status(200).json({
      success: true,
      data: {
        totalPrice: stats[0]?.totalPrice || 0,
        totalOrders: stats[0]?.totalOrders || 0,
        month,
        year,
      },
    });
  } catch (error) {
    console.error("Monthly lab revenue error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export {
  createAlignerOrder,
  getAlignerOrderById,
  updateAlignerOrderStatus,
  getAlignerOrdersByPatientId,
};
