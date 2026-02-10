import DentalLabOrder from "../model/labOrder.js";
import LabVendor from "../model/LabVendor.js";
import axios from "axios";
import path from "path";
import dotenv from "dotenv";
import fs from "fs";
import {
  convertDicomToNifti,
} from "../utils/dicomConverter.js";
dotenv.config();

const { DOCTOR_SERVICE_URL, PATIENT_SERVICE_URL } = process.env;
export const createDentalLabOrder = async (req, res) => {
  try {
    const {
      vendor,
      dentist,
      patientName,
      // deliveryDate,
      note,
      price,
      appointmentId,
    } = req.body;

    if (
      !vendor ||
      !dentist ||
      !patientName ||
      // !deliveryDate ||
      !price ||
      !note
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
      // deliveryDate,
      price,
      attachments,
      note,
      appointmentId,
      niftiFile: {
        fileName: "",
        fileUrl: "",
      },
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
    const validStatuses = ["pending", "in-progress", "completed", "cancelled"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: "Invalid status value" });
    }
    const order = await DentalLabOrder.findByIdAndUpdate(
      id,
      { status },
      { new: true },
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
    const { id, labOrderId } = req.params;
    const files = req.files;

    if (!labOrderId) {
      return res.status(400).json({ message: "labOrderId is required" });
    }

    if (!files || files.length === 0) {
      return res.status(400).json({ message: "No files uploaded" });
    }

    const order = await DentalLabOrder.findById(labOrderId);
    if (!order) {
      return res.status(404).json({ message: "Lab order not found" });
    }

    if (order.status === "processing") {
      return res.status(409).json({
        message: "DICOM conversion already in progress",
      });
    }

    const baseDir = path.join(
      process.cwd(),
      "uploads",
      "labResults",
      labOrderId,
    );

    const dicomDir = path.join(baseDir, "dicom");
    const niftiDir = path.join(baseDir, "nifti");
    const otherDir = path.join(baseDir, "other");

    fs.mkdirSync(dicomDir, { recursive: true });
    fs.mkdirSync(niftiDir, { recursive: true });
    fs.mkdirSync(otherDir, { recursive: true });

    let hasDicom = false;
    const resultFiles = [];

    // ✅ Handle uploads properly
    for (const file of files) {
      const lower = file.originalname.toLowerCase();

      const isDicom = lower.endsWith(".dcm") || lower.endsWith(".ima");
      const isNifti = lower.endsWith(".nii") || lower.endsWith(".nii.gz");

      if (isDicom) {
        hasDicom = true;

        fs.renameSync(file.path, path.join(dicomDir, file.filename));

        resultFiles.push({
          fileName: file.originalname,
          fileUrl: `/uploads/labResults/${labOrderId}/dicom/${file.filename}`,
          fileType: "dicom",
        });
      } else if (isNifti) {
        fs.renameSync(file.path, path.join(niftiDir, file.filename));

        await DentalLabOrder.findByIdAndUpdate(labOrderId, {
          $set: {
            niftiFile: {
              fileName: file.originalname,
              fileUrl: `/uploads/labResults/${labOrderId}/nifti/${file.filename}`,
            },
            status: "ready",
          },
        });
      } else {
        fs.renameSync(file.path, path.join(otherDir, file.filename));

        resultFiles.push({
          fileName: file.originalname,
          fileUrl: `/uploads/labResults/${labOrderId}/other/${file.filename}`,
          fileType: path.extname(file.originalname),
        });
      }
    }

    await DentalLabOrder.findByIdAndUpdate(labOrderId, {
      $push: { resultFiles: { $each: resultFiles } },
    });

    // 🔥 Run conversion ASYNC (non-blocking)
    if (hasDicom) {
      setImmediate(async () => {
        const result = await convertDicomToNifti(
          dicomDir,
          niftiDir,
          labOrderId,
        );

        if (result?.success) {
          console.log(
            `✅ DICOM to NIfTI conversion successful for order ${labOrderId}`,
          );
          console.log(`   NIfTI File: ${result.niftiFile}`);
          console.log(`   URL: ${result.fileUrl}`);
          await axios.patch(
            `${process.env.PATIENT_SERVICE_URL}/api/v1/patient-service/patient/lab-order/${id}`,
            { labOrderId },
          );
          await DentalLabOrder.findByIdAndUpdate(labOrderId, {
            $set: {
              status: "ready",
              niftiFile: {
                fileName: result.niftiFile,
                fileUrl: result.fileUrl,
              },
            },
          });
        }
      });
    }

    const finalOrder = await DentalLabOrder.findById(labOrderId);

    return res.status(200).json({
      message: "Lab results uploaded successfully",
      order: finalOrder,
    });
  } catch (error) {
    console.error("❌ Upload error:", error);
    return res.status(500).json({
      message: "Failed to upload lab results",
      error: error.message,
    });
  }
};

export const getLabOrdersByLabVendor = async (req, res) => {
  try {
    const { labVendorId } = req.params;
    const orders = await DentalLabOrder.find({ vendor: labVendorId });
    res.status(200).json({ orders });
  } catch (error) {
    console.error("Error fetching lab orders by vendor:", error);
    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};

export const getAllLabOrdersByClinicId = async (req, res) => {
  try {
    const { clinicId } = req.params;
    const { cursor, limit = 10, status, search } = req.query;

    // Step 1: Get vendors
    const labVendors = await LabVendor.find({ clinicId });
    const labVendorIds = labVendors.map((v) => v._id);

    // Step 2: Build match condition
    let matchCondition = { vendor: { $in: labVendorIds } };

    if (status && status !== "all") {
      matchCondition.status = status;
    }

    if (search) {
      matchCondition.$or = [
        { patientname: { $regex: search, $options: "i" } },
        { doctorName: { $regex: search, $options: "i" } },
      ];
    }

    if (cursor) {
      matchCondition.createdAt = { $lte: new Date(cursor) };
    }

    // Step 3: Fetch orders
    let orders = await DentalLabOrder.find(matchCondition)
      .sort({ createdAt: -1 })
      .limit(Number(limit) + 1);

    let hasNextPage = orders.length > limit;
    let nextCursor = null;

    if (hasNextPage) {
      nextCursor = orders[limit].createdAt.toISOString();
      orders.pop();
    }

    // ✅ unique IDs
    const uniqueDoctorIds = [
      ...new Set(orders.map((o) => o.dentist).filter(Boolean)),
    ];
    const uniquePatientIds = [
      ...new Set(orders.map((o) => o.patientName).filter(Boolean)),
    ];

    const doctorCache = {};
    const patientCache = {};

    // ✅ Fetch doctors
    for (let id of uniqueDoctorIds) {
      try {
        const resp = await axios.get(
          `${DOCTOR_SERVICE_URL}/api/v1/auth/doctor/details/${id}`,
        );

        const name = resp.data?.data?.name;

        doctorCache[id] = name || null;
      } catch (err) {
        doctorCache[id] = null;
      }
    }

    // ✅ Fetch patients
    for (let id of uniquePatientIds) {
      try {
        const resp = await axios.get(
          `${PATIENT_SERVICE_URL}/api/v1/patient-service/patient/details/${id}`,
        );

        // ✅ using correct path (same structure assumption)
        const name = resp.data?.data?.name;
        patientCache[id] = resp.data?.data?.name || null;
      } catch {
        patientCache[id] = null;
      }
    }

    // ✅ merge names into orders
    const finalOrders = orders.map((order) => ({
      ...order.toObject(),
      doctorName: doctorCache[order.dentist] || "",
      patientname: patientCache[order.patientName] || "",
    }));

    return res.status(200).json({
      count: finalOrders.length,
      labOrders: finalOrders,
      hasNextPage,
      nextCursor,
      message: "Lab orders fetched successfully",
    });
  } catch (error) {
    console.error("Error fetching lab orders:", error);
    return res.status(500).json({
      message: "Internal server error",
      error: error.message,
    });
  }
};

export const getLabStatsUsingClinicId = async (req, res) => {
  try {
    const { clinicId } = req.params;

    // ✅ Find all lab vendors in this clinic
    const labVendors = await LabVendor.find({ clinicId });
    const labVendorIds = labVendors.map((v) => v._id);

    // ✅ Aggregate lab order stats
    const orderStats = await DentalLabOrder.aggregate([
      { $match: { vendor: { $in: labVendorIds } } },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    // ✅ Convert aggregation into readable stats
    let pendingCount = 0;
    let completedCount = 0;
    let totalOrders = 0;

    orderStats.forEach((stat) => {
      if (stat._id === "pending") pendingCount = stat.count;
      if (stat._id === "delivered") completedCount = stat.count;
      totalOrders += stat.count;
    });

    // ✅ Total labs inside clinic
    const totalLabs = labVendors.length;

    return res.status(200).json({
      totalLabs,
      pendingCount,
      completedCount,
      totalOrders,
    });
  } catch (error) {
    console.error("Error fetching lab stats by clinic ID:", error);
    res.status(500).json({
      message: "Internal server error",
      error: error.message,
    });
  }
};

export const getMonthlyInHouseLabRevenue = async (req, res) => {
  try {
    const { clinicId } = req.params;
    let { month, year } = req.query;

    // If no month/year → use current date
    const now = new Date();
    month = month ? Number(month) : now.getMonth() + 1; // JS month starts from 0
    year = year ? Number(year) : now.getFullYear();

    // Get start and end of selected month
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 1); // next month's first day

    // Get clinic-owned labs
    const vendors = await LabVendor.find({ clinicId, type: "inHouse" });
    const vendorIds = vendors.map((v) => v._id);

    const stats = await DentalLabOrder.aggregate([
      {
        $match: {
          vendor: { $in: vendorIds },
          createdAt: { $gte: startDate, $lt: endDate },
        },
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$price" },
          totalOrders: { $sum: 1 },
        },
      },
    ]);

    return res.status(200).json({
      message: `Revenue for ${month}-${year}`,
      month,
      year,
      stats: stats[0] || { totalRevenue: 0, totalOrders: 0 },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getLatestLabOrdersByClinicId = async (req, res) => {
  try {
    const { clinicId } = req.params;

    // Step 1: Get vendors
    const labVendors = await LabVendor.find({ clinicId });
    const labVendorIds = labVendors.map((v) => v._id);

    // Step 2: Fetch top 5 most recent
    let orders = await DentalLabOrder.find({
      vendor: { $in: labVendorIds },
    })
      .sort({ createdAt: -1 })
      .limit(5);

    // Prepare doctor & patient lookups
    const uniqueDoctorIds = [
      ...new Set(orders.map((o) => o.dentist).filter(Boolean)),
    ];
    const uniquePatientIds = [
      ...new Set(orders.map((o) => o.patientName).filter(Boolean)),
    ];

    const doctorCache = {};
    const patientCache = {};

    // Fetch doctors
    for (let id of uniqueDoctorIds) {
      try {
        const resp = await axios.get(
          `${DOCTOR_SERVICE_URL}/api/v1/auth/doctor/details/${id}`,
        );
        doctorCache[id] = resp.data?.data?.name || null;
      } catch {
        doctorCache[id] = null;
      }
    }

    // Fetch patients
    for (let id of uniquePatientIds) {
      try {
        const resp = await axios.get(
          `${PATIENT_SERVICE_URL}/api/v1/patient-service/patient/details/${id}`,
        );
        patientCache[id] = resp.data?.data?.name || null;
      } catch {
        patientCache[id] = null;
      }
    }

    // Merge doctor & patient names
    const finalOrders = orders.map((order) => ({
      ...order.toObject(),
      doctorName: doctorCache[order.dentist] || "",
      patientname: patientCache[order.patientName] || "",
    }));

    return res.status(200).json({
      count: finalOrders.length,
      labOrders: finalOrders,
      message: "Latest lab orders fetched successfully",
    });
  } catch (error) {
    console.error("Error fetching latest lab orders:", error);
    return res.status(500).json({
      message: "Internal server error",
      error: error.message,
    });
  }
};
