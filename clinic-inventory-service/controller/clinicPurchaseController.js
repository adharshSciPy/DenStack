import ClinicPurchaseOrder from "../model/ClinicPurchaseOrder.js";
import ClinicInventory from "../model/ClinicInventoryModel.js";
import axios from "axios";

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
        const {clinicId, items } = req.body;

        if (!items || items.length === 0) {
            return res.status(400).json({ message: "No items provided" });
        }
        if(!clinicId){
            return res.status(400).json({ message: "No clinicId provided" });
        }
        // Extract token from incoming request
        const authHeader = req.headers['authorization'];
        if (!authHeader) {
            return res.status(401).json({ message: "No authorization token provided" });
        }

        // Send order request to Inventory
        const response = await axios.post(
            `${process.env.INVENTORY_SERVICE_URL}order/createOrder`,
            { clinicId, items },
            {
                headers: {
                    Authorization: authHeader,   // forward token
                }
            }
        );

        const inventoryOrder = response.data.order;

        if (!inventoryOrder) {
            return res.status(500).json({ message: "Invalid response from Inventory" });
        }

        // Save in Clinic DB
        const createdOrder = await ClinicPurchaseOrder.create({
            clinicId,
            items: inventoryOrder.items,
            totalAmount: inventoryOrder.totalAmount,
            status: "PENDING",
            linkedInventoryOrderId: inventoryOrder._id
        });

        res.status(201).json({
            message: "Order placed successfully",
            order: createdOrder
        });

    } catch (err) {
        console.log("Purchase Error →", err.response?.data || err.message);
        res.status(500).json({
            message: "Server error",
            error: err.response?.data || err.message
        });
    }
};

export const markDelivered = async (req, res) => {
  try {
    const { clinicId, items } = req.body;

    for (const item of items) {
      const existing = await ClinicInventory.findOne({
        clinicId,
        productId: item.productId,
      });

      if (existing) {
        existing.quantity += item.quantity;
        await existing.save();
      } else {
        await ClinicInventory.create({
          clinicId,
          productId: item.productId,
          quantity: item.quantity,
          inventoryType: "general",
          assignedTo: null,
        });
      }
    }

    res.json({ message: "Clinic inventory updated successfully" });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

export const  getClinicOrders = async (req, res) => {
    try {
        const { clinicId } = req.params;
        const orders = await ClinicPurchaseOrder.find({ clinicId }).sort({ createdAt: -1 });

        res.status(200).json({
            message: "Orders fetched successfully",
            data: orders
        });
    }
    catch (error) {
        console.error("Get Clinic Orders Error:", error);
        res.status(500).json({ success: false, message: "Server Error" });
    }
};