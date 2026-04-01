import Product from "../Model/ProductSchema.js";
import Category from "../Model/CategorySchema.js";
import Vendor from "../Model/VendorSchema.js";
import mongoose from 'mongoose';
import Brand from "../Model/BrandSchema.js";
import Favourite from "../Model/FavouritesSchema.js";

// Create a new product with image upload
const createProduct = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ message: "Unauthorized. Please log in to create products." });
    }

    req.body.addedByType =
      req.user.role === "800" ? "superadmin" :
        req.user.role === "812" ? "vendor" : null;

    const { name, mainCategory, subCategory, description, price, stock, brand, expiryDate, addedByType } = req.body;

    if (!name || !mainCategory || !price || !brand) {
      return res.status(400).json({ message: "Name, mainCategory, brand, and price are required" });
    }

    let mainCategoryId;
    let mainCat;
    const isValidObjectId = /^[0-9a-fA-F]{24}$/.test(mainCategory);
    if (isValidObjectId) mainCat = await Category.findById(mainCategory);
    if (!mainCat) {
      mainCat = await Category.findOne({
        name: { $regex: new RegExp(`^${mainCategory.trim()}$`, 'i') },
        parentCategory: null
      });
    }
    if (!mainCat) return res.status(404).json({ message: `Main category "${mainCategory}" not found.` });
    if (mainCat.parentCategory !== null) return res.status(400).json({ message: "Main category must not have a parentCategory" });
    mainCategoryId = mainCat._id;

    let subCategoryId = null;
    if (subCategory) {
      let subCat;
      const isValidSubObjectId = /^[0-9a-fA-F]{24}$/.test(subCategory);
      if (isValidSubObjectId) subCat = await Category.findById(subCategory);
      if (!subCat) {
        subCat = await Category.findOne({
          name: { $regex: new RegExp(`^${subCategory.trim()}$`, 'i') },
          parentCategory: mainCategoryId
        });
      }
      if (!subCat) return res.status(404).json({ message: `Sub category "${subCategory}" not found` });
      if (!subCat.parentCategory) return res.status(400).json({ message: "Provided sub category has no parent" });
      if (String(subCat.parentCategory) !== String(mainCategoryId))
        return res.status(400).json({ message: "Sub category does not belong to the selected main category" });
      subCategoryId = subCat._id;
    }

    let brandId;
    const isValidBrandObjectId = /^[0-9a-fA-F]{24}$/.test(brand);
    if (isValidBrandObjectId) {
      const brandDoc = await Brand.findById(brand);
      if (!brandDoc) return res.status(404).json({ message: "Brand not found" });
      brandId = brand;
    } else {
      let brandDoc = await Brand.findOne({ name: { $regex: new RegExp(`^${brand.trim()}$`, 'i') } });
      if (!brandDoc) {
        brandDoc = new Brand({ name: brand.trim(), category: mainCategoryId, image: "/uploads/default-brand.jpg" });
        await brandDoc.save();
      }
      brandId = brandDoc._id;
    }

    let imagePath = [];
    if (req.files && req.files.length > 0) imagePath = req.files.map((file) => `/uploads/${file.filename}`);
    if (imagePath.length < 3) return res.status(400).json({ message: "At least 3 images are required" });

    const newProduct = new Product({
      name, description, mainCategory: mainCategoryId, subCategory: subCategoryId,
      price, stock: stock || 0, brand: brandId, image: imagePath,
      expiryDate: expiryDate ? new Date(expiryDate) : undefined,
      addedById: req.user.id, addedByType
    });

    await newProduct.save();
    await newProduct.populate([
      { path: 'mainCategory', select: 'name categoryName' },
      { path: 'subCategory', select: 'name categoryName' },
      { path: 'brand', select: 'name image' }
    ]);

    res.status(201).json({ message: "Product created successfully", product: newProduct });
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
    const response = await Product.find(filter).skip(skip).limit(limit).sort({ createdAt: -1 });
    res.status(200).json({
      message: "Product Fetched", currentPage: page,
      totalPages: Math.ceil(totalProducts / limit), totalProducts, limit, search, data: response,
    });
  } catch (error) {
    res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};

const getProduct = async (req, res) => {
  try {
    const response = await Product.findById(req.params.id);
    res.status(200).json({ message: "Product Fetched", data: response });
  } catch (error) {
    res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};

const productsByCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const category = await Category.findById(id);
    if (!category) return res.status(404).json({ message: "Category not found" });

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const search = req.query.search || "";
    const searchFilter = search ? { name: { $regex: search, $options: "i" } } : {};
    const filter = { category: id, ...searchFilter };
    const totalProducts = await Product.countDocuments(filter);
    const productCategory = await Product.find(filter).skip(skip).limit(limit).sort({ createdAt: -1 });

    res.status(200).json({
      message: `Products fetched from ${category.name}`,
      currentPage: page, totalPages: Math.ceil(totalProducts / limit),
      totalProducts, limit, search, data: productCategory,
    });
  } catch (error) {
    res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};

const getProductsByBrand = async (req, res) => {
  try {
    const products = await Product.find({ brand: req.params.id })
      .populate("brand", "name").populate("category", "name");
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, mainCategory, subCategory, description, price, stock, brand, expiryDate } = req.body;

    const product = await Product.findById(id);
    if (!product) return res.status(404).json({ message: "Product not found" });

    if (mainCategory) {
      const mainCat = await Category.findById(mainCategory);
      if (!mainCat) return res.status(404).json({ message: "Main category not found" });
      if (mainCat.parentCategory !== null) return res.status(400).json({ message: "Main category must not have a parent" });
      product.mainCategory = mainCategory;
    }

    if (subCategory) {
      const subCat = await Category.findById(subCategory);
      if (!subCat) return res.status(404).json({ message: "Sub category not found" });
      if (!subCat.parentCategory) return res.status(400).json({ message: "Provided sub category has no parent" });
      const finalMain = mainCategory || product.mainCategory;
      if (String(subCat.parentCategory) !== String(finalMain))
        return res.status(400).json({ message: "Sub category does not belong to selected main category" });
      product.subCategory = subCategory;
    }

    let imagePaths = [];
    if (req.files?.image?.length > 0) imagePaths = [`/uploads/${req.files.image[0].filename}`];
    if (req.files?.images?.length > 0) imagePaths = req.files.images.map((f) => `/uploads/${f.filename}`);
    if (imagePaths.length > 0) product.image = imagePaths;

    if (name) product.name = name;
    if (description) product.description = description;
    if (price !== undefined) product.price = price;
    if (stock !== undefined) product.stock = stock;
    if (brand) product.brand = brand;
    if (expiryDate) product.expiryDate = new Date(expiryDate);

    await product.save();
    return res.status(200).json({ message: "Product updated successfully", product });
  } catch (error) {
    console.error("Update Product Error:", error);
    return res.status(500).json({ message: "Server Error", error: error.message });
  }
};

const deleteProduct = async (req, res) => {
  try {
    const response = await Product.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: "Product Deleted", data: response });
  } catch (error) {
    res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};

const getProductsByIds = async (req, res) => {
  try {
    const { productIds, search } = req.body;
    let filter = { _id: { $in: productIds } };
    if (search?.trim()) filter.$or = [{ name: { $regex: search, $options: "i" } }];

    const products = await Product.find(filter)
      .populate({ path: "brand", match: search ? { name: { $regex: search, $options: "i" } } : {} })
      .populate("mainCategory").populate("subCategory");

    const filteredProducts = products.filter((p) => {
      if (!search) return true;
      if (p.brand) return true;
      return p.name?.toLowerCase().includes(search.toLowerCase());
    });

    res.json({ data: filteredProducts });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getProductDashboardMetrics = async (req, res) => {
  try {
    const totalProducts = await Product.countDocuments();
    const avgRatingData = await Product.aggregate([{ $group: { _id: null, avg: { $avg: "$rating" } } }]);
    const avgRating = avgRatingData[0]?.avg || 0;
    const lowStockCount = await Product.countDocuments({ stock: { $lt: 10 } });
    const inventoryValueData = await Product.aggregate([
      { $group: { _id: null, total: { $sum: { $multiply: ["$originalPrice", "$stock"] } } } }
    ]);
    const totalInventoryValue = inventoryValueData[0]?.total || 0;
    res.status(200).json({
      success: true,
      data: { totalProducts, avgRating: avgRating.toFixed(1), lowStockCount, totalInventoryValue },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getProductInventoryList = async (req, res) => {
  try {
    const products = await Product.find()
      .populate("mainCategory", "name categoryName")
      .populate("subCategory", "name categoryName")
      .populate("brand", "name");

    const formatted = products.map((item) => ({
      _id: item._id,
      productId: item.productId,
      name: item.name,
      image: item.image?.[0] || "",
      brand: item.brand?.name,
      mainCategory: item.mainCategory?.categoryName || item.mainCategory?.name,
      subCategory: item.subCategory?.categoryName || item.subCategory?.name || null,
      price: item.originalPrice,
      stock: item.stock,
      status: item.status,
      rating: item.rating || 0,
      isLowStock: item.isLowStock,
    }));

    res.status(200).json({ success: true, products: formatted });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ============================================
// FAVORITES
// ============================================

/**
 * @route   GET /api/v1/product/favorites
 * @desc    Get user's favorite products
 * @access  Private
 */
const getFavorites = async (req, res) => {
  try {
    const userId = req.user.id || req.user.clinicId;
    if (!userId) return res.status(401).json({ success: false, message: "User not identified" });

    const favorites = await Favourite.find({ user: userId })
      .populate({
        path: "product",
        // ✅ Exact field names from ProductSchema — NOT basePrice, NOT price
        select: [
          "productId", "name", "description", "image", "status",
          "stock", "isLowStock", "isActive",
          "originalPrice",           // ← the actual price field in schema
          "clinicDiscountPrice", "clinicDiscountPercentage",
          "doctorDiscountPrice", "doctorDiscountPercentage",
          "variants",                // ← optional, may be empty []
          "brand", "mainCategory", "subCategory"
        ].join(" "),
        populate: [
          { path: "brand", select: "name" },
          { path: "mainCategory", select: "categoryName name" }, // ← both field names for safety
          { path: "subCategory", select: "categoryName name" }
        ]
      })
      .sort({ createdAt: -1 });

    const formattedFavorites = favorites
      .filter(fav => fav.product !== null)
      .map(fav => ({
        _id: fav._id,
        product: fav.product,
        variantId: fav.variantId,
        addedAt: fav.addedAt,
        createdAt: fav.createdAt,
        updatedAt: fav.updatedAt
      }));

    res.status(200).json({ success: true, count: formattedFavorites.length, data: formattedFavorites });
  } catch (error) {
    console.error("Get favorites error:", error);
    res.status(500).json({ success: false, message: "Server error while fetching favorites" });
  }
};

/**
 * @route   POST /api/v1/product/favorites/add/:productId
 * @desc    Toggle favorite (add/remove)
 * @access  Private
 */
const addFavorite = async (req, res) => {
  try {
    const userId = req.user.id || req.user.clinicId;
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const { productId } = req.params;
    const { variantId } = req.body || {};

    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ success: false, message: "Product not found" });
    if (product.status !== "Available")
      return res.status(400).json({ success: false, message: "Product is not available" });

    const existingFavorite = await Favourite.findOne({ user: userId, product: productId });

    if (existingFavorite) {
      await Favourite.deleteOne({ _id: existingFavorite._id });
      return res.status(200).json({ success: true, message: "Product removed from favorites", liked: false });
    }

    const favorite = await Favourite.create({ user: userId, product: productId, variantId: variantId || null });
    await favorite.populate({ path: "product", select: "name image status" });

    return res.status(200).json({ success: true, message: "Product added to favorites", liked: true, data: favorite });
  } catch (error) {
    console.error("Toggle favorite error:", error);
    return res.status(500).json({ success: false, message: "Server error while toggling favorite" });
  }
};

/**
 * @route   DELETE /api/v1/product/favorites/remove/:favoriteId
 * @desc    Remove favorite by document ID
 * @access  Private
 */
const removeFavoriteById = async (req, res) => {
  try {
    const userId = req.user.id || req.user.clinicId;
    if (!userId) return res.status(401).json({ success: false, message: "User not identified" });

    const favorite = await Favourite.findOneAndDelete({ _id: req.params.favoriteId, user: userId });
    if (!favorite) return res.status(404).json({ success: false, message: "Favorite item not found" });

    res.json({ success: true, message: "Item removed from favorites", data: { productId: favorite.product } });
  } catch (error) {
    console.error("Remove favorite by ID error:", error);
    res.status(500).json({ success: false, message: "Server error while removing from favorites" });
  }
};

/**
 * @route   GET /api/v1/product/favorites/check/:productId
 * @desc    Check if product is in favorites
 * @access  Private
 */
const checkFavorite = async (req, res) => {
  try {
    const userId = req.user.id || req.user.clinicId;
    if (!userId) return res.status(401).json({ success: false, message: "User not identified" });

    const favorite = await Favourite.findOne({ user: userId, product: req.params.productId });
    res.status(200).json({
      success: true,
      isFavorite: !!favorite,
      data: favorite ? { _id: favorite._id, variantId: favorite.variantId, addedAt: favorite.addedAt } : null
    });
  } catch (error) {
    console.error("Check favorite error:", error);
    res.status(500).json({ success: false, message: "Server error while checking favorite status" });
  }
};

export {
  createProduct, productDetails, getProduct, productsByCategory,
  getProductsByBrand, updateProduct, deleteProduct, getProductsByIds,
  getProductDashboardMetrics, getProductInventoryList,
  getFavorites, addFavorite, removeFavoriteById, checkFavorite
};