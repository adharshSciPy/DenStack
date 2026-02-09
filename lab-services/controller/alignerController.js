import AlignerOrder from "../model/aligerModel.js";

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
export {
  createAlignerOrder,
  getAlignerOrderById,
  updateAlignerOrderStatus,
  getAlignerOrdersByPatientId,
};
