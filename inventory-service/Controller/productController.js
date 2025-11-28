import Product from "../Model/ProductSchema.js";
import Category from "../Model/CategorySchema.js";

// Create a new product with image upload
const createProduct = async (req, res) => {
  try {
    const {
      name,
      mainCategory,
      subCategory,
      description,
      price,
      stock,
      brand,
      expiryDate,
    } = req.body;

    if (!name || !mainCategory || !price || !brand) {
      return res.status(400).json({
        message: "Name, mainCategory, brand, and price are required",
      });
    }

    const mainCat = await Category.findById(mainCategory);
    if (!mainCat)
      return res.status(404).json({ message: "Main category not found" });

    if (mainCat.parentCategory !== null)
      return res.status(400).json({
        message: "Main category must not have a parentCategory",
      });

    if (subCategory) {
      const subCat = await Category.findById(subCategory);
      if (!subCat)
        return res.status(404).json({ message: "Sub category not found" });

      if (!subCat.parentCategory)
        return res.status(400).json({
          message: "Provided sub category has no parent",
        });

      if (String(subCat.parentCategory) !== String(mainCategory))
        return res.status(400).json({
          message: "Sub category does not belong to the selected main category",
        });
    }

    let imagePath = [];
    if (req.files && req.files.length > 0) {
      imagePath = req.files.map((file) => `/uploads/${file.filename}`);
    }

    if (imagePath.length < 3) {
      return res.status(400).json({
        message: "At least 3 images are required",
      });
    }

    const newProduct = new Product({
      name,
      mainCategory,
      subCategory: subCategory || null,
      description,
      price,
      brand,
      stock: stock || 0,
      image: imagePath,
      expiryDate,
    });

    await newProduct.save();

    return res.status(201).json({
      message: "Product created successfully",
      product: newProduct,
    });
  } catch (error) {
    console.error("Create Product Error:", error);
    return res.status(500).json({
      message: "Server Error",
      error: error.message,
    });
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
      .populate("name")
      .sort({ createdAt: -1 });
    res.status(200).json({
      message: "Product Fetched",
      currentPage: page,
      totalPages: Math.ceil(totalProducts / limit),
      totalProducts,
      limit,
      search,
      data: response,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
};

const getProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const response = await Product.findById(id)
    res.status(200).json({ message: "Product Fetched", data: response });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
};

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
    const searchFilter = search
      ? { name: { $regex: search, $options: "i" } }
      : {};

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
      data: productCategory,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
};

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
    const { id } = req.params;

    const {
      name,
      mainCategory,
      subCategory,
      description,
      price,
      stock,
      brand,
      expiryDate,
    } = req.body;

    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    if (mainCategory) {
      const mainCat = await Category.findById(mainCategory);
      if (!mainCat)
        return res.status(404).json({ message: "Main category not found" });

      if (mainCat.parentCategory !== null)
        return res.status(400).json({
          message: "Main category must not have a parent",
        });

      product.mainCategory = mainCategory;
    }

    if (subCategory) {
      const subCat = await Category.findById(subCategory);
      if (!subCat)
        return res.status(404).json({ message: "Sub category not found" });

      if (!subCat.parentCategory)
        return res.status(400).json({
          message: "Provided sub category has no parent",
        });

      // Ensure subcategory belongs to mainCategory (new if updated, else old)
      const finalMain = mainCategory || product.mainCategory;

      if (String(subCat.parentCategory) !== String(finalMain)) {
        return res.status(400).json({
          message: "Sub category does not belong to selected main category",
        });
      }

      product.subCategory = subCategory;
    }

    let imagePaths = [];

    // If single image uploaded using "image"
    if (req.files?.image && req.files.image.length > 0) {
      imagePaths = [`/uploads/${req.files.image[0].filename}`];
    }

    // If multiple images uploaded using "images"
    if (req.files?.images && req.files.images.length > 0) {
      imagePaths = req.files.images.map((file) => `/uploads/${file.filename}`);
    }

    // Replace old images only if new ones provided
    if (imagePaths.length > 0) {
      product.image = imagePaths;
    }

    if (name) product.name = name;
    if (description) product.description = description;
    if (price !== undefined) product.price = price;
    if (stock !== undefined) product.stock = stock;
    if (brand) product.brand = brand;
    if (expiryDate) product.expiryDate = new Date(expiryDate);

    await product.save();

    return res.status(200).json({
      message: "Product updated successfully",
      product,
    });
  } catch (error) {
    console.error("Update Product Error:", error);
    return res.status(500).json({
      message: "Server Error",
      error: error.message,
    });
  }
};

const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const response = await Product.findByIdAndDelete(id);
    res.status(200).json({ message: "Product Deleted", data: response });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
};

const getProductsByIds = async (req, res) => {
  try {
    const { productIds, search } = req.body;

    // Base filter
    let filter = { _id: { $in: productIds } };

    // Add search filter if provided
    if (search && search.trim() !== "") {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },

        // Search by brand name
        // (brand is an ObjectId so we use populate + match)
      ];
    }

    const products = await Product.find(filter)
      .populate({
        path: "brand",
        match: search
          ? { name: { $regex: search, $options: "i" } }
          : {}, // apply search to brand name
      })
      .populate("mainCategory")
      .populate("subCategory");

    // ❗ Remove products whose brand did NOT match search
    const filteredProducts = products.filter((p) => {
      if (!search) return true; // if no search, return all
      if (p.brand) return true; // brand matched
      if (p.name?.toLowerCase().includes(search.toLowerCase())) return true;
      return false;
    });

    res.json({ data: filteredProducts });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


export {
  createProduct,
  productDetails,
  getProduct,
  productsByCategory,
  getProductsByBrand,
  updateProduct,
  deleteProduct,
  getProductsByIds
};
