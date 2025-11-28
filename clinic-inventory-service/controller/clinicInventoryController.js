import ClinicInventoryModel from "../model/ClinicInventoryModel.js";
import axios from "axios";
import { log } from "console";
import http from "http";
import https from "https";

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
    // Base inventory filter
    let inventoryFilter = { clinicId };

    // Cursor pagination (compare ObjectId)
    if (cursor) {
      inventoryFilter._id = { $gt: cursor };
    }

    // ✅ FIX 1: Fetch limit + 1 to check if there are more items
    const limitNum = Number(limit) || 10;
    
    // Fetch one extra item to determine if there's a next page
    const inventory = await ClinicInventoryModel.find(inventoryFilter)
      .lean()
      .sort({ _id: 1 }) // important for cursor pagination
      .limit(limitNum + 1); // Fetch one extra

    if (!inventory.length) {
      return res.status(200).json({
        message: "No products found",
        data: [],
        nextCursor: null,
        hasMore: false,
        count: 0,
      });
    }

    // ✅ FIX 2: Check if there are more items
    const hasMore = inventory.length > limitNum;
    
    // ✅ FIX 3: Remove the extra item if we fetched more than limit
    const inventoryPage = hasMore ? inventory.slice(0, limitNum) : inventory;

    // Extract productIds from the actual page (not including extra item)
    const productIds = [
      ...new Set(inventoryPage.map((i) => i.productId.toString())),
    ];

    // Prepare payload to product microservice
    let payload = { productIds };

    if (search) payload.search = search;

    const response = await axios.post(
      `${PRODUCT_SERVICE_URL}product/get-by-ids`,
      payload
    );

    const { data } = response;
    const productList = data.data || [];

    // Create map for quick lookups
    const productMap = new Map(productList.map((p) => [p._id.toString(), p]));

    // Merge inventory + products (using inventoryPage, not inventory)
    const result = inventoryPage
      .map((inv) => ({
        ...inv,
        product: productMap.get(inv.productId.toString()) || null,
      }))
      .filter((item) => item.product);

    // ✅ FIX 4: Only set nextCursor if there are more items
    const nextCursor = hasMore ? inventoryPage[inventoryPage.length - 1]._id : null;

    // ✅ FIX 5: Get total count for the clinic (optional but useful)
    const totalCount = await ClinicInventoryModel.countDocuments({ clinicId });

    return res.status(200).json({
      message: "Products fetched successfully",
      count: result.length,
      total: totalCount, // Total items in database
      data: result,
      nextCursor,
      hasMore, // ✅ Now dynamically calculated!
    });

  } catch (error) {
    console.error("Error fetching products:", error);
    return res.status(500).json({
      message: "Error fetching products",
      error: error.message,
    });
  }
};



export { getProducts };
