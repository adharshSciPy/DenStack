import ClinicInventory from "../model/ClinicInventoryModel.js";
import axios from "axios";
import dotenv from "dotenv";
dotenv.config();

export const assignInventory = async (req, res) => {
  try {
    const { productId, quantity, assignTo, productName, assignId, clinicId } = req.body;

    if (!assignTo)
      return res.status(400).json({ message: "assignTo is required" });

    // 1️⃣ Find clinic inventory item
    const item = await ClinicInventory.findOne({ clinicId, productId });

    if (!item)
      return res.status(404).json({ message: "Item not found" });

    if (item.quantity < quantity)
      return res.status(400).json({ message: "Not enough stock" });

    // URLs for microservices
    const LAB_URL = `${process.env.LAB_SERVICE_URL}lab-inventory/add`;
    const PHARMACY_URL = `${process.env.PHARMACY_INVENTORY_SERVICE_URL}pharmacy/inventory/add`;

    const targetURL = assignTo === "lab" ? LAB_URL : PHARMACY_URL;

    // 2️⃣ SEND DATA TO MICRO SERVICE
    const response = await axios.post(targetURL, {
      assignId,
      productId,
      productName,
      quantity,
      clinicId,
    });

    // 3️⃣ Update main clinic inventory ONLY after microservice success
    item.quantity -= Number(quantity);
    const threshold = item.lowStockThreshold || 20;
    item.isLowStock = item.quantity <= threshold;
    await item.save();

    // 4️⃣ Send response AFTER updating DB
    return res.status(200).json({
      message: "Inventory assigned successfully",
      remainingQuantity: item.quantity,
      isLowStock: item.isLowStock,
      microserviceResponse: response.data,
    });

  } catch (err) {
    console.error("Assign Inventory Error:", err.response?.data || err);

    return res.status(500).json({
      message: "Server error",
      error: err.response?.data || err.message,
    });
  }
};


export const getClinicVendorIds = async (req, res) => {
  try {
    const { id: clinicId } = req.params;

    // ============================
    //         LAB VENDORS
    // ============================
    let labs = [];
    try {
      const labRes = await axios.get(
        `${process.env.LAB_SERVICE_URL}lab-service/labs/by-clinic/${clinicId}`
      );

      labs =
        labRes.data?.labs?.map((lab) => ({
          _id: lab._id,
          name: lab.name, // from Lab schema
        })) || [];
    } catch (err) {
      console.log("❌ Lab service unreachable:", err.message);
    }

    // ============================
    //      PHARMACY VENDORS
    // ============================
    let pharmacies = [];
    try {
      const pharmRes = await axios.get(
        `${process.env.PHARMACY_INVENTORY_SERVICE_URL}pharmacy-details/vendors/by-clinic/${clinicId}`
      );

      pharmacies =
        pharmRes.data?.vendors?.map((v) => ({
          _id: v._id,
          name: v.name, // from PharmacyVendor schema
        })) || [];
    } catch (err) {
      console.log("❌ Pharmacy service unreachable:", err.message);
    }

    // ============================
    //          RESPONSE
    // ============================
    return res.status(200).json({
      success: true,
      message: "Vendor details fetched successfully",
      labs,
      pharmacies,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error fetching vendors",
      details: error.message,
    });
  }
};
