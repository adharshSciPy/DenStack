import Product from "../Model/ProductSchema.js";
import Category from "../Model/CategorySchema.js";

// Create a new product with image upload
const createProduct = async (req, res) => {
    try {
        const { name, category, description, price, stock, brand, expiryDate } = req.body;

        // Validate required fields
        if (!name || !category || !price) {
            return res.status(400).json({ message: "Name, category, and price are required" });
        }

        // Check if category exists
        const categoryExists = await Category.findById(category);
        if (!categoryExists) {
            return res.status(404).json({ message: "Category not found" });
        }

        // Handle uploaded image
        let imagePath = [];
        if (req.files && req.files.length > 0) {
            imagePath = req.files.map((file) => `/uploads/${file.filename}`);
        }

        if (imagePath.length < 3) {
            return res.status(400).json({ message: "At least 3 images are required" });
        }

        const newProduct = new Product({
            name,
            category,
            description,
            price,
            stock: stock || 0,
            image: imagePath,
            brand,
            expiryDate,
        });

        await newProduct.save();

        res.status(201).json({
            message: "Product created successfully",
            product: newProduct,
        });
    } catch (error) {
        console.error("Create Product Error:", error);
        res.status(500).json({ message: "Server Error", error: error.message });
    }
};

const productDetails = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        const search = req.query.search || "";
        const filter = search ? { name: { $regex: search, $options: "i" } } : {};
        const totalProducts = await Product.countDocuments(filter);

        const response = await Product.find(filter)
            .skip(skip)
            .limit(limit)
            .populate("category", "name")
            .sort({ createdAt: -1 })
        res.status(200).json({
            message: "Product Fetched",
            currentPage: page,
            totalPages: Math.ceil(totalProducts / limit),
            totalProducts,
            limit,
            search,
            data: response
        });
    } catch (error) {
        res.status(500).json({ message: "Internal Server Error", error: error.message })
    }
}

const getProduct = async (req, res) => {
    try {
        const { id } = req.params;
        const response = await Product.findById(id);
        res.status(200).json({ message: "Product Fetched", data: response });
    } catch (error) {
        res.status(500).json({ message: "Internal Server Error", error: error.message })
    }
}

const productsByCategory = async (req, res) => {
    try {
        const { id } = req.params;
        const category = await Category.findById(id);
        if (!category) {
            return res.status(404).json({ message: "Category not found" });
        }

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        const search = req.query.search || "";
        const searchFilter = search ? { name: { $regex: search, $options: "i" } } : {};


        const filter = { category: id, ...searchFilter };
        const totalProducts = await Product.countDocuments(filter);

        const productCategory = await Product.find(filter)
            .skip(skip)
            .limit(limit)
            .sort({ createdAt: -1 });
        res.status(200).json({
            message: `Products fetched from ${category.name}`,
            currentPage: page,
            totalPages: Math.ceil(totalProducts / limit),
            totalProducts,
            limit,
            search,
            data: productCategory
        })


    } catch (error) {
        res.status(500).json({ message: "Internal Server Error", error: error.message })
    }
}

const getProductsByBrand = async (req, res) => {
    try {
        const products = await Product.find({ brand: req.params.id })
            .populate("brand", "name")
            .populate("category", "name");
        res.json(products);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const updateProduct = async (req, res) => {
    try {
        const { id } = req.params; // product ID from URL
        const { name, category, description, price, stock, brand, expiryDate } = req.body;

        // 🔹 Check if product exists
        const product = await Product.findById(id);
        if (!product) {
            return res.status(404).json({ message: "Product not found" });
        }

        // 🔹 Validate category (if changed)
        if (category) {
            const categoryExists = await Category.findById(category);
            if (!categoryExists) {
                return res.status(404).json({ message: "Category not found" });
            }
            product.category = category;
        }

        // 🔹 Handle new image(s)
        let imagePaths = [];

        // If single image uploaded
        if (req.files?.image && req.files.image.length > 0) {
            imagePaths = [`/uploads/${req.files.image[0].filename}`];
        }

        // If multiple images uploaded
        if (req.files?.images && req.files.images.length > 0) {
            imagePaths = req.files.images.map((file) => `/uploads/${file.filename}`);
        }

        // If new images uploaded, replace old ones
        if (imagePaths.length > 0) {
            product.image = imagePaths;
        }

        // 🔹 Update other fields (only if provided)
        if (name) product.name = name;
        if (description) product.description = description;
        if (price !== undefined) product.price = price;
        if (stock !== undefined) product.stock = stock;
        if (brand) product.brand = brand;
        if (expiryDate) product.expiryDate = new Date(expiryDate);

        // 🔹 Save updated product
        await product.save();

        res.status(200).json({
            message: "Product updated successfully",
            product,
        }, { new: true });
    } catch (error) {
        console.error("Update Product Error:", error);
        res.status(500).json({ message: "Server Error", error: error.message });
    }
};

const deleteProduct = async (req, res) => {
    try {
        const { id } = req.params;
        const response = await Product.findByIdAndDelete(id);
        res.status(200).json({ message: "Product Deleted", data: response });
    } catch (error) {
        res.status(500).json({ message: "Internal Server Error", error: error.message })
    }
}

export {
    createProduct, productDetails, getProduct, productsByCategory, getProductsByBrand, updateProduct, deleteProduct
}
