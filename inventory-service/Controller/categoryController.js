import Category from "../Model/CategorySchema.js";

const createCategory = async (req, res) => {
    try {
        const { categoryName, description } = req.body
        const category = await Category.create({
            categoryName, description
        })
        res.status(200).json({ message: "Category Created Successfully", data: category })
    } catch (error) {
        res.status(500).json({ message: "Internal Server Error", error: error.message })
    }
}

const categoryDetails = async (req, res) => {
    try {
        const details = await Category.find();
        res.status(200).json({ message: "Category Fetched", data: details })
    } catch (error) {
        res.status(500).json({ message: "Internal Server Error", error: error.message })
    }
}

const deleteCategory = async (req, res) => {
    try {
        const { id } = req.params;
        const deletedCategory = await Category.findByIdAndDelete(id);
        res.status(200).json({ message: "Category Deleted", data: deletedCategory })
    } catch (error) {
        res.status(500).json({ message: "Internal Server Error", error: error.message })
    }
}

export {
    createCategory, categoryDetails, deleteCategory
}