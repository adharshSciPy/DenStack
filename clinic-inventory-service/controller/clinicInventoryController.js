import ClinicInventoryModel from "../model/ClinicInventoryModel.js";
import axios from "axios";;
import http from "http";
import https from "https";
import ClinicProduct from "../model/ClinicProduct.js";
const PRODUCT_SERVICE_URL = "http://localhost:8004/api/v1/";

const api = axios.create({
  httpAgent: new http.Agent({ keepAlive: true }),
  httpsAgent: new https.Agent({ keepAlive: true }),
  timeout: 5000,
});

const getProducts = async (req, res) => {
  const { clinicId } = req.params;
  const { search, cursor, limit } = req.query;

  try {
    if (!clinicId) {
      return res.status(400).json({ message: "clinicId is required" });
    }

    let inventoryFilter = { clinicId };

    if (cursor) {
      inventoryFilter._id = { $gt: cursor };
    }

    const limitNum = Number(limit) || 10;

    const inventory = await ClinicInventoryModel.find(inventoryFilter)
      .lean()
      .sort({ _id: 1 })
      .limit(limitNum + 1);

    if (!inventory.length) {
      return res.status(200).json({
        message: "No products found",
        data: [],
        nextCursor: null,
        hasMore: false,
        count: 0,
      });
    }

    const hasMore = inventory.length > limitNum;
    const inventoryPage = hasMore ? inventory.slice(0, limitNum) : inventory;

    // Collect productIds
    const productIds = [
      ...new Set(inventoryPage.map((i) => i.productId.toString())),
    ];

    // ----------------------------------------
    // 1️⃣ FETCH GLOBAL PRODUCTS
    // ----------------------------------------
    let globalProducts = [];
    try {
      const { data } = await axios.post(
        `${PRODUCT_SERVICE_URL}product/get-by-ids`,
        { productIds, search }
      );
      globalProducts = data?.data || [];
    } catch (err) {
      console.warn("Global product fetch failed:", err.message);
    }

    // Map → globalProducts
    const productMap = new Map(
      globalProducts.map((p) => [p._id.toString(), p])
    );

    // ----------------------------------------
    // 2️⃣ FETCH LOCAL CLINIC PRODUCTS
    // ----------------------------------------
    const localProducts = await ClinicProduct.find({
      clinicId,
      _id: { $in: productIds },
      ...(search && { name: { $regex: search, $options: "i" } }),
    }).lean();

    // Add → localProducts to map (override global)
    localProducts.forEach((p) => {
      productMap.set(p._id.toString(), { ...p, isLocal: true });
    });

    // ----------------------------------------
    // 3️⃣ MERGE INVENTORY + PRODUCTS + LOW-STOCK SYNC
    // ----------------------------------------
    const mergedResults = await Promise.all(
      inventoryPage.map(async (inv) => {
        const product = productMap.get(inv.productId.toString());
        if (!product) return null; // product deleted or missing

        const threshold =
          inv.lowStockThreshold || product.lowStockThreshold || 20;

        const isLowStock = inv.quantity <= threshold;

        if (inv.isLowStock !== isLowStock) {
          await ClinicInventoryModel.updateOne(
            { _id: inv._id },
            { $set: { isLowStock } }
          );
        }

        return {
          ...inv,
          product,
          isLocalProduct: product?.isLocal || false,
          isLowStock,
        };
      })
    );

    const finalData = mergedResults.filter(Boolean);

    const nextCursor = hasMore
      ? inventoryPage[inventoryPage.length - 1]._id
      : null;

    const totalCount = await ClinicInventoryModel.countDocuments({ clinicId });

    return res.status(200).json({
      message: "Products fetched successfully",
      count: finalData.length,
      total: totalCount,
      data: finalData,
      nextCursor,
      hasMore,
    });
  } catch (error) {
    console.error("Error fetching products:", error);
    return res.status(500).json({
      message: "Error fetching products",
      error: error.message,
    });
  }
};

const getLowStockProducts = async (req, res) => {
  const { clinicId } = req.params;
  const LOW_STOCK_THRESHOLD = 21; // Define low stock threshold
  try {
    const results = await ClinicInventoryModel.find({
      clinicId,
      quantity: { $lt: LOW_STOCK_THRESHOLD },
    }).lean();
    
    return res.status(200).json({
      message: "Low stock products fetched successfully",
      data: results,
      count: results.length,
    });
  } catch (error) {
    console.error("Error fetching low stock products:", error);
    return res.status(500).json({
      message: "Error fetching low stock products",
      error: error.message,
    });
  }
};

const deleteInventoryItem = async (req, res) => {
  const { id}  = req.params;
  if (!id ) {
    return res
      .status(400)
      .json({ message: "clinicId and productId are required" });
  }
  try {
    const deletes = await ClinicInventoryModel.findByIdAndDelete(id);
    if (!deletes) {
      return res.status(404).json({ message: "Item not found" });
    }
    return res.status(200).json({ message: "Item deleted successfully" });
  } catch (error) {
    console.error("Error deleting inventory item:", error);
    return res.status(500).json({
      message: "Error deleting inventory item",
      error: error.message,
    });
  }
};

export { getProducts, getLowStockProducts ,deleteInventoryItem};
