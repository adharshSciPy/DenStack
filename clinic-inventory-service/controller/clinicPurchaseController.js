import ClinicPurchaseOrder from "../model/ClinicPurchaseOrder.js";
import ClinicInventory from "../model/ClinicInventoryModel.js";
import ClinicProduct from "../model/ClinicProduct.js";
import axios from "axios";

const INVENTORY_SERVICE_URL = 'http://localhost:8004/api/v1/'
// export const clinicPurchase = async (req, res) => {
//   try {
//     const { clinicId } = req.params;
//     const { items } = req.body;
//     const authHeader = req.headers["authorization"];

//     if (!items || items.length === 0)
//       return res.status(400).json({ message: "No items provided" });

//     let totalAmount = 0;
//     let orderItems = [];

//     // for (const item of items) {

//     //     const productRes = await axios.get(
//     //         `${process.env.INVENTORY_SERVICE_URL}/product/getProduct/${item.productId}`
//     //     );

//     //     const product = productRes.data.data;
//     //     if (!product) return res.status(404).json({ message: "Product not found" });

//     //     if (product.stock < item.quantity)
//     //         return res.status(400).json({ message: `${product.name} is out of stock` });

//     //     totalAmount += product.price * item.quantity;

//     //     orderItems.push({
//     //         productId: item.productId,
//     //         quantity: item.quantity,
//     //         price: product.price
//     //     });

//     //     // Reduce stock in Super Admin Inventory
//     //     await axios.patch(
//     //         `${process.env.INVENTORY_SERVICE_URL}/product/reduce-stock`,
//     //         { productId: item.productId, quantity: item.quantity }
//     //     );
//     // }

//     // Create a Purchase Order (PENDING delivery)
//     const createOrderResponse = await axios.post(
//       `${process.env.INVENTORY_SERVICE_URL}/order/createOrder`,
//       { clinicId, items },
//       {
//         headers: {
//           Authorization: authHeader, // pass token
//         },
//       }
//     );
//     const order = await ClinicPurchaseOrder.create({
//       clinicId,
//       items: orderItems,
//       totalAmount,
//       status: "PENDING",
//     });

//     res.status(201).json({
//       message: "Order placed successfully",
//       order,
//     });
//   } catch (err) {
//     console.log("Purchase Error →", err.response?.data || err.message);
//     res.status(500).json({ message: "Server error", error: err.message });
//   }
// };

export const clinicPurchase = async (req, res) => {
  try {
    const { clinicId, items } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ message: "No items provided" });
    }
    if (!clinicId) {
      return res.status(400).json({ message: "No clinicId provided" });
    }

    // Extract auth token
    const authHeader = req.headers["authorization"];
    if (!authHeader) {
      return res.status(401).json({ message: "No authorization token provided" });
    }

    let createdOrders = [];

    // 🔥 LOOP THROUGH EACH ITEM → CREATE SEPARATE ORDER
    for (const singleItem of items) {
      const response = await axios.post(
        `${process.env.INVENTORY_SERVICE_URL}order/createOrder`,
        { clinicId, items: [singleItem] }, // 👈 IMPORTANT: send only 1 item
        {
          headers: {
            Authorization: authHeader,
          },
        }
      );

      const inventoryOrder = response.data?.order;

      if (!inventoryOrder) {
        return res.status(500).json({
          message: "Invalid response from Inventory for item",
          item: singleItem,
        });
      }
      console.log(inventoryOrder);
      
      // Save in Clinic DB
      const createdOrder = await ClinicPurchaseOrder.create({
        clinicId,
        items: inventoryOrder.items,
        totalAmount: inventoryOrder.totalAmount,
        status: "PENDING",
        linkedInventoryOrderId: inventoryOrder._id,
      });

      createdOrders.push(createdOrder);
    }

    res.status(201).json({
      message: "Orders created successfully (one per item)",
      orders: createdOrders,
    });

  } catch (err) {
    console.log("Purchase Error →", err.response?.data || err.message);
    res.status(500).json({
      message: "Server error",
      error: err.response?.data || err.message,
    });
  }
};


export const markDelivered = async (req, res) => {
  try {
    const { orderId, clinicId } = req.body;

    if (!orderId || !clinicId) {
      return res.status(400).json({ message: "orderId and clinicId required" });
    }

    // Fetch order
    const order = await ClinicPurchaseOrder.findById(orderId);
    if (!order) return res.status(404).json({ message: "Order not found" });

    // Prevent duplicate updates
    if (order.status === "DELIVERED") {
      return res.status(400).json({
        message: "Order already delivered. Inventory update skipped.",
      });
    }

    // LOOP ITEMS
    for (const item of order.items) {
      console.log("Processing item:", item);
      const existing = await ClinicInventory.findOne({
        clinicId,
        productId: item.productId,
      });

      const threshold = existing?.lowStockThreshold || 20;

      if (existing) {
        // Update quantity
        existing.quantity += item.quantity;

        // AUTO UPDATE LOW STOCK FLAG
        existing.isLowStock = existing.quantity <= threshold;

        await existing.save();
      } else {
        // Create new inventory record
        await ClinicInventory.create({
          clinicId,
          productId: item.productId,
          quantity: item.quantity,
          inventoryType: "general",
          assignedTo: null,
          lowStockThreshold: threshold,
          isLowStock: item.quantity <= threshold
        });
      }
    }

    // Update order status
    order.status = "DELIVERED";
    await order.save();

    res.json({
      message: "Order marked as delivered & inventory updated",
      order,
    });
  } catch (err) {
    res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
};
  
export const getClinicOrders = async (req, res) => {
  try {
    const { clinicId } = req.params;

    const orders = await ClinicPurchaseOrder.find({ clinicId }).sort({ createdAt: -1 });

    // 🔥 Loop all orders & fetch product details for each item
    const ordersWithProducts     = await Promise.all(
      orders.map(async (order) => {
        const updatedItems = await Promise.all(
          order.items.map(async (item) => {
            try {
              const productResponse = await axios.get(
                `${INVENTORY_SERVICE_URL}product/getProduct/${item.itemId}`
              );

              return {
                ...item._doc,
                product: productResponse.data.data  // attach product details
              };
            } catch (err) {
              return { ...item._doc, product: null }; // product service down
            }
          })
        );

        return {
          ...order._doc,
          items: updatedItems
        };
      })
    );

    res.status(200).json({
      message: "Orders fetched successfully",
      data: ordersWithProducts,
    });

  } catch (error) {
    console.error("Get Clinic Orders Error:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

export const manualAddInventory = async (req, res) => {
  try {
    const {
      clinicId,
      productId,
      quantity,
      vendor,
      notes
    } = req.body;

    if (!clinicId || !productId || !quantity) {
      return res.status(400).json({
        message: "clinicId, productId & quantity are required",
      });
    }
    let finalProductType = "local";
    // 🔥 Auto-detect local product (force productType = local)
    // let finalProductType = productType;
    const isLocalProduct = await ClinicProduct.findOne({
      _id: productId, 
      clinicId,
    });

    if (isLocalProduct) {
      finalProductType = "local";
    }

    // Check if inventory entry already exists
    const existing = await ClinicInventory.findOne({
      clinicId,
      productId,
    });

    // Determine low-stock threshold
    const threshold =
      existing?.lowStockThreshold ||
      isLocalProduct?.lowStockThreshold ||
      20;

    // 🟢 If inventory exists → update stock
    if (existing) {
      existing.quantity += Number(quantity);
      existing.isLowStock = existing.quantity <= threshold;
      await existing.save();

      return res.status(200).json({
        message: "Stock updated successfully",
        updatedQuantity: existing.quantity,
        isLowStock: existing.isLowStock,
      });
    }

    // 🟠 If inventory does NOT exist → create a new entry
    const newEntry = await ClinicInventory.create({
      clinicId,
      productId,
      productType: finalProductType,
      quantity,
      inventoryType: "general",
      assignedTo: null,
      lowStockThreshold: threshold,
      isLowStock: quantity <= threshold,
      vendor: vendor || "Manual Entry",
      notes: notes || "",
    });

    return res.status(201).json({
      message: "Manual inventory added successfully",
      data: newEntry,
    });

  } catch (err) {
    return res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
};


