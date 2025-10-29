import DentalLabOrder from "../model/labOrder.js";
import LabVendor from "../model/LabVendor.js";
import axios from "axios";
import path from "path"
export const createDentalLabOrder = async (req, res) => {
  try {
    const { vendor, dentist, patientName, deliveryDate, note, price,appointmentId } =
      req.body;

    if (
      !vendor ||
      !dentist ||
      !patientName ||
      !deliveryDate ||
      !price ||
      !note ||
      !appointmentId
    ) {
      return res.status(400).json({
        message:
          "Vendor, dentist, patient, delivery date,note, and price are required",
      });
    }

    const vendorExists = await LabVendor.findById(vendor);
    if (!vendorExists)
      return res.status(404).json({ message: "Vendor not found" });

    // Process uploaded files
    const attachments = req.files?.map((file) => ({
      fileName: file.originalname,
      fileUrl: `/uploads/dental-orders/${file.filename}`,
    }));

    // Create dental lab order
    const order = new DentalLabOrder({
      vendor,
      dentist,
      patientName,
      deliveryDate,
      price,
      attachments,
      note,
      appointmentId
    });

    await order.save();

    res.status(201).json({
      message: "Dental lab order created successfully",
      order,
    });
  } catch (error) {
    console.error("Error creating dental lab order:", error);
    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};

export const getDentalLabOrders = async (req, res) => {
  try {
    const orders = await DentalLabOrder.find();
    res.status(200).json({ orders });
  } catch (error) {
    console.error("Error fetching dental lab orders:", error);
    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};

export const getDentalLabOrderById = async (req, res) => {
  try {
    const { id } = req.params;
    const order = await DentalLabOrder.findById(id);
    if (!order) {
      return res.status(404).json({ message: "Dental lab order not found" });
    }
    res.status(200).json({ order });
  } catch (error) {
    console.error("Error fetching dental lab order by ID:", error);
    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};

export const updateDentalLabOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const validStatuses = ["pending", "in-progress", "completed", "delivered"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: "Invalid status value" });
    }
    const order = await DentalLabOrder.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    );
    if (!order) {
      return res.status(404).json({ message: "Dental lab order not found" });
    }
    res.status(200).json({
      message: "Dental lab order status updated successfully",
      order,
    });
  } catch (error) {
    console.error("Error updating dental lab order status:", error);
    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};

export const uploadLabResults = async (req, res) => {
  try {
    const { id } = req.params;
    const files = req.files;

    if (!files || files.length === 0)
      return res.status(400).json({ message: "No files uploaded" });

    const order = await DentalLabOrder.findById(id);
    if (!order)
      return res.status(404).json({ message: "Lab order not found" });

    // ✅ Store uploaded files (including DICOMs)
    const newResults = files.map((file) => ({
      fileName: file.originalname,
      fileUrl: `/uploads/labResults/${file.filename}`,
      fileType: path.extname(file.originalname).toLowerCase(),
    }));

    order.resultFiles.push(...newResults);
    order.status = "ready";
    await order.save();

    // ✅ Sync with Consulting History service
    const appointmentId = order.appointmentId;

    if (appointmentId) {
      await axios.patch(
        `${process.env.PATIENT_SERVICE_URL}/api/v1/patient-service/appointment/lab-details/${appointmentId}`,
        { labOrderId: id }
      );
    }

    res.status(200).json({
      message: "Lab result files uploaded successfully",
      order,
    });
  } catch (error) {
    console.error("❌ Error uploading lab results:", error);
    res.status(500).json({
      message: "Failed to upload lab results",
      error: error.message,
    });
  }
};
