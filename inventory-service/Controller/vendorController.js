import Vendor from "../Model/VendorSchema.js";
import Order from "../Model/OrderSchema.js"
import Category from "../Model/CategorySchema.js";
import Product from "../Model/ProductSchema.js";
import mongoose from "mongoose";

const createVendor = async (req, res) => {
    try {
        const { name, companyName, email, phoneNumber, address, productsCount, rating, performance, status, contactHistory } = req.body;
        const vendor = await Vendor.create({
            name, companyName, email, phoneNumber, address, productsCount, totalRevenue: 0, rating, performance, status, contactHistory
        })
        res.status(200).json({ message: "Successfully Created", data: vendor })
    } catch (error) {
        res.status(500).json({ message: "Internal Server Error", error: error.message })
    }
}

const vendorDetails = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        const totalVendors = await Vendor.countDocuments();
        const details = await Vendor.find()
            .skip(skip)
            .limit(limit)
            .sort({ createdAt: -1 })
        res.status(200).json({
            message: "Vendor details Fetched",
            currentpage: page,
            totalPages: Math.ceil(totalVendors / limit),
            totalVendors,
            limit,
            data: details
        });
    } catch (error) {
        res.status(500).json({ message: "Internal Server Error", error: error.message })
    }
}

const editVendor = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, companyName, email, phoneNumber, address, productsCount, totalRevenue, rating, performance, status, contactHistory } = req.body;

        // 🧠 Prepare update data
        const updateData = { name, companyName, email, phoneNumber, address, productsCount, totalRevenue, rating, performance, status };

        // 🗂️ If there’s new contact history, append it instead of replacing
        if (contactHistory && contactHistory.length > 0) {
            await Vendor.findByIdAndUpdate(
                id,
                { $push: { contactHistory: { $each: contactHistory } } }
            );
        }

        // 🧾 Update the rest of the vendor details
        const vendor = await Vendor.findByIdAndUpdate(id, updateData, { new: true });

        res.status(200).json({
            success: true,
            message: "Vendor updated successfully",
            data: vendor,
        });
    } catch (error) {
        console.error("Error editing vendor:", error);
        res.status(500).json({
            success: false,
            message: "Internal Server Error",
            error: error.message,
        });
    }
};

const deleteVendor = async (req, res) => {
    try {
        const { id } = req.params;
        const deleteVendor = await Vendor.findByIdAndDelete(id);
        res.status(200).json({ message: "Deleted Successfully", data: deleteVendor })
    } catch (error) {
        res.status(500).json({ message: "Internal Server Error", error: error.message })
    }
}


const adminDashboardStats = async (req, res) => {
    try {
        // total vendors
        const totalVendors = await Vendor.countDocuments();

        // active vendors
        const activeVendors = await Vendor.countDocuments({ status: "Active" });

        // average rating
        const ratingAgg = await Vendor.aggregate([
            { $match: { rating: { $exists: true, $ne: null } } },
            { $project: { rating: { $toDouble: "$rating" } } },
            { $group: { _id: null, avgRating: { $avg: "$rating" } } }
        ]);

        const avgRating = ratingAgg.length ? ratingAgg[0].avgRating.toFixed(1) : "0.0";

        // total revenue
        const revenue = await Order.aggregate([
            { $group: { _id: null, total: { $sum: "$totalAmount" } } }
        ]);

        const totalRevenue = revenue.length ? revenue[0].total : 0;

        res.status(200).json({
            success: true,
            data: {
                totalVendors,
                activeVendors,
                avgRating,
                totalRevenue,
            },
        });

    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

const getVendorCategoryAnalytics = async (req, res) => {
    try {
        // 1️⃣ Fetch all MAIN categories (parentCategory === null)
        const categories = await Category.find({ parentCategory: null }).lean();

        let results = [];

        for (let cat of categories) {
            const categoryId = cat._id;

            // 2️⃣ Vendors who have products in this main category
            const products = await Product.find({
                mainCategory: categoryId
            }).select("addedById addedByType");

            // Extract vendor IDs only (skip superadmin-added products)
            const vendorIds = [
                ...new Set(
                    products
                        .filter(p => p.addedByType === "vendor")
                        .map(p => p.addedById.toString())
                )
            ];

            // 3️⃣ Revenue from orders associated with products in this category
            const revenueData = await Order.aggregate([
                { $unwind: "$items" },

                // join with product collection
                {
                    $lookup: {
                        from: "products",
                        localField: "items.itemId",
                        foreignField: "_id",
                        as: "prod"
                    }
                },
                { $unwind: "$prod" },

                // filter only products under this main category
                {
                    $match: {
                        "prod.mainCategory": new mongoose.Types.ObjectId(categoryId)
                    }
                },

                {
                    $group: {
                        _id: null,
                        totalRevenue: { $sum: "$items.totalCost" }
                    }
                }
            ]);

            const totalRevenue = revenueData[0]?.totalRevenue || 0;
            const totalVendors = vendorIds.length;
            const avgPerVendor =
                totalVendors === 0 ? 0 : Math.round(totalRevenue / totalVendors);

            // 4️⃣ Push final payload
            results.push({
                categoryName: cat.categoryName,
                vendors: totalVendors,
                revenue: totalRevenue,
                avgPerVendor
            });
        }

        res.status(200).json({
            success: true,
            message: "Vendor category analytics loaded successfully",
            data: results
        });

    } catch (error) {
        console.log("Vendor category analytics error:", error);
        res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message
        });
    }
};


export {
    createVendor, vendorDetails, editVendor, deleteVendor, adminDashboardStats, getVendorCategoryAnalytics
}