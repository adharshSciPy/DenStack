import Product from "../Model/ProductSchema.js";
import Category from "../Model/CategorySchema.js";
import path from "path";
import fs from "fs";

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
        let imagePath = "";
        if (req.file) {
            imagePath = `/uploads/${req.file.filename}`;
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
        const response = await Product.find();
        res.status(200).json({ message: "Product Fetched", data: response });
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

        // 🔹 Handle new image upload (if provided)
        if (req.file) {
            product.image = [`/uploads/${req.file.filename}`]; // replace existing image
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
        });
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
    createProduct, productDetails, getProduct, updateProduct, deleteProduct
}
