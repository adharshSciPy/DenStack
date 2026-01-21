import mongoose from "mongoose";
import AlignerOrder from "../model/aligerModel.js";

 const createAlignerOrder = async (req, res) => {
  try {
    const {
      vendorId,
      patientId,
      caseId,
      doctorName,
      clinicName,
      trays,
      treatmentDuration,
      totalAmount,
      status,
      paymentStatus,
      notes
    } = req.body;

    /* ------------------ BASIC REQUIRED VALIDATION ------------------ */
    if (!patientId || !caseId || !doctorName || !clinicName || !vendorId) {
      return res.status(400).json({
        success: false,
        message: "patientId, caseId, doctorName, clinicName and vendorId are required"
      });
    }

    /* ------------------ OBJECT ID VALIDATION ------------------ */
    if (!mongoose.Types.ObjectId.isValid(patientId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid patientId"
      });
    }

    /* ------------------ DUPLICATE CASE ID CHECK ------------------ */
    const existingCase = await AlignerOrder.findOne({ caseId });
    if (existingCase) {
      return res.status(409).json({
        success: false,
        message: "Aligner order already exists for this caseId"
      });
    }

    /* ------------------ TRAYS VALIDATION ------------------ */
    if (
      !trays ||
      typeof trays.upperArch !== "number" ||
      typeof trays.lowerArch !== "number"
    ) {
      return res.status(400).json({
        success: false,
        message: "trays.upperArch and trays.lowerArch must be numbers"
      });
    }

    if (trays.upperArch <= 0 || trays.lowerArch <= 0) {
      return res.status(400).json({
        success: false,
        message: "Tray count must be greater than zero"
      });
    }

    /* ------------------ AMOUNT VALIDATION ------------------ */
    if (totalAmount !== undefined && totalAmount < 0) {
      return res.status(400).json({
        success: false,
        message: "Total amount cannot be negative"
      });
    }

    /* ------------------ ENUM VALIDATION ------------------ */
    const validStatus = [
      "draft",
      "approved",
      "manufacturing",
      "shipped",
      "in-treatment",
      "completed"
    ];

    if (status && !validStatus.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order status"
      });
    }

    const validPaymentStatus = ["pending", "paid"];
    if (paymentStatus && !validPaymentStatus.includes(paymentStatus)) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment status"
      });
    }

    /* ------------------ CREATE ORDER ------------------ */
    const order = await AlignerOrder.create({
      vendorId,
      patientId,
      caseId,
      doctorName,
      clinicName,
      trays,
      treatmentDuration,
      totalAmount,
      status: status || "draft",
      paymentStatus: paymentStatus || "pending",
      notes
    });

    return res.status(201).json({
      success: true,
      message: "Aligner order created successfully",
      data: order
    });

  } catch (error) {
    console.error("Create Aligner Order Error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};


const getAlignerOrderById = async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await AlignerOrder.findById(orderId)
      .populate("patientId", "name age gender phone");

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Aligner order not found"
      });
    }

    res.status(200).json({
      success: true,
      data: order
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
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
        notes
      },
      { new: true }
    );

    if (!updatedOrder) {
      return res.status(404).json({
        success: false,
        message: "Aligner order not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Aligner order updated successfully",
      data: updatedOrder
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

const getAlignerOrdersByPatientId = async (req, res) => {
  try {
    const { patientId } = req.params;

    const orders = await AlignerOrder.find({ patientId })
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: orders.length,
      data: orders
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
export {
    createAlignerOrder,
    getAlignerOrderById,
    updateAlignerOrderStatus,
    getAlignerOrdersByPatientId
};