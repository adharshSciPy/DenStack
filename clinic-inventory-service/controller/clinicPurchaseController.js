import ClinicPurchaseOrder from "../model/ClinicPurchaseOrder.js";
import ClinicInventory from "../model/ClinicInventoryModel.js";


import axios from "axios";

export const clinicPurchase = async (req, res) => {
    try {
        const clinicId = req.clinicId;
        const { items } = req.body;

        if (!items || items.length === 0)
            return res.status(400).json({ message: "No items provided" });

        let totalAmount = 0;
        let orderItems = [];

        for (const item of items) {

            const productRes = await axios.get(
                `${process.env.INVENTORY_SERVICE_URL}/product/getProduct/${item.productId}`
            );

            const product = productRes.data.data;
            if (!product) return res.status(404).json({ message: "Product not found" });

            if (product.stock < item.quantity)
                return res.status(400).json({ message: `${product.name} is out of stock` });

            totalAmount += product.price * item.quantity;

            orderItems.push({
                productId: item.productId,
                quantity: item.quantity,
                price: product.price
            });

            // Reduce stock in Super Admin Inventory
            await axios.patch(
                `${process.env.INVENTORY_SERVICE_URL}/product/reduce-stock`,
                { productId: item.productId, quantity: item.quantity }
            );
        }

        // Create a Purchase Order (PENDING delivery)
        const order = await ClinicPurchaseOrder.create({
            clinicId,
            items: orderItems,
            totalAmount,
            status: "PENDING"
        });

        res.status(201).json({
            message: "Order placed successfully",
            order
        });

    } catch (err) {
        console.log("Purchase Error →", err.response?.data || err.message);
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

export const markDelivered = async (req, res) => {
    try {
        const { clinicId, items } = req.body;

        for (const item of items) {
            const existing = await ClinicInventory.findOne({
                clinicId,
                productId: item.productId
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
                    assignedTo: null
                });
            }
        }

        res.json({ message: "Clinic inventory updated successfully" });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};