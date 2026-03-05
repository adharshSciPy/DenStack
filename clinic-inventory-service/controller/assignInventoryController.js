import ClinicInventory from "../model/ClinicInventoryModel.js";
import StockTransfer from "../model/stockTransferModel.js";
import InventoryOrderLog from "../model/InventoryOrderLogSchema .js";
import axios from "axios";
import dotenv from "dotenv";
dotenv.config();

export const assignInventoryController = async (req, res) => {
  try {
    const { orderId, clinicId, items } = req.body;

    console.log("✅ assignInventory hit", req.body);

    if (!orderId || !clinicId || !items || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields",
      });
    }

    // 🔒 Idempotency check
    const alreadyProcessed = await InventoryOrderLog.findOne({ orderId });
    if (alreadyProcessed) {
      return res.status(200).json({
        success: true,
        message: "Inventory already assigned for this order",
      });
    }

    for (const item of items) {
      if (!item.productId || !item.quantity) {
        return res.status(400).json({
          success: false,
          message: "Invalid item data",
          item,
        });
      }

      const existing = await ClinicInventory.findOne({
        clinicId,
        productId: item.productId,
        inventoryType: "general",
      });

      if (existing) {
        existing.quantity += Number(item.quantity);
        existing.isLowStock =
          existing.quantity <= (existing.lowStockThreshold || 20);
        await existing.save();
      } else {
        await ClinicInventory.create({
          clinicId,
          productId: item.productId,
          productName: item.productName,
          quantity: Number(item.quantity),
          lowStockThreshold: 20,
          isLowStock: Number(item.quantity) <= 20,
          inventoryType: "general",
          productType: "global",
          source: "ECOM_ORDER",
        });
      }
    }

    // 🧾 Mark order as processed
    await InventoryOrderLog.create({ orderId });

    return res.status(200).json({
      success: true,
      message: "Inventory assigned successfully",
    });
  } catch (err) {
    console.error("Assign Inventory Error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to assign inventory",
      error: err.message,
    });
  }
};

export const assignClinicInventoryProducts = async (req, res) => {
  try {
    const {
      clinicId,
      productId,
      productName,
      quantity,
      toInventoryType, // "lab" | "pharmacy"
      toVendorId,      // 🔥 labId / pharmacyId
    } = req.body;

    if (
      !clinicId ||
      !productId ||
      !quantity ||
      !toInventoryType ||
      !toVendorId
    ) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields",
      });
    }

    // 1️⃣ SOURCE: General clinic inventory
    const sourceInventory = await ClinicInventory.findOne({
      clinicId,
      productId,
      inventoryType: "general",
    });

    if (!sourceInventory || sourceInventory.quantity < quantity) {
      return res.status(400).json({
        success: false,
        message: "Insufficient stock in clinic inventory",
      });
    }

    // 2️⃣ Reduce GENERAL stock
    sourceInventory.quantity -= Number(quantity);
    sourceInventory.isLowStock =
      sourceInventory.quantity <= sourceInventory.lowStockThreshold;

    await sourceInventory.save();

    // 3️⃣ TARGET inventory (lab / pharmacy) – vendor-specific
    let targetInventory = await ClinicInventory.findOne({
      clinicId,
      productId,
      inventoryType: toInventoryType,
      assignedTo: toVendorId, // 🔥 key change
    });

    if (targetInventory) {
      targetInventory.quantity += Number(quantity);
      await targetInventory.save();
    } else {
      await ClinicInventory.create({
        clinicId,
        productId,
        productName,
        quantity: Number(quantity),
        inventoryType: toInventoryType,
        assignedTo: toVendorId, // 🔥 labId / pharmacyId
      });
    }

    // 4️⃣ LOG TRANSFER
    await StockTransfer.create({
      clinicId,
      productId,
      productName,
      fromInventoryType: "general",
      toInventoryType,
      toVendorId,
      quantity: Number(quantity),
      source: "MANUAL",
      assignedBy: req.user?._id,
      assignedTo: toVendorId, 
    });

    return res.status(200).json({
      success: true,
      message: "Inventory assigned successfully",
    });
  } catch (error) {
    console.error("Assign Inventory Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to assign inventory",
      error: error.message,
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
        `${process.env.LAB_SERVICE_URL}lab/vendor-by-clinic/${clinicId}`
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
