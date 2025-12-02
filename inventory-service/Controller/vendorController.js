import Vendor from "../Model/VendorSchema.js";
import Order from "../Model/OrderSchema.js"

const createVendor = async (req, res) => {
    try {
        const { name, companyName, email, phoneNumber, address, productsCount, totalRevenue, rating, performance, status, contactHistory } = req.body;
        const vendor = await Vendor.create({
            name, companyName, email, phoneNumber, address, productsCount, totalRevenue, rating, performance, status, contactHistory
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

const vendorCount = async (req, res) => {
    try {
        // 1️⃣ Total Vendors
        const totalVendors = await Vendor.countDocuments();

        // 2️⃣ Active Vendors — based on status field
        const activeVendors = await Vendor.countDocuments({ status: "Active" });

        // 3️⃣ Avg Rating (only works if vendor has "rating" field)
        const vendors = await Vendor.find();
        // 3️⃣ Calculate average vendor rating using aggregation
        const ratingAgg = await Vendor.aggregate([
            {
                $match: {
                    rating: { $exists: true, $ne: null } // include only vendors with a rating
                }
            },
            {
                $project: {
                    rating: { $toDouble: "$rating" }  // convert string "4.5" to number 4.5
                }
            },
            {
                $group: {
                    _id: null,
                    avgRating: { $avg: "$rating" }
                }
            }
        ]);

        const avgRating = ratingAgg.length > 0 ? ratingAgg[0].avgRating.toFixed(1) : "0.0";


        // 4️⃣ Total Revenue from Orders
        const revenue = await Order.aggregate([
            { $group: { _id: null, total: { $sum: "$totalAmount" } } },
        ]);

        const totalRevenue = revenue.length > 0 ? revenue[0].total : 0;

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

export {
    createVendor, vendorDetails, editVendor, deleteVendor, vendorCount
}