import ClinicInventoryModel from "../model/ClinicInventoryModel.js";


const getProducts=async(req, res) => {
    const { clinicId } = req.params;
    try {
        const products = await ClinicInventoryModel.find(clinicId)
            .populate("productId", "name price stock")
            .sort({ createdAt: -1 });
        res.status(200).json({
            message: "Products fetched successfully",
            data: products,
        });
    } catch (error) {
        res.status(500).json({
            message: "Error fetching products",
            error: error.message,
        });
    }
}



export  {
    getProducts,
};