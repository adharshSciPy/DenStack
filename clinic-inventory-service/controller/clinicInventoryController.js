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

  try {
    // 1️⃣ Fetch clinic inventory
    const inventory = await ClinicInventoryModel.find({ clinicId })
      .lean()
      .sort({ createdAt: -1 });

    if (!inventory.length) {
      return res.status(200).json({ message: "No products found", data: [] });
    }

    // 2️⃣ Extract UNIQUE product IDs
    const productIds = [
      ...new Set(inventory.map((i) => i.productId.toString())),
    ];
    

    // 3️⃣ Call product microservice once (BATCh)
    console.log("🔵 Requesting product service...");
    console.log("URL:", `${PRODUCT_SERVICE_URL}product/get-by-ids`);
    console.log("Payload:", { productIds });

    const response = await axios.post(
      `${PRODUCT_SERVICE_URL}product/get-by-ids`,
      { productIds }
    );

    console.log("🟢 Response from product service:", response.data);

    const { data } = response;
    const productList = data.data || [];

    // 4️⃣ Create a hashmap for fast lookup
    const productMap = new Map(productList.map((p) => [p._id.toString(), p]));

    // 5️⃣ Merge inventory + product data
    const result = inventory.map((inv) => ({
      ...inv,
      product: productMap.get(inv.productId.toString()) || null,
    }));

    return res.status(200).json({
      message: "Products fetched successfully",
      count: result.length,
      data: result,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Error fetching products",
      error: error.message,
    });
  }
};

export { getProducts };
