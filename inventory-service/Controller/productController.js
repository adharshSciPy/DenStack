import Product from "../Model/ProductSchema.js";
import Category from "../Model/CategorySchema.js";
import Vendor from "../Model/VendorSchema.js";
import mongoose from 'mongoose';
import Brand from "../Model/BrandSchema.js"
import Favourite from "../Model/FavouritesSchema.js";

// Create a new product with image upload
const createProduct = async (req, res) => {
  try {
    // Validate user exists FIRST
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        message: "Unauthorized. Please log in to create products.",
      });
    }

    req.body.addedByType =
      req.user.role === "800" ? "superadmin" :
        req.user.role === "812" ? "vendor" :
          null;

    const {
      name,
      mainCategory,
      subCategory,
      description,
      price,
      stock,
      brand,
      expiryDate,
      addedByType
    } = req.body;

    // Basic validations
    if (!name || !mainCategory || !price || !brand) {
      return res.status(400).json({
        message: "Name, mainCategory, brand, and price are required",
      });
    }

    // Main Category validation - handle both ObjectId and name
    let mainCategoryId;
    let mainCat;

    // Check if it's a valid 24-character hex string (MongoDB ObjectId format)
    const isValidObjectId = /^[0-9a-fA-F]{24}$/.test(mainCategory);

    if (isValidObjectId) {
      // Try as ObjectId first
      mainCat = await Category.findById(mainCategory);
    }

    if (!mainCat) {
      // Try as name (for frontend mock data or user convenience)
      mainCat = await Category.findOne({
        name: { $regex: new RegExp(`^${mainCategory.trim()}$`, 'i') },
        parentCategory: null
      });
    }

    if (!mainCat) {
      return res.status(404).json({
        message: `Main category "${mainCategory}" not found. Please ensure the category exists.`
      });
    }

    if (mainCat.parentCategory !== null) {
      return res.status(400).json({
        message: "Main category must not have a parentCategory",
      });
    }

    mainCategoryId = mainCat._id;

    // Subcategory validation - handle both ObjectId and name
    let subCategoryId = null;
    if (subCategory) {
      let subCat;

      // Check if it's a valid 24-character hex string (MongoDB ObjectId format)
      const isValidSubObjectId = /^[0-9a-fA-F]{24}$/.test(subCategory);

      if (isValidSubObjectId) {
        // Try as ObjectId first
        subCat = await Category.findById(subCategory);
      }

      if (!subCat) {
        // Try as name under the main category
        subCat = await Category.findOne({
          name: { $regex: new RegExp(`^${subCategory.trim()}$`, 'i') },
          parentCategory: mainCategoryId
        });
      }

      if (!subCat) {
        return res.status(404).json({
          message: `Sub category "${subCategory}" not found`
        });
      }

      if (!subCat.parentCategory) {
        return res.status(400).json({
          message: "Provided sub category has no parent",
        });
      }

      if (String(subCat.parentCategory) !== String(mainCategoryId)) {
        return res.status(400).json({
          message: "Sub category does not belong to the selected main category",
        });
      }

      subCategoryId = subCat._id;
    }

    // Brand validation - handle both ObjectId and name, auto-create if needed
    let brandId;

    // Check if it's a valid 24-character hex string (MongoDB ObjectId format)
    const isValidBrandObjectId = /^[0-9a-fA-F]{24}$/.test(brand);

    if (isValidBrandObjectId) {
      const brandDoc = await Brand.findById(brand);
      if (!brandDoc) {
        return res.status(404).json({ message: "Brand not found" });
      }
      brandId = brand;
    } else {
      // Look up by name or create
      let brandDoc = await Brand.findOne({
        name: { $regex: new RegExp(`^${brand.trim()}$`, 'i') }
      });

      if (!brandDoc) {
        // Auto-create the brand with default values
        brandDoc = new Brand({
          name: brand.trim(),
          category: mainCategoryId,
          image: "/uploads/default-brand.jpg"
        });
        await brandDoc.save();
        console.log(`Brand "${brand}" created automatically`);
      }

      brandId = brandDoc._id;
    }

    // Image upload handling
    let imagePath = [];
    if (req.files && req.files.length > 0) {
      imagePath = req.files.map((file) => `/uploads/${file.filename}`);
    }

    if (imagePath.length < 3) {
      return res.status(400).json({
        message: "At least 3 images are required",
      });
    }

    // Create product
    const newProduct = new Product({
      name,
      description,
      mainCategory: mainCategoryId,
      subCategory: subCategoryId,
      price,
      stock: stock || 0,
      brand: brandId,
      image: imagePath,
      expiryDate: expiryDate ? new Date(expiryDate) : undefined,
      addedById: req.user.id,
      addedByType
    });

    await newProduct.save();

    // Populate references for the response
    await newProduct.populate([
      { path: 'mainCategory', select: 'name' },
      { path: 'subCategory', select: 'name' },
      { path: 'brand', select: 'name image' }
    ]);

    res.status(201).json({
      message: "Product created successfully",
      product: newProduct,
    });

  } catch (error) {
    console.error("Create Product Error:", error);

    if (error.message.includes("Invalid Sub Category") ||
      error.message.includes("Sub Category has no parent") ||
      error.message.includes("does not belong to selected Main Category")) {
      return res.status(400).json({ message: error.message });
    }

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

      const finalMain = mainCategory || product.mainCategory;

      if (String(subCat.parentCategory) !== String(finalMain)) {
        return res.status(400).json({
          message: "Sub category does not belong to selected main category",
        });
      }

      product.subCategory = subCategory;
    }

    let imagePaths = [];

    if (req.files?.image && req.files.image.length > 0) {
      imagePaths = [`/uploads/${req.files.image[0].filename}`];
    }

    if (req.files?.images && req.files.images.length > 0) {
      imagePaths = req.files.images.map((file) => `/uploads/${file.filename}`);
    }

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

    let filter = { _id: { $in: productIds } };

    if (search && search.trim() !== "") {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
      ];
    }

    const products = await Product.find(filter)
      .populate({
        path: "brand",
        match: search
          ? { name: { $regex: search, $options: "i" } }
          : {},
      })
      .populate("mainCategory")
      .populate("subCategory");

    const filteredProducts = products.filter((p) => {
      if (!search) return true;
      if (p.brand) return true;
      if (p.name?.toLowerCase().includes(search.toLowerCase())) return true;
      return false;
    });

    res.json({ data: filteredProducts });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getProductDashboardMetrics = async (req, res) => {
  try {
    const totalProducts = await Product.countDocuments();

    const avgRatingData = await Product.aggregate([
      { $group: { _id: null, avg: { $avg: "$rating" } } }
    ]);
    const avgRating = avgRatingData[0]?.avg || 0;

    const lowStockCount = await Product.countDocuments({ stock: { $lt: 10 } });

    const inventoryValueData = await Product.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: { $multiply: ["$price", "$stock"] } }
        }
      }
    ]);
    const totalInventoryValue = inventoryValueData[0]?.total || 0;

    res.status(200).json({
      success: true,
      data: {
        totalProducts,
        avgRating: avgRating.toFixed(1),
        lowStockCount,
        totalInventoryValue,
      },
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getProductInventoryList = async (req, res) => {
  try {
    const products = await Product.find()
      .populate("mainCategory", "name")
      .populate("subCategory", "name")
      .populate("brand", "name")

    const formatted = products.map((item) => ({
      _id: item._id,
      productId: item.productId,
      name: item.name,
      image: item.image?.[0] || "",
      brand: item.brand?.name,
      mainCategory: item.mainCategory?.name,
      subCategory: item.subCategory?.name || null,
      price: item.price,
      stock: item.stock,
      status: item.status,
      margin: item.cost
        ? Math.round(((item.price - item.cost) / item.price) * 100)
        : null,
      rating: item.rating || 0,
      isLowStock: item.isLowStock,
    }));

    res.status(200).json({
      success: true,
      products: formatted,
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ============================================
// FAVORITES
// ============================================

/**
 * @route   GET /api/favorites
 * @desc    Get user's favorite products
 * @access  Private
 */
const getFavorites = async (req, res) => {
  try {
    const userId = req.user.id || req.user.clinicId;

    if (!userId) {
      return res.status(401).json({ success: false, message: "User not identified" });
    }

    const favorites = await Favourite.find({ user: userId })
      .populate({
        path: "product",
        select: "productId name basePrice image status brand mainCategory subCategory variants",
        populate: [
          { path: "brand", select: "name" },
          { path: "mainCategory", select: "name" },
          { path: "subCategory", select: "name" }
        ]
      })
      .sort({ addedAt: -1 });

    const formattedFavorites = favorites
      .filter(fav => fav.product !== null) // ✅ skip deleted products
      .map(fav => ({
        _id: fav._id,
        product: fav.product,
        variantId: fav.variantId,
        addedAt: fav.addedAt
      }));

    res.status(200).json({
      success: true,
      count: formattedFavorites.length,
      data: formattedFavorites
    });
  } catch (error) {
    console.error("Get favorites error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching favorites"
    });
  }
};

/**
 * @route   POST /api/favorites/:productId
 * @desc    Add product to favorites (toggles like/unlike)
 * @access  Private
 */
const addFavorite = async (req, res) => {
  try {
    const userId = req.user.id || req.user.clinicId; // ✅ fixed

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const { productId } = req.params;
    const { variantId } = req.body || {};

    // Check product exists
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // Check availability
    if (product.status !== "Available") {
      return res.status(400).json({
        success: false,
        message: "Product is not available",
      });
    }

    // Check if already favorited
    const existingFavorite = await Favourite.findOne({
      user: userId,
      product: productId,
    });

    // 🔁 UNLIKE
    if (existingFavorite) {
      await Favourite.deleteOne({ _id: existingFavorite._id });

      return res.status(200).json({
        success: true,
        message: "Product removed from favorites",
        liked: false,
      });
    }

    // ❤️ LIKE
    const favorite = await Favourite.create({
      user: userId,
      product: productId,
      variantId: variantId || null,
    });

    await favorite.populate({
      path: "product",
      select: "name image status",
    });

    return res.status(200).json({
      success: true,
      message: "Product added to favorites",
      liked: true,
      data: favorite,
    });
  } catch (error) {
    console.error("Toggle favorite error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while toggling favorite",
    });
  }
};

/**
 * @route   DELETE /api/favorites/id/:favoriteId
 * @desc    Remove favorite by its ID
 * @access  Private
 */
const removeFavoriteById = async (req, res) => {
  try {
    const userId = req.user.id || req.user.clinicId; // ✅ fixed

    if (!userId) {
      return res.status(401).json({ success: false, message: "User not identified" });
    }

    const { favoriteId } = req.params;

    const favorite = await Favourite.findOneAndDelete({
      _id: favoriteId,
      user: userId
    });

    if (!favorite) {
      return res.status(404).json({
        success: false,
        message: "Favorite item not found"
      });
    }

    res.json({
      success: true,
      message: "Item removed from favorites",
      data: { productId: favorite.product }
    });
  } catch (error) {
    console.error("Remove favorite by ID error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while removing from favorites"
    });
  }
};

/**
 * @route   GET /api/favorites/check/:productId
 * @desc    Check if product is in favorites
 * @access  Private
 */
const checkFavorite = async (req, res) => {
  try {
    const userId = req.user.id || req.user.clinicId; // ✅ fixed

    if (!userId) {
      return res.status(401).json({ success: false, message: "User not identified" });
    }

    const { productId } = req.params;

    const favorite = await Favourite.findOne({
      user: userId,
      product: productId
    });

    res.status(200).json({
      success: true,
      isFavorite: !!favorite,
      data: favorite ? {
        _id: favorite._id,
        variantId: favorite.variantId,
        addedAt: favorite.addedAt
      } : null
    });
  } catch (error) {
    console.error("Check favorite error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while checking favorite status"
    });
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
  getProductsByIds,
  getProductDashboardMetrics,
  getProductInventoryList,
  getFavorites,
  addFavorite,
  removeFavoriteById,
  checkFavorite
};