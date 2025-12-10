import ClinicProduct from "../model/ClinicProduct.js";
import ClinicInventory from "../model/ClinicInventoryModel.js";
import axios from "axios";
import dotenv from "dotenv";
dotenv.config();

const LAB_SERVICE_URL = process.env.LAB_SERVICE_URL;
const PHARMACY_SERVICE_URL = process.env.PHARMACY_SERVICE_URL;
export const createClinicProductAndAssignInventory = async (req, res) => {
  try {
    const { clinicId } = req.params;
    const {
      name,
      category,
      price,
      description,
      mainCategory,
      subCategory,
      brand,
      quantity,
      lowStockThreshold = 20,
      productType = "local",
    } = req.body;

    if (!clinicId || !name || !quantity) {
      return res.status(400).json({
        message: "clinicId, name and quantity are required",
      });
    }

    // -------------------------------------
    // STEP 1 - CHECK IF PRODUCT ALREADY EXISTS
    // -------------------------------------
    let product = await ClinicProduct.findOne({
      clinicId,
      productId: req.body,
    });

    // -------------------------------------
    // STEP 2 - IF PRODUCT DOES NOT EXIST → CREATE NEW
    // -------------------------------------
    if (!product) {
      product = await ClinicProduct.create({
        clinicId,
        name,
        category,
        price,
        description,
        mainCategory,
        subCategory,
        brand,
        productType,
      });
    }

    const productId = product._id;

    // -------------------------------------
    // STEP 3 - CHECK INVENTORY ENTRY
    // -------------------------------------
    let inventory = await ClinicInventory.findOne({
      clinicId,
      productId,
    });

    // -------------------------------------
    // STEP 4 - UPDATE OR CREATE INVENTORY
    // -------------------------------------
    if (inventory) {
      inventory.quantity += quantity;
      inventory.isLowStock =
        inventory.quantity <=
        (inventory.lowStockThreshold || lowStockThreshold);
      await inventory.save();
    } else {
      inventory = await ClinicInventory.create({
        clinicId,
        productId,
        quantity,
        inventoryType: "general",
        assignedTo: null,
        lowStockThreshold,
        isLowStock: quantity <= lowStockThreshold,
      });
    }

    return res.status(201).json({
      message: "Product added/updated successfully & assigned to inventory",
      product,
      inventory,
    });
  } catch (err) {
    return res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
};

export const getClinicProducts = async (req, res) => {
  try {
    const { clinicId } = req.params;

    const products = await ClinicProduct.find({ clinicId }).sort({
      createdAt: -1,
    });

    res.status(200).json({
      message: "Clinic products fetched",
      data: products,
    });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

export const getClinicVendorIds = async (req, res) => {
  try {
    const { clinicId } = req.params;

    // ============================
    //         LAB VENDORS
    // ============================
    let labs = [];
    try {
      const labRes = await axios.get(
        `${LAB_SERVICE_URL}lab/vendor-by-clinic/${clinicId}`
      );

      labs =
        labRes.data?.map((lab) => ({
          _id: lab._id,
          name: lab.name,
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
        `${PHARMACY_SERVICE_URL}pharmacy-details/vendors/by-clinic/${clinicId}`
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

export const getClinicLabs = async (req, res) => {
  const { clinicId } = req.params;
  let labs = [];
  try {
    const labRes = await axios.get(
      `${LAB_SERVICE_URL}lab/vendor-by-clinic/${clinicId}`
    );

    labs =
      labRes.data?.map((lab) => ({
        _id: lab._id,
        name: lab.name,
      })) || [];

    return res.status(200).json({
      success: true,
      message: "Vendor details fetched successfully",
      labs,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error fetching vendors",
      details: error.message,
    });
  }
};

export const updateClinicProduct = async (req, res) => {
  try {
    const { clinicId, productId } = req.params;
    const { quantity } = req.body;

    // STEP 1: Find inventory item
    const inventory = await ClinicInventory.findOne({
      clinicId,
      _id: productId,
    });

    if (!inventory) {
      return res.status(404).json({ message: "Product not found" });
    }

    // STEP 2: Add quantity (if provided)
    if (quantity !== undefined) {
      inventory.quantity += Number(quantity);
    }

    // STEP 3: Update other fields
    Object.assign(inventory);

    // STEP 4: Update low stock flag
    const threshold = inventory.lowStockThreshold || 20;
    inventory.isLowStock = inventory.quantity <= threshold;

    // Save
    await inventory.save();

    return res.status(200).json({
      message: "Product updated successfully",
      data: inventory,
    });
  } catch (error) {
    console.error("Error updating product:", error);
    return res.status(500).json({
      message: "Error updating product",
      error: error.message,
    });
  }
};
