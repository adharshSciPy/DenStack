import Carousel from "../Model/CarouselSchema.js";
import mongoose from "mongoose";
import TopBrand from "../Model/TopBrandSchema.js";
import TopCategory from "../Model/TopCategorySchema.js";
import FeaturedCategory from "../Model/FeaturedCategorySchema.js";
import TopSellingProduct from "../Model/TopSellingProductSchema.js";
import CategorySection from "../Model/CategorySectionSchema.js";
import Order from "../Model/OrderSchema.js";
import Product from "../Model/ProductSchema.js";
import MainCategory from "../Model/MainCategorySchema.js";
import Category from "../Model/CategorySchema.js";
import Brand from "../Model/BrandSchema.js";
import SubCategory from "../Model/SubCategorySchema.js";
import FeaturedProduct from "../Model/featuredProductSchema.js";
import ClinicSetup from "../Model/ClinicSetupSchema.js";

// ============= CAROUSEL SLIDES =============
export const createCarouselSlide = async (req, res) => {
  try {
    const { title, subtitle, order } = req.body;

    let files = [];

    if (req.files) {
      if (req.files.image) {
        files = req.files.image;
      }
      if (req.files.images) {
        files = req.files.images;
      }
    }

    if (files.length === 0) {
      return res
        .status(400)
        .json({ message: "At least one image is required" });
    }

    // If multiple images, create multiple slides
    if (files.length > 1) {
      const carouselSlides = files.map((file, index) => ({
        title: `${title} - Slide ${index + 1}`,
        subtitle,
        imageUrl: `/uploads/landing/${file.filename}`, // ✅ Fixed
        order: (parseInt(order) || 0) + index,
      }));

      const savedSlides = await Carousel.insertMany(carouselSlides);

      return res.status(201).json({
        message: "Multiple carousel slides created successfully",
        count: savedSlides.length,
        data: savedSlides,
      });
    }

    // Single image
    const carousel = new Carousel({
      title,
      subtitle,
      imageUrl: `/uploads/landing/${files[0].filename}`, // ✅ Fixed
      order: order || 0,
    });

    await carousel.save();

    res.status(201).json({
      message: "Carousel slide created successfully",
      data: carousel,
    });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};
export const getAllCarouselSlides = async (req, res) => {
  try {
    const slides = await Carousel.find({ isActive: true })
      .sort({ order: 1 })
      .select("-__v");

    res.status(200).json({
      message: "Carousel slides fetched successfully",
      data: slides,
    });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};
export const updateCarouselSlide = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, subtitle, order, isActive } = req.body;

    // 🔍 Debug logging
    console.log("req.files:", req.files);
    console.log("req.body:", req.body);

    const updateData = { title, subtitle, order, isActive };

    let files = [];

    if (req.files) {
      if (req.files.image && req.files.image.length > 0) {
        files = req.files.image;
        console.log("✅ Found image field:", files);
      } else if (req.files.images && req.files.images.length > 0) {
        files = req.files.images;
        console.log("✅ Found images field:", files);
      }
    }

    if (files.length > 0) {
      updateData.imageUrl = `/uploads/landing/${files[0].filename}`;
      console.log("✅ New imageUrl:", updateData.imageUrl);
    } else {
      console.log("⚠️ No files found");
    }

    const carousel = await Carousel.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    });

    if (!carousel) {
      return res.status(404).json({ message: "Carousel slide not found" });
    }

    res.status(200).json({
      message: "Carousel slide updated successfully",
      data: carousel,
    });
  } catch (err) {
    console.error("❌ Error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};
export const deleteCarouselSlide = async (req, res) => {
  try {
    const { id } = req.params;

    const carousel = await Carousel.findByIdAndDelete(id);

    if (!carousel) {
      return res.status(404).json({ message: "Carousel slide not found" });
    }

    res.status(200).json({ message: "Carousel slide deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ============= TOP BRANDS =============
export const createBrand = async (req, res) => {
  try {
    const { name, description, mainCategoryId, subCategoryId } = req.body;

    /* ---------------- VALIDATION ---------------- */
    if (!name?.trim()) {
      return res.status(400).json({ message: "Brand name is required" });
    }
    if (!mainCategoryId) {
      return res.status(400).json({ message: "Main category is required" });
    }
    if (!subCategoryId) {
      return res.status(400).json({ message: "Sub category is required" });
    }

    /* ---------------- MAIN CATEGORY ---------------- */
    const mainCategory = await MainCategory.findOne({
      _id: mainCategoryId,
      parentCategory: null,
      isActive: true,
    });

    if (!mainCategory) {
      return res.status(404).json({
        message: "Main category not found or inactive",
      });
    }

    /* ---------------- SUB CATEGORY ---------------- */
    const subCategory = await SubCategory.findOne({
      _id: subCategoryId,
      mainCategory: mainCategoryId,
      isActive: true,
    });

    if (!subCategory) {
      return res.status(404).json({
        message:
          "Sub category not found, inactive, or doesn't belong to the main category",
      });
    }

    /* ---------------- IMAGE (uploads/landing) ---------------- */
    let imageUrl;

    if (req.files?.image?.length > 0) {
      imageUrl = `/uploads/landing/${req.files.image[0].filename}`;
    } else if (req.files?.images?.length > 0) {
      imageUrl = `/uploads/landing/${req.files.images[0].filename}`;
    }

    if (!imageUrl) {
      return res.status(400).json({ message: "Brand image is required" });
    }

    /* ---------------- CREATE BRAND ---------------- */
    const brand = await Brand.create({
      name: name.trim(),
      description: description?.trim() || "",
      mainCategory: mainCategoryId,
      subCategory: subCategoryId,
      image: imageUrl,
    });

    /* ---------------- POPULATE ---------------- */
    const populatedBrand = await Brand.findById(brand._id)
      .populate("mainCategory", "categoryName")
      .populate("subCategory", "categoryName");

    return res.status(201).json({
      message: "Brand created successfully",
      data: populatedBrand,
    });
  } catch (err) {
    console.error("Create Brand Error:", err);
    return res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
};
export const getAllBrands = async (req, res) => {
  try {
    const { includeInactive = false } = req.query;

    let filter = {};
    if (includeInactive !== 'true') {
      filter.isActive = true;
    }

    const brands = await Brand.find(filter)
      .populate('mainCategory', 'categoryName')
      .populate('subCategory', 'categoryName')
      .sort({ createdAt: -1 });

    // Fetch products for each brand
    const brandsWithProducts = await Promise.all(
      brands.map(async (brand) => {
        const products = await Product.find({
          brand: brand._id
        }).sort({ createdAt: -1 });

        return {
          ...brand.toObject(),
          products: products,
          productCount: products.length
        };
      })
    );

    res.status(200).json({
      success: true,
      message: "Brands retrieved successfully",
      count: brandsWithProducts.length,
      data: brandsWithProducts
    });
  } catch (error) {
    console.error("Get All Brands Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch brands",
      error: error.message
    });
  }
};
// Get Brand by ID
export const getBrandById = async (req, res) => {
  try {
    const { id } = req.params;

    const brand = await Brand.findById(id)
      .populate('mainCategory', 'categoryName')
      .populate('subCategory', 'categoryName');

    if (!brand) {
      return res.status(404).json({
        success: false,
        message: "Brand not found"
      });
    }

    // Fetch all products for this brand
    const products = await Product.find({
      brand: brand._id
    }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      message: "Brand retrieved successfully",
      data: {
        brand: brand,
        products: products,
        productCount: products.length
      }
    });
  } catch (error) {
    console.error("Get Brand Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch brand",
      error: error.message
    });
  }
};

// Get Brands by Main Category
export const getBrandsByMainCategory = async (req, res) => {
  try {
    const { mainCategoryId } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const brands = await Brand.find({
      mainCategory: mainCategoryId,
      isActive: true,
    })
      .populate("mainCategory", "categoryName mainCategoryId description")
      .populate("subCategory", "categoryName mainCategoryId description")
      .sort({ name: 1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Brand.countDocuments({
      mainCategory: mainCategoryId,
      isActive: true,
    });

    res.status(200).json({
      message: "Brands fetched successfully",
      data: brands,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalItems: total,
        itemsPerPage: parseInt(limit),
      },
    });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// Get Brands by Sub Category
export const getBrandsBySubCategory = async (req, res) => {
  try {
    const { subCategoryId } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const brands = await Brand.find({
      subCategory: subCategoryId,
      isActive: true,
    })
      .populate("mainCategory", "categoryName mainCategoryId description")
      .populate("subCategory", "categoryName mainCategoryId description")
      .sort({ name: 1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Brand.countDocuments({
      subCategory: subCategoryId,
      isActive: true,
    });

    res.status(200).json({
      message: "Brands fetched successfully",
      data: brands,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalItems: total,
        itemsPerPage: parseInt(limit),
      },
    });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// Update Brand
export const updateBrand = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, mainCategoryId, subCategoryId, isActive } =
      req.body;

    const query = mongoose.Types.ObjectId.isValid(id)
      ? { _id: id }
      : { brandId: id };

    const updateData = { name, description, isActive };

    // If updating categories, validate them
    if (mainCategoryId || subCategoryId) {
      const categoryToCheck =
        mainCategoryId || (await Brand.findOne(query)).mainCategory;

      // Verify main category
      const mainCategory = await MainCategory.findOne({
        _id: categoryToCheck,
        parentCategory: null,
        isActive: true,
      });

      if (!mainCategory) {
        return res
          .status(404)
          .json({ message: "Main category not found or inactive" });
      }

      if (subCategoryId) {
        // Verify sub category belongs to main category
        const subCategory = await MainCategory.findOne({
          _id: subCategoryId,
          parentCategory: categoryToCheck,
          isActive: true,
        });

        if (!subCategory) {
          return res.status(404).json({
            message:
              "Sub category not found, inactive, or doesn't belong to the main category",
          });
        }
        updateData.subCategory = subCategoryId;
      }

      if (mainCategoryId) {
        updateData.mainCategory = mainCategoryId;
      }
    }

    // Handle image upload (optional)
    if (req.files) {
      if (req.files.image && req.files.image.length > 0) {
        updateData.image = `/uploads/brands/${req.files.image[0].filename}`;
      } else if (req.files.images && req.files.images.length > 0) {
        updateData.image = `/uploads/brands/${req.files.images[0].filename}`;
      }
    }

    const brand = await Brand.findOneAndUpdate(query, updateData, {
      new: true,
      runValidators: true,
    })
      .populate("mainCategory", "categoryName mainCategoryId description")
      .populate("subCategory", "categoryName mainCategoryId description");

    if (!brand) {
      return res.status(404).json({ message: "Brand not found" });
    }

    res.status(200).json({
      message: "Brand updated successfully",
      data: brand,
    });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// Delete Brand
export const deleteBrand = async (req, res) => {
  try {
    const { id } = req.params;

    const query = mongoose.Types.ObjectId.isValid(id)
      ? { _id: id }
      : { brandId: id };

    const brand = await Brand.findOneAndDelete(query);

    if (!brand) {
      return res.status(404).json({ message: "Brand not found" });
    }

    res.status(200).json({ message: "Brand deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

export const addTopBrand = async (req, res) => {
  try {
    const { brandId, order } = req.body;

    // Validate brand exists
    const brand = await Brand.findById(brandId);
    if (!brand) {
      return res.status(404).json({
        success: false,
        message: "Brand not found"
      });
    }

    // Check if brand is already in top brands
    const existingTopBrand = await TopBrand.findOne({ brandId });
    if (existingTopBrand) {
      return res.status(400).json({
        success: false,
        message: "Brand is already in top brands"
      });
    }

    // Create top brand entry
    const topBrand = new TopBrand({
      brandId,
      order: order || 0,
    });

    await topBrand.save();

    // Populate before sending response
    await topBrand.populate({
      path: 'brandId',
      select: 'brandName description brandLogo'
    });

    res.status(201).json({
      success: true,
      message: "Brand added to top brands successfully",
      data: topBrand
    });
  } catch (error) {
    console.error("Add Top Brand Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to add top brand",
      error: error.message
    });
  }
};

// ============= ADD MULTIPLE BRANDS TO TOP BRANDS =============
export const addMultipleTopBrands = async (req, res) => {
  try {
    const { brands } = req.body; // Array of { brandId, order }

    if (!brands || !Array.isArray(brands) || brands.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Please provide an array of brands"
      });
    }

    const results = {
      success: [],
      failed: []
    };

    for (const item of brands) {
      try {
        const { brandId, order } = item;

        // Validate brand exists
        const brand = await Brand.findById(brandId);
        if (!brand) {
          results.failed.push({
            brandId,
            reason: "Brand not found"
          });
          continue;
        }

        // Check if already in top brands
        const existingTopBrand = await TopBrand.findOne({ brandId });
        if (existingTopBrand) {
          results.failed.push({
            brandId,
            reason: "Brand is already in top brands"
          });
          continue;
        }

        // Create top brand entry
        const topBrand = new TopBrand({
          brandId,
          order: order || 0
        });

        await topBrand.save();

        // Populate before adding to success list
        await topBrand.populate({
          path: 'brandId',
          select: 'brandName description brandLogo'
        });

        results.success.push(topBrand);
      } catch (error) {
        results.failed.push({
          brandId: item.brandId,
          reason: error.message
        });
      }
    }

    res.status(201).json({
      success: true,
      message: `Added ${results.success.length} brands to top brands. ${results.failed.length} failed.`,
      data: {
        added: results.success,
        failed: results.failed,
        summary: {
          total: brands.length,
          successful: results.success.length,
          failed: results.failed.length
        }
      }
    });
  } catch (error) {
    console.error("Add Multiple Top Brands Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to add top brands",
      error: error.message
    });
  }
};

// ============= GET ALL TOP BRANDS =============
export const getAllTopBrands = async (req, res) => {
  try {
    const { includeInactive = false } = req.query;

    let filter = {};
    if (includeInactive !== 'true') {
      filter.isActive = true;
    }

    const topBrands = await TopBrand.find(filter)
      .populate({
        path: 'brandId',
        select: 'name description image isActive mainCategory subCategory',
        populate: [
          { path: 'mainCategory', select: 'categoryName' },
          { path: 'subCategory', select: 'categoryName' }
        ]
      })
      .sort({ order: 1, createdAt: -1 });

    // Fetch products for each top brand
    const topBrandsWithProducts = await Promise.all(
      topBrands.map(async (topBrand) => {
        if (!topBrand.brandId) {
          return {
            ...topBrand.toObject(),
            products: [],
            productCount: 0
          };
        }

        const products = await Product.find({
          brand: topBrand.brandId._id
        }).sort({ createdAt: -1 });

        return {
          ...topBrand.toObject(),
          products: products,
          productCount: products.length
        };
      })
    );

    res.status(200).json({
      success: true,
      message: "Top brands retrieved successfully",
      count: topBrandsWithProducts.length,
      data: topBrandsWithProducts
    });
  } catch (error) {
    console.error("Get Top Brands Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch top brands",
      error: error.message
    });
  }
};


// ============= UPDATE TOP BRAND =============
export const updateTopBrand = async (req, res) => {
  try {
    const { id } = req.params;
    const { order, isActive } = req.body;

    const updateData = {};
    if (order !== undefined) updateData.order = order;
    if (isActive !== undefined) updateData.isActive = isActive;

    const topBrand = await TopBrand.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).populate({
      path: 'brandId',
      select: 'brandName description brandLogo'
    });

    if (!topBrand) {
      return res.status(404).json({
        success: false,
        message: "Top brand not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Top brand updated successfully",
      data: topBrand
    });
  } catch (error) {
    console.error("Update Top Brand Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update top brand",
      error: error.message
    });
  }
};

// ============= DELETE TOP BRAND =============
export const deleteTopBrand = async (req, res) => {
  try {
    const { id } = req.params;

    const topBrand = await TopBrand.findByIdAndDelete(id);

    if (!topBrand) {
      return res.status(404).json({
        success: false,
        message: "Top brand not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Top brand removed successfully"
    });
  } catch (error) {
    console.error("Delete Top Brand Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to remove top brand",
      error: error.message
    });
  }
};

// ============= GET SINGLE TOP BRAND =============
export const getTopBrandById = async (req, res) => {
  try {
    const { id } = req.params;

    const topBrand = await TopBrand.findById(id)
      .populate({
        path: 'brandId',
        select: 'name description image isActive mainCategory subCategory',
        populate: [
          { path: 'mainCategory', select: 'categoryName' },
          { path: 'subCategory', select: 'categoryName' }
        ]
      });

    if (!topBrand) {
      return res.status(404).json({
        success: false,
        message: "Top brand not found"
      });
    }

    if (!topBrand.brandId) {
      return res.status(404).json({
        success: false,
        message: "Associated brand not found"
      });
    }

    // Fetch all products for this brand
    const products = await Product.find({
      brand: topBrand.brandId._id
    }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      message: "Top brand retrieved successfully",
      data: {
        topBrand: topBrand,
        products: products,
        productCount: products.length
      }
    });
  } catch (error) {
    console.error("Get Top Brand Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch top brand",
      error: error.message
    });
  }
};

// ============= TOP CATEGORIES,MAIN CATEGORY,SUB CATEGORY =============

export const createMainCategory = async (req, res) => {
  try {
    const { categoryName, description, order } = req.body;

    // Handle optional image upload
    let imageUrl = null;
    if (req.files) {
      if (req.files.image && req.files.image.length > 0) {
        imageUrl = `/uploads/landing/${req.files.image[0].filename}`;
      } else if (req.files.images && req.files.images.length > 0) {
        imageUrl = `/uploads/landing/${req.files.images[0].filename}`;
      }
    }

    const category = new MainCategory({
      categoryName,
      description: description || "",
      image: imageUrl, // ✅ Added image
      parentCategory: null, // Main category has no parent
      level: 0,
      order: order || 0,
    });

    await category.save();

    res.status(201).json({
      message: "Main category created successfully",
      data: category,
    });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};
export const getAllMainCategories = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const categories = await MainCategory.find({
      isActive: true,
      parentCategory: null, // Only main categories
    })
      .sort({ order: 1, categoryName: 1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await MainCategory.countDocuments({
      isActive: true,
      parentCategory: null,
    });

    res.status(200).json({
      message: "Main categories fetched successfully",
      data: categories,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalItems: total,
        itemsPerPage: parseInt(limit),
      },
    });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};
export const getMainCategoryById = async (req, res) => {
  try {
    const { id } = req.params;

    const query = mongoose.Types.ObjectId.isValid(id)
      ? { _id: id }
      : { mainCategoryId: id };

    const category = await MainCategory.findOne({
      ...query,
      parentCategory: null,
    });

    if (!category) {
      return res.status(404).json({ message: "Main category not found" });
    }

    res.status(200).json({
      message: "Main category fetched successfully",
      data: category,
    });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};
export const updateMainCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };

    // Handle image upload if new image is provided
    if (req.files) {
      let imageUrl = null;
      if (req.files.image && req.files.image.length > 0) {
        imageUrl = `/uploads/landing/${req.files.image[0].filename}`;
      } else if (req.files.images && req.files.images.length > 0) {
        imageUrl = `/uploads/landing/${req.files.images[0].filename}`;
      }

      if (imageUrl) {
        updateData.image = imageUrl;
      }
    }

    const category = await MainCategory.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    });

    if (!category) {
      return res.status(404).json({ message: "Main category not found" });
    }

    res.status(200).json({
      message: "Main category updated successfully",
      data: category,
    });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};
export const deleteMainCategory = async (req, res) => {
  try {
    const { id } = req.params;

    const query = mongoose.Types.ObjectId.isValid(id)
      ? { _id: id }
      : { mainCategoryId: id };

    // Check if category has subcategories
    const subcategoriesCount = await MainCategory.countDocuments({
      parentCategory: id,
    });

    if (subcategoriesCount > 0) {
      return res.status(400).json({
        message:
          "Cannot delete category with subcategories. Delete subcategories first.",
      });
    }

    const category = await MainCategory.findOneAndDelete({
      ...query,
      parentCategory: null,
    });

    if (!category) {
      return res.status(404).json({ message: "Main category not found" });
    }

    res.status(200).json({ message: "Main category deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};
export const createSubCategory = async (req, res) => {
  try {
    const { categoryName, description, mainCategoryId, order } = req.body;

    if (!mainCategoryId) {
      return res.status(400).json({ message: "Main category ID is required" });
    }

    // Verify main category exists
    const mainCategory = await MainCategory.findById(mainCategoryId);
    if (!mainCategory) {
      return res.status(404).json({ message: "Main category not found" });
    }

    const subCategory = new SubCategory({
      categoryName,
      description: description || "",
      mainCategory: mainCategoryId,
      order: order || 0,
    });

    await subCategory.save();

    res.status(201).json({
      message: "Sub category created successfully",
      data: subCategory,
    });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};
// Get All Sub Categories (of a specific parent)
export const getSubCategories = async (req, res) => {
  try {
    const { mainCategoryId } = req.params; // Changed from parentId
    const { page = 1, limit = 10 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    if (!mainCategoryId) {
      return res.status(400).json({ message: "Main category ID is required" });
    }

    const categories = await MainCategory.find({
      isActive: true,
      parentCategory: mainCategoryId, // Sub categories have parentCategory = mainCategoryId
    })
      .populate("parentCategory", "categoryName mainCategoryId")
      .sort({ order: 1, categoryName: 1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await MainCategory.countDocuments({
      isActive: true,
      parentCategory: mainCategoryId,
    });

    res.status(200).json({
      message: "Sub categories fetched successfully",
      data: categories,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalItems: total,
        itemsPerPage: parseInt(limit),
      },
    });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};
// Get All Sub Categories (all)
export const getAllSubCategories = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const subCategories = await SubCategory.find({ isActive: true })
      .populate("mainCategory", "categoryName mainCategoryId description")
      .sort({ order: 1, categoryName: 1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await SubCategory.countDocuments({ isActive: true });

    res.status(200).json({
      message: "Sub categories fetched successfully",
      data: subCategories,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalItems: total,
        itemsPerPage: parseInt(limit),
      },
    });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};
export const getSubCategoriesByMainCategory = async (req, res) => {
  try {
    const { mainCategoryId } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    if (!mainCategoryId) {
      return res.status(400).json({ message: "Main category ID is required" });
    }

    const subCategories = await SubCategory.find({
      isActive: true,
      mainCategory: mainCategoryId,
    })
      .populate("mainCategory", "categoryName mainCategoryId description")
      .sort({ order: 1, categoryName: 1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await SubCategory.countDocuments({
      isActive: true,
      mainCategory: mainCategoryId,
    });

    res.status(200).json({
      message: "Sub categories fetched successfully",
      data: subCategories,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalItems: total,
        itemsPerPage: parseInt(limit),
      },
    });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};
// Get Sub Category by ID
export const getSubCategoryById = async (req, res) => {
  try {
    const { id } = req.params;

    const query = mongoose.Types.ObjectId.isValid(id)
      ? { _id: id }
      : { subCategoryId: id };

    const subCategory = await SubCategory.findOne(query).populate(
      "mainCategory",
      "categoryName mainCategoryId description",
    );

    if (!subCategory) {
      return res.status(404).json({ message: "Sub category not found" });
    }

    res.status(200).json({
      message: "Sub category fetched successfully",
      data: subCategory,
    });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// Update Sub Category
export const updateSubCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { categoryName, description, mainCategoryId, order, isActive } =
      req.body;

    const query = mongoose.Types.ObjectId.isValid(id)
      ? { _id: id }
      : { mainCategoryId: id };

    const updateData = { categoryName, description, order, isActive };

    // If changing main category
    if (mainCategoryId) {
      const mainCategory = await MainCategory.findOne({
        _id: mainCategoryId,
        parentCategory: null, // Must be a main category
        isActive: true,
      });

      if (!mainCategory) {
        return res
          .status(404)
          .json({ message: "Main category not found or inactive" });
      }

      updateData.parentCategory = mainCategoryId;
      updateData.level = 1;
    }

    const category = await MainCategory.findOneAndUpdate(
      { ...query, parentCategory: { $ne: null } }, // Must be a sub category
      updateData,
      { new: true, runValidators: true },
    ).populate("parentCategory", "categoryName mainCategoryId");

    if (!category) {
      return res.status(404).json({ message: "Sub category not found" });
    }

    res.status(200).json({
      message: "Sub category updated successfully",
      data: category,
    });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};
// Delete Sub Category
export const deleteSubCategory = async (req, res) => {
  try {
    const { id } = req.params;

    const query = mongoose.Types.ObjectId.isValid(id)
      ? { _id: id }
      : { mainCategoryId: id };

    const category = await MainCategory.findOneAndDelete({
      ...query,
      parentCategory: { $ne: null },
    });

    if (!category) {
      return res.status(404).json({ message: "Sub category not found" });
    }

    res.status(200).json({ message: "Sub category deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};
// Get Category Hierarchy (Main + Subs)
export const getMainCategoryHierarchy = async (req, res) => {
  try {
    const mainCategories = await MainCategory.find({
      isActive: true,
      parentCategory: null,
    }).sort({ order: 1, categoryName: 1 });

    const hierarchy = await Promise.all(
      mainCategories.map(async (mainCat) => {
        const subCategories = await MainCategory.find({
          isActive: true,
          parentCategory: mainCat._id,
        }).sort({ order: 1, categoryName: 1 });

        return {
          ...mainCat.toObject(),
          subCategories,
        };
      }),
    );

    res.status(200).json({
      message: "Category hierarchy fetched successfully",
      data: hierarchy,
    });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};
// ============= ADD SINGLE CATEGORY TO TOP CATEGORIES =============
// ============= ADD SINGLE CATEGORY TO TOP CATEGORIES (No Image Upload) =============
export const addTopCategory = async (req, res) => {
  try {
    const { categoryId, displayName, order, imageUrl } = req.body;

    // Validate category exists
    const category = await MainCategory.findById(categoryId);
    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found"
      });
    }

    // Check if category is already in top categories
    const existingTopCategory = await TopCategory.findOne({ categoryId });
    if (existingTopCategory) {
      return res.status(400).json({
        success: false,
        message: "Category is already in top categories"
      });
    }

    // Use provided imageUrl or category's existing image, or handle optional upload
    let finalImageUrl = imageUrl || category.image;

    // Optional: Allow image override via upload
    if (req.file) {
      finalImageUrl = `/uploads/landing/${req.file.filename}`;
    }

    if (!finalImageUrl) {
      return res.status(400).json({
        success: false,
        message: "No image available. Category must have an image or provide imageUrl"
      });
    }

    // Create top category entry
    const topCategory = new TopCategory({
      categoryId,
      displayName: displayName || category.categoryName,
      imageUrl: finalImageUrl,
      order: order || 0,
    });

    await topCategory.save();

    // Populate before sending response
    await topCategory.populate({
      path: 'categoryId',
      select: 'categoryName description image'
    });

    res.status(201).json({
      success: true,
      message: "Category added to top categories successfully",
      data: topCategory
    });
  } catch (error) {
    console.error("Add Top Category Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to add top category",
      error: error.message
    });
  }
};

// ============= ADD MULTIPLE CATEGORIES TO TOP CATEGORIES (No Image Upload) =============
export const addMultipleTopCategories = async (req, res) => {
  try {
    const { categories } = req.body; // Array of { categoryId, displayName?, order?, imageUrl? }

    if (!categories || !Array.isArray(categories) || categories.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Please provide an array of categories"
      });
    }

    const results = {
      success: [],
      failed: []
    };

    for (const item of categories) {
      try {
        const { categoryId, displayName, order, imageUrl } = item;

        // Validate category exists
        const category = await MainCategory.findById(categoryId);
        if (!category) {
          results.failed.push({
            categoryId,
            reason: "Category not found"
          });
          continue;
        }

        // Check if already in top categories
        const existingTopCategory = await TopCategory.findOne({ categoryId });
        if (existingTopCategory) {
          results.failed.push({
            categoryId,
            reason: "Category is already in top categories"
          });
          continue;
        }

        // Use provided imageUrl or category's existing image
        const finalImageUrl = imageUrl || category.image;

        if (!finalImageUrl) {
          results.failed.push({
            categoryId,
            reason: "No image available for this category"
          });
          continue;
        }

        // Create top category entry
        const topCategory = new TopCategory({
          categoryId,
          displayName: displayName || category.categoryName,
          imageUrl: finalImageUrl,
          order: order || 0
        });

        await topCategory.save();

        // Populate before adding to success list
        await topCategory.populate({
          path: 'categoryId',
          select: 'categoryName description image'
        });

        results.success.push(topCategory);
      } catch (error) {
        results.failed.push({
          categoryId: item.categoryId,
          reason: error.message
        });
      }
    }

    res.status(201).json({
      success: true,
      message: `Added ${results.success.length} categories to top categories. ${results.failed.length} failed.`,
      data: {
        added: results.success,
        failed: results.failed,
        summary: {
          total: categories.length,
          successful: results.success.length,
          failed: results.failed.length
        }
      }
    });
  } catch (error) {
    console.error("Add Multiple Top Categories Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to add top categories",
      error: error.message
    });
  }
};

// ============= GET ALL TOP CATEGORIES =============
export const getAllTopCategories = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const topCategories = await TopCategory.find({ isActive: true })
      .populate("categoryId", "categoryName description")
      .sort({ order: 1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await TopCategory.countDocuments({ isActive: true });

    res.status(200).json({
      success: true,
      message: "Top categories fetched successfully",
      data: topCategories,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalItems: total,
        itemsPerPage: parseInt(limit),
      },
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message
    });
  }
};

// ============= DELETE TOP CATEGORY =============
export const deleteTopCategory = async (req, res) => {
  try {
    const { id } = req.params;

    const topCategory = await TopCategory.findByIdAndDelete(id);

    if (!topCategory) {
      return res.status(404).json({
        success: false,
        message: "Top category not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Top category removed successfully"
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message
    });
  }
};
// ============= UPDATE TOP CATEGORY =============
export const updateTopCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { categoryId, displayName, order, isActive } = req.body;

    const updateData = {};

    if (categoryId) {
      // Validate new category exists
      const category = await Category.findById(categoryId);
      if (!category) {
        return res.status(404).json({
          success: false,
          message: "Category not found"
        });
      }
      updateData.categoryId = categoryId;
    }

    if (displayName !== undefined) updateData.displayName = displayName;
    if (order !== undefined) updateData.order = order;
    if (isActive !== undefined) updateData.isActive = isActive;

    if (req.file) {
      updateData.imageUrl = req.file.path || `/uploads/landing/${req.file.filename}`;
    }

    const topCategory = await TopCategory.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    }).populate("categoryId", "categoryName description");

    if (!topCategory) {
      return res.status(404).json({
        success: false,
        message: "Top category not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Top category updated successfully",
      data: topCategory,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message
    });
  }
};
// ============= FEATURED CATEGORIES =============
export const createFeaturedCategory = async (req, res) => {
  try {
    const {
      categoryId,
      categoryIds,
      title,
      titles,
      description,
      descriptions,
      order,
      orders,
    } = req.body;

    const files = req.files || (req.file ? [req.file] : []);

    if (files.length === 0) {
      return res
        .status(400)
        .json({ message: "At least one image is required" });
    }

    // Multiple uploads
    if (files.length > 1) {
      const categoryIdArray =
        typeof categoryIds === "string"
          ? JSON.parse(categoryIds)
          : categoryIds || [];
      const titleArray =
        typeof titles === "string" ? JSON.parse(titles) : titles || [];
      const descriptionArray =
        typeof descriptions === "string"
          ? JSON.parse(descriptions)
          : descriptions || [];
      const orderArray =
        typeof orders === "string" ? JSON.parse(orders) : orders || [];

      if (files.length !== categoryIdArray.length) {
        return res.status(400).json({
          message: "Number of images must match number of categoryIds",
        });
      }

      const featuredCategories = files.map((file, index) => ({
        categoryId: categoryIdArray[index],
        title: titleArray[index],
        description: descriptionArray?.[index] || "",
        imageUrl: file.path || `/uploads/landing/${file.filename}`,
        order: orderArray?.[index] || index,
      }));

      const savedCategories =
        await FeaturedCategory.insertMany(featuredCategories);

      return res.status(201).json({
        message: "Multiple featured categories created successfully",
        count: savedCategories.length,
        data: savedCategories,
      });
    }

    // Single upload
    const featuredCategory = new FeaturedCategory({
      categoryId,
      title,
      description,
      imageUrl: files[0].path || `/uploads/landing/${files[0].filename}`,
      order: order || 0,
    });

    await featuredCategory.save();

    res.status(201).json({
      message: "Featured category created successfully",
      data: featuredCategory,
    });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};
export const getAllFeaturedCategories = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const featuredCategories = await FeaturedCategory.find({ isActive: true })
      .populate("categoryId", "categoryName description")
      .sort({ order: 1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await FeaturedCategory.countDocuments({ isActive: true });

    res.status(200).json({
      message: "Featured categories fetched successfully",
      data: featuredCategories,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalItems: total,
        itemsPerPage: parseInt(limit),
      },
    });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};
export const deleteFeaturedCategory = async (req, res) => {
  try {
    const { id } = req.params;

    const featuredCategory = await FeaturedCategory.findByIdAndDelete(id);

    if (!featuredCategory) {
      return res.status(404).json({ message: "Featured category not found" });
    }

    res.status(200).json({ message: "Featured category deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};
// ============= TOP SELLING PRODUCTS =============
// export const getTopSellingProducts = async (req, res) => {
//     try {
//         const { page = 1, limit = 10 } = req.query;
//         const skip = (parseInt(page) - 1) * parseInt(limit);

//         const topProducts = await Order.aggregate([
//             // Only successful orders
//             {
//                 $match: {
//                     orderStatus: "DELIVERED",
//                     paymentStatus: "PAID",
//                 },
//             },

//             { $unwind: "$items" },

//             {
//                 $group: {
//                     _id: "$items.itemId",
//                     totalUnitsSold: { $sum: "$items.quantity" },
//                     totalRevenue: { $sum: "$items.totalCost" },
//                 },
//             },

//             { $sort: { totalUnitsSold: -1 } },
//             { $skip: skip },
//             { $limit: parseInt(limit) },

//             {
//                 $lookup: {
//                     from: "products",
//                     localField: "_id",
//                     foreignField: "_id",
//                     as: "product",
//                 },
//             },

//             {
//                 $unwind: { path: "$product", preserveNullAndEmptyArrays: true }
//             },

//             // Lookup category
//             {
//                 $lookup: {
//                     from: "categories",
//                     localField: "product.category",
//                     foreignField: "_id",
//                     as: "category",
//                 },
//             },

//             // Lookup brand
//             {
//                 $lookup: {
//                     from: "brands",
//                     localField: "product.brand",
//                     foreignField: "_id",
//                     as: "brand",
//                 },
//             },

//             {
//                 $project: {
//                     _id: 0,
//                     productId: "$_id",
//                     productName: "$product.productName",
//                     description: "$product.description",
//                     price: "$product.price",
//                     discountPrice: "$product.discountPrice",
//                     images: "$product.images",
//                     rating: "$product.rating",
//                     reviewCount: "$product.reviewCount",
//                     category: { $arrayElemAt: ["$category.categoryName", 0] },
//                     brand: { $arrayElemAt: ["$brand.brandName", 0] },
//                     totalUnitsSold: 1,
//                     totalRevenue: 1,
//                 },
//             },
//         ]);

//         // Get total count for pagination
//         const totalCount = await Order.aggregate([
//             {
//                 $match: {
//                     orderStatus: "DELIVERED",
//                     paymentStatus: "PAID",
//                 },
//             },
//             { $unwind: "$items" },
//             {
//                 $group: {
//                     _id: "$items.itemId",
//                 },
//             },
//             { $count: "total" }
//         ]);

//         const total = totalCount.length > 0 ? totalCount[0].total : 0;

//         res.status(200).json({
//             success: true,
//             message: "Top selling products fetched successfully",
//             count: topProducts.length,
//             data: topProducts,
//             pagination: {
//                 currentPage: parseInt(page),
//                 totalPages: Math.ceil(total / parseInt(limit)),
//                 totalItems: total,
//                 itemsPerPage: parseInt(limit)
//             }
//         });
//     } catch (error) {
//         console.error("Top Selling Products Error:", error);
//         res.status(500).json({
//             success: false,
//             message: "Failed to fetch top selling products",
//             error: error.message
//         });
//     }
// };
// // Get top selling products without pagination (for landing page display)
// export const getTopSellingProductsForLanding = async (req, res) => {
//     try {
//         const limit = parseInt(req.query.limit) || 12;

//         const topProducts = await Order.aggregate([
//             {
//                 $match: {
//                     orderStatus: "DELIVERED",
//                     paymentStatus: "PAID",
//                 },
//             },

//             { $unwind: "$items" },

//             {
//                 $group: {
//                     _id: "$items.itemId",
//                     totalUnitsSold: { $sum: "$items.quantity" },
//                     totalRevenue: { $sum: "$items.totalCost" },
//                 },
//             },

//             { $sort: { totalUnitsSold: -1 } },
//             { $limit: limit },

//             {
//                 $lookup: {
//                     from: "products",
//                     localField: "_id",
//                     foreignField: "_id",
//                     as: "product",
//                 },
//             },

//             {
//                 $unwind: { path: "$product", preserveNullAndEmptyArrays: true }
//             },

//             {
//                 $lookup: {
//                     from: "categories",
//                     localField: "product.category",
//                     foreignField: "_id",
//                     as: "category",
//                 },
//             },

//             {
//                 $lookup: {
//                     from: "brands",
//                     localField: "product.brand",
//                     foreignField: "_id",
//                     as: "brand",
//                 },
//             },

//             {
//                 $project: {
//                     _id: 0,
//                     productId: "$_id",
//                     productName: "$product.productName",
//                     description: "$product.description",
//                     price: "$product.price",
//                     discountPrice: "$product.discountPrice",
//                     images: "$product.images",
//                     rating: "$product.rating",
//                     reviewCount: "$product.reviewCount",
//                     stock: "$product.stock",
//                     category: { $arrayElemAt: ["$category.categoryName", 0] },
//                     brand: { $arrayElemAt: ["$brand.brandName", 0] },
//                     totalUnitsSold: 1,
//                     totalRevenue: 1,
//                 },
//             },
//         ]);

//         res.status(200).json({
//             success: true,
//             message: "Top selling products fetched successfully",
//             count: topProducts.length,
//             data: topProducts,
//         });
//     } catch (error) {
//         console.error("Top Selling Products Error:", error);
//         res.status(500).json({
//             success: false,
//             message: "Failed to fetch top selling products",
//             error: error.message
//         });
//     }
// };
// ============= UPDATE TOP CATEGORY =============
// ============= UPDATE FEATURED CATEGORY =============
export const updateFeaturedCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { categoryId, title, description, order, isActive } = req.body;

    const updateData = { categoryId, title, description, order, isActive };

    if (req.file) {
      updateData.imageUrl = req.file.path || `/uploads/${req.file.filename}`;
    }

    const featuredCategory = await FeaturedCategory.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true },
    ).populate("categoryId", "categoryName description");

    if (!featuredCategory) {
      return res.status(404).json({ message: "Featured category not found" });
    }

    res.status(200).json({
      message: "Featured category updated successfully",
      data: featuredCategory,
    });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};
export const updateTopSellingProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const { productId, salesCount, order, isActive } = req.body;

    const updateData = { productId, salesCount, order, isActive };

    const topSelling = await TopSellingProduct.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true },
    ).populate({
      path: "productId",
      select:
        "productName description price discountPrice images rating reviewCount",
      populate: [
        { path: "category", select: "categoryName" },
        { path: "brand", select: "brandName" },
      ],
    });

    if (!topSelling) {
      return res.status(404).json({ message: "Top selling product not found" });
    }

    res.status(200).json({
      message: "Top selling product updated successfully",
      data: topSelling,
    });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};
export const createCategorySection = async (req, res) => {
  try {
    const { sectionTitle, products, displayType, order, productsLimit } =
      req.body;

    const categorySection = new CategorySection({
      sectionTitle,
      products: products || [],
      displayType: displayType || "grid",
      order: order || 0,
      productsLimit: productsLimit || 12,
      // categorySectionId will be auto-generated by pre-save hook
    });

    await categorySection.save();

    res.status(201).json({
      message: "Category section created successfully",
      data: categorySection, // Includes both _id and categorySectionId
    });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};
export const getAllCategorySections = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const sections = await CategorySection.find({ isActive: true })
      .populate({
        path: "products",
        select:
          "productName description price discountPrice images rating reviewCount stock",
        populate: [
          { path: "category", select: "categoryName" },
          { path: "brand", select: "brandName" },
        ],
      })
      .sort({ order: 1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await CategorySection.countDocuments({ isActive: true });

    res.status(200).json({
      message: "Category sections fetched successfully",
      data: sections,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalItems: total,
        itemsPerPage: parseInt(limit),
      },
    });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};
export const getCategorySectionById = async (req, res) => {
  try {
    const { id } = req.params;

    const query = mongoose.Types.ObjectId.isValid(id)
      ? { _id: id }
      : { categorySectionId: id };

    const section = await CategorySection.findOne(query).populate({
      path: "products",
      select:
        "productName description price discountPrice images rating reviewCount stock",
      populate: [
        { path: "category", select: "categoryName" },
        { path: "brand", select: "brandName" },
      ],
    });

    if (!section) {
      return res.status(404).json({ message: "Category section not found" });
    }

    res.status(200).json({
      message: "Category section fetched successfully",
      data: section,
    });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};
export const updateCategorySection = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      sectionTitle,
      products,
      displayType,
      order,
      productsLimit,
      isActive,
    } = req.body;

    const query = mongoose.Types.ObjectId.isValid(id)
      ? { _id: id }
      : { categorySectionId: id };

    const updateData = {
      sectionTitle,
      products,
      displayType,
      order,
      productsLimit,
      isActive,
    };

    const section = await CategorySection.findOneAndUpdate(query, updateData, {
      new: true,
      runValidators: true,
    }).populate({
      path: "products",
      select:
        "productName description price discountPrice images rating reviewCount stock",
      populate: [
        { path: "category", select: "categoryName" },
        { path: "brand", select: "brandName" },
      ],
    });

    if (!section) {
      return res.status(404).json({ message: "Category section not found" });
    }

    res.status(200).json({
      message: "Category section updated successfully",
      data: section,
    });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ============= ADD PRODUCT WITH VARIANTS =============
export const addProduct = async (req, res) => {
  try {
    let {
      // Basic Info
      name,
      description,

      // Hierarchy (Required)
      mainCategoryId,
      subCategoryId,
      brandId,

      // ✅ Base Price (manually set by admin)
      basePrice,

      // Variants (Array of objects with size, color, material, pricing)
      variants, // [{ size, color, material, originalPrice, clinicDiscountPrice, doctorDiscountPrice, stock }]

      // Stock (if single variant)
      stock,
      expiryDate,

      // ✅ MAIN PRODUCT PRICING (always provided)
      originalPrice,
      clinicDiscountPrice,
      doctorDiscountPrice,

      // Optional: if you want to add existing product by ID
      productId,
    } = req.body;

    // Parse variants if it's a JSON string (from form data)
    if (typeof variants === "string") {
      try {
        variants = JSON.parse(variants);
      } catch (err) {
        return res.status(400).json({
          message: "Invalid variants format. Must be valid JSON array",
        });
      }
    }

    let finalProduct;

    // OPTION 1: Adding existing product by ID
    if (productId) {
      const existingProduct = await Product.findById(productId)
        .populate("mainCategory", "categoryName mainCategoryId")
        .populate("subCategory", "categoryName subCategoryId")
        .populate("brand", "name brandId");

      if (!existingProduct) {
        return res.status(404).json({ message: "Product not found" });
      }

      finalProduct = existingProduct;
    }
    // OPTION 2: Creating new product
    else {
      // Validate required fields
      if (!name || !mainCategoryId || !subCategoryId || !brandId || !basePrice || !originalPrice) {
        return res.status(400).json({
          message:
            "Required fields: name, mainCategoryId, subCategoryId, brandId, basePrice, originalPrice",
        });
      }

      // Step 1: Verify main category exists
      const mainCategory = await MainCategory.findOne({
        _id: mainCategoryId,
        parentCategory: null,
        isActive: true,
      });
      if (!mainCategory) {
        return res
          .status(404)
          .json({ message: "Main category not found or inactive" });
      }

      // Step 2: Verify sub category exists and belongs to main category
      const subCategory = await SubCategory.findOne({
        _id: subCategoryId,
        mainCategory: mainCategoryId,
        isActive: true,
      });
      if (!subCategory) {
        return res.status(404).json({
          message:
            "Sub category not found, inactive, or doesn't belong to the main category",
        });
      }

      // Step 3: Verify brand exists and belongs to main category and sub category
      const brand = await Brand.findOne({
        _id: brandId,
        mainCategory: mainCategoryId,
        subCategory: subCategoryId,
        isActive: true,
      });
      if (!brand) {
        return res.status(404).json({
          message:
            "Brand not found, inactive, or doesn't belong to the specified categories",
        });
      }

      // Handle image upload
      let imageUrls = [];
      if (req.files) {
        if (req.files.image && req.files.image.length > 0) {
          imageUrls = req.files.image.map(
            (file) => `/uploads/landing/${file.filename}`,
          );
        } else if (req.files.images && req.files.images.length > 0) {
          imageUrls = req.files.images.map(
            (file) => `/uploads/landing/${file.filename}`,
          );
        }
      }

      if (imageUrls.length === 0) {
        return res
          .status(400)
          .json({ message: "At least one product image is required" });
      }

      // ✅ Calculate MAIN PRODUCT pricing
      const original = parseFloat(originalPrice);
      const clinicDiscount = clinicDiscountPrice ? parseFloat(clinicDiscountPrice) : null;
      const doctorDiscount = doctorDiscountPrice ? parseFloat(doctorDiscountPrice) : null;

      const clinicDiscountPercentage = clinicDiscount
        ? (((original - clinicDiscount) / original) * 100).toFixed(2)
        : null;
      const doctorDiscountPercentage = doctorDiscount
        ? (((original - doctorDiscount) / original) * 100).toFixed(2)
        : null;

      // ✅ Store main product pricing
      const mainProductPricing = {
        originalPrice: original,
        clinicDiscountPrice: clinicDiscount,
        doctorDiscountPrice: doctorDiscount,
        clinicDiscountPercentage: clinicDiscountPercentage
          ? parseFloat(clinicDiscountPercentage)
          : null,
        doctorDiscountPercentage: doctorDiscountPercentage
          ? parseFloat(doctorDiscountPercentage)
          : null,
        stock: stock ? parseInt(stock) : 0,
      };

      // ✅ Process variants (if provided)
      let processedVariants = [];

      if (variants && Array.isArray(variants) && variants.length > 0) {
        processedVariants = variants.map((variant) => {
          const variantOriginal = parseFloat(variant.originalPrice);
          const variantClinicDiscount = variant.clinicDiscountPrice
            ? parseFloat(variant.clinicDiscountPrice)
            : null;
          const variantDoctorDiscount = variant.doctorDiscountPrice
            ? parseFloat(variant.doctorDiscountPrice)
            : null;

          // Calculate discount percentages
          const variantClinicDiscountPercentage = variantClinicDiscount
            ? (((variantOriginal - variantClinicDiscount) / variantOriginal) * 100).toFixed(2)
            : null;
          const variantDoctorDiscountPercentage = variantDoctorDiscount
            ? (((variantOriginal - variantDoctorDiscount) / variantOriginal) * 100).toFixed(2)
            : null;

          return {
            size: variant.size || null,
            color: variant.color || null,
            material: variant.material || null,
            originalPrice: variantOriginal,
            clinicDiscountPrice: variantClinicDiscount,
            doctorDiscountPrice: variantDoctorDiscount,
            clinicDiscountPercentage: variantClinicDiscountPercentage
              ? parseFloat(variantClinicDiscountPercentage)
              : null,
            doctorDiscountPercentage: variantDoctorDiscountPercentage
              ? parseFloat(variantDoctorDiscountPercentage)
              : null,
            stock: variant.stock ? parseInt(variant.stock) : 0,
          };
        });
      }

      // Create new product with BOTH main pricing AND variants
      const newProduct = new Product({
        name,
        description: description || "",
        mainCategory: mainCategoryId,
        subCategory: subCategoryId,
        brand: brandId,
        basePrice: parseFloat(basePrice),
        
        // ✅ Main product pricing
        originalPrice: mainProductPricing.originalPrice,
        clinicDiscountPrice: mainProductPricing.clinicDiscountPrice,
        doctorDiscountPrice: mainProductPricing.doctorDiscountPrice,
        clinicDiscountPercentage: mainProductPricing.clinicDiscountPercentage,
        doctorDiscountPercentage: mainProductPricing.doctorDiscountPercentage,
        stock: mainProductPricing.stock,
        
        // ✅ Variants (can be empty array)
        variants: processedVariants,
        
        image: imageUrls,
        expiryDate: expiryDate || null,
      });

      await newProduct.save();

      // Populate before sending response
      await newProduct.populate([
        { path: "mainCategory", select: "categoryName mainCategoryId" },
        { path: "subCategory", select: "categoryName subCategoryId" },
        { path: "brand", select: "name brandId" },
      ]);

      finalProduct = newProduct;
    }

    res.status(201).json({
      message: productId
        ? "Product retrieved successfully"
        : "Product created successfully",
      data: finalProduct,
    });
  } catch (err) {
    console.error("Add Product Error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ============= GET PRODUCTS BY FILTERS =============
export const getProductsByFilters = async (req, res) => {
  try {
    const {
      mainCategoryId,
      subCategoryId,
      brandId,
      minPrice,
      maxPrice,
      size,
      color,
      material,
    } = req.query;

    let filter = {};

    if (mainCategoryId) {
      filter.mainCategory = mainCategoryId;
    }

    if (subCategoryId) {
      filter.subCategory = subCategoryId;
    }

    if (brandId) {
      filter.brand = brandId;
    }

    // Filter by variant properties
    if (size) {
      filter["variants.size"] = size;
    }

    if (color) {
      filter["variants.color"] = color;
    }

    if (material) {
      filter["variants.material"] = material;
    }

    // Price range filter
    if (minPrice || maxPrice) {
      filter["variants.originalPrice"] = {};
      if (minPrice)
        filter["variants.originalPrice"].$gte = parseFloat(minPrice);
      if (maxPrice)
        filter["variants.originalPrice"].$lte = parseFloat(maxPrice);
    }

    const products = await Product.find(filter)
      .populate("mainCategory", "categoryName mainCategoryId")
      .populate("subCategory", "categoryName subCategoryId")
      .populate("brand", "name brandId")
      .sort({ createdAt: -1 });

    res.status(200).json({
      message: "Products retrieved successfully",
      count: products.length,
      data: products,
    });
  } catch (err) {
    console.error("Get Products Error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ============= GET PRODUCTS BY MAIN CATEGORY =============
export const getProductsByMainCategory = async (req, res) => {
  try {
    const { mainCategoryId } = req.params;

    const products = await Product.find({ mainCategory: mainCategoryId })
      .populate("mainCategory", "categoryName mainCategoryId")
      .populate("subCategory", "categoryName subCategoryId")
      .populate("brand", "name brandId")
      .sort({ createdAt: -1 });

    res.status(200).json({
      message: "Products retrieved successfully",
      count: products.length,
      data: products,
    });
  } catch (err) {
    console.error("Get Products Error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ============= GET PRODUCTS BY SUB CATEGORY =============
export const getProductsBySubCategory = async (req, res) => {
  try {
    const { subCategoryId } = req.params;

    const products = await Product.find({ subCategory: subCategoryId })
      .populate("mainCategory", "categoryName mainCategoryId")
      .populate("subCategory", "categoryName subCategoryId")
      .populate("brand", "name brandId")
      .sort({ createdAt: -1 });

    res.status(200).json({
      message: "Products retrieved successfully",
      count: products.length,
      data: products,
    });
  } catch (err) {
    console.error("Get Products Error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ============= GET PRODUCTS BY BRAND =============
export const getProductsByBrand = async (req, res) => {
  try {
    const { brandId } = req.params;

    const products = await Product.find({ brand: brandId })
      .populate("mainCategory", "categoryName mainCategoryId")
      .populate("subCategory", "categoryName subCategoryId")
      .populate("brand", "name brandId")
      .sort({ createdAt: -1 });

    res.status(200).json({
      message: "Products retrieved successfully",
      count: products.length,
      data: products,
    });
  } catch (err) {
    console.error("Get Products Error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ============= UPDATE PRODUCT =============
export const updateProduct = async (req, res) => {
  try {
    const { productId } = req.params;
    const updateData = { ...req.body };

    // Handle image upload if new images are provided
    if (req.files) {
      let imageUrls = [];
      if (req.files.image && req.files.image.length > 0) {
        imageUrls = req.files.image.map(
          (file) => `/uploads/landing/${file.filename}`,
        );
      } else if (req.files.images && req.files.images.length > 0) {
        imageUrls = req.files.images.map(
          (file) => `/uploads/landing/${file.filename}`,
        );
      }

      if (imageUrls.length > 0) {
        updateData.image = imageUrls;
      }
    }

    // Process variants if provided
    if (updateData.variants && Array.isArray(updateData.variants)) {
      updateData.variants = updateData.variants.map((variant) => {
        const original = parseFloat(variant.originalPrice);
        const clinicDiscount = variant.clinicDiscountPrice
          ? parseFloat(variant.clinicDiscountPrice)
          : null;
        const doctorDiscount = variant.doctorDiscountPrice
          ? parseFloat(variant.doctorDiscountPrice)
          : null;

        const clinicDiscountPercentage = clinicDiscount
          ? (((original - clinicDiscount) / original) * 100).toFixed(2)
          : null;
        const doctorDiscountPercentage = doctorDiscount
          ? (((original - doctorDiscount) / original) * 100).toFixed(2)
          : null;

        return {
          ...variant,
          originalPrice: original,
          clinicDiscountPrice: clinicDiscount,
          doctorDiscountPrice: doctorDiscount,
          clinicDiscountPercentage: clinicDiscountPercentage
            ? parseFloat(clinicDiscountPercentage)
            : null,
          doctorDiscountPercentage: doctorDiscountPercentage
            ? parseFloat(doctorDiscountPercentage)
            : null,
          stock: variant.stock ? parseInt(variant.stock) : 0,
        };
      });
    }

    const product = await Product.findByIdAndUpdate(productId, updateData, {
      new: true,
      runValidators: true,
    })
      .populate("mainCategory", "categoryName mainCategoryId")
      .populate("subCategory", "categoryName subCategoryId")
      .populate("brand", "name brandId");

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    res.status(200).json({
      message: "Product updated successfully",
      data: product,
    });
  } catch (err) {
    console.error("Update Product Error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};
// ============= DELETE PRODUCT =============
export const deleteProduct = async (req, res) => {
  try {
    const { productId } = req.params;

    const product = await Product.findByIdAndDelete(productId);

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    res.status(200).json({
      message: "Product deleted successfully",
      data: product,
    });
  } catch (err) {
    console.error("Delete Product Error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ============= GET TOP SELLING PRODUCTS =============
export const getTopSellingProducts = async (req, res) => {
  try {
    const { limit = 10, mainCategoryId, subCategoryId, brandId } = req.query;

    // Build match conditions
    let matchConditions = {};
    if (mainCategoryId) matchConditions.mainCategory = new mongoose.Types.ObjectId(mainCategoryId);
    if (subCategoryId) matchConditions.subCategory = new mongoose.Types.ObjectId(subCategoryId);
    if (brandId) matchConditions.brand = new mongoose.Types.ObjectId(brandId);

    // Aggregate pipeline to get top selling products
    const topProducts = await Product.aggregate([
      // Match filters if provided
      ...(Object.keys(matchConditions).length > 0 ? [{ $match: matchConditions }] : []),

      // Lookup orders to get sales data
      {
        $lookup: {
          from: "ecomorders", // IMPORTANT: Change this to your actual collection name
          localField: "_id",
          foreignField: "items.product",
          as: "orderData"
        }
      },

      // Unwind order data
      { $unwind: { path: "$orderData", preserveNullAndEmptyArrays: true } },

      // Unwind order items to get individual product quantities
      { $unwind: { path: "$orderData.items", preserveNullAndEmptyArrays: true } },

      // Match only items that belong to this product
      {
        $match: {
          $expr: { $eq: ["$_id", "$orderData.items.product"] }
        }
      },

      // Group by product and calculate total quantity sold
      {
        $group: {
          _id: "$_id",
          product: { $first: "$$ROOT" }, // Fixed: Double dollar sign
          totalQuantitySold: { $sum: "$orderData.items.quantity" },
          totalRevenue: {
            $sum: {
              $multiply: ["$orderData.items.quantity", "$orderData.items.price"]
            }
          },
          totalOrders: { $sum: 1 }
        }
      },

      // Sort by total quantity sold (descending)
      { $sort: { totalQuantitySold: -1 } },

      // Limit results
      { $limit: parseInt(limit) },

      // Lookup populated data
      {
        $lookup: {
          from: "maincategories",
          localField: "product.mainCategory",
          foreignField: "_id",
          as: "mainCategoryData"
        }
      },
      {
        $lookup: {
          from: "subcategories",
          localField: "product.subCategory",
          foreignField: "_id",
          as: "subCategoryData"
        }
      },
      {
        $lookup: {
          from: "brands",
          localField: "product.brand",
          foreignField: "_id",
          as: "brandData"
        }
      },

      // Project final structure
      {
        $project: {
          _id: 1,
          productId: "$product.productId",
          name: "$product.name",
          description: "$product.description",
          variants: "$product.variants",
          image: "$product.image",
          status: "$product.status",
          mainCategory: { $arrayElemAt: ["$mainCategoryData", 0] },
          subCategory: { $arrayElemAt: ["$subCategoryData", 0] },
          brand: { $arrayElemAt: ["$brandData", 0] },
          totalQuantitySold: 1,
          totalRevenue: 1,
          totalOrders: 1,
          createdAt: "$product.createdAt",
          updatedAt: "$product.updatedAt"
        }
      }
    ]);

    res.status(200).json({
      message: "Top selling products retrieved successfully",
      count: topProducts.length,
      data: topProducts
    });
  } catch (err) {
    console.error("Get Top Selling Products Error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ============= GET TOP SELLING PRODUCTS (SIMPLE VERSION - without orders) =============
export const getTopSellingProductsSimple = async (req, res) => {
  try {
    const { limit = 10, mainCategoryId, subCategoryId, brandId } = req.query;

    // Build filter
    let filter = {};
    if (mainCategoryId) filter.mainCategory = mainCategoryId;
    if (subCategoryId) filter.subCategory = subCategoryId;
    if (brandId) filter.brand = brandId;

    // For now, sort by stock sold (you can add a 'soldCount' field to track this)
    // Or sort by createdAt (newest first) as placeholder
    const products = await Product.find(filter)
      .populate("mainCategory", "categoryName mainCategoryId")
      .populate("subCategory", "categoryName subCategoryId")
      .populate("brand", "name brandId")
      .sort({ createdAt: -1 }) // Change this to { soldCount: -1 } if you add that field
      .limit(parseInt(limit));

    res.status(200).json({
      message: "Top products retrieved successfully",
      count: products.length,
      data: products,
    });
  } catch (err) {
    console.error("Get Top Products Error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};
// ============= ADD PRODUCT TO FEATURED =============
export const addFeaturedProduct = async (req, res) => {
  try {
    const {
      productId,
      title,
      description,
      badge,
      order,
      startDate,
      endDate
    } = req.body;

    // Validate product exists
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found"
      });
    }

    // Check if product is already featured
    const existingFeatured = await FeaturedProduct.findOne({ product: productId });
    if (existingFeatured) {
      return res.status(400).json({
        success: false,
        message: "Product is already featured"
      });
    }

    // Create featured product
    const featuredProduct = new FeaturedProduct({
      product: productId,
      title: title || product.name,
      description: description || product.description,
      badge: badge || null,
      order: order || 0,
      startDate: startDate || Date.now(),
      endDate: endDate || null
    });

    await featuredProduct.save();

    // Populate before sending response - ✅ Added all pricing fields
    await featuredProduct.populate({
      path: 'product',
      select: 'name description image variants brand mainCategory subCategory originalPrice clinicDiscountPrice doctorDiscountPrice clinicDiscountPercentage doctorDiscountPercentage stock',
      populate: [
        { path: 'brand', select: 'name' },
        { path: 'mainCategory', select: 'categoryName' },
        { path: 'subCategory', select: 'categoryName' }
      ]
    });

    res.status(201).json({
      success: true,
      message: "Product added to featured successfully",
      data: featuredProduct
    });
  } catch (error) {
    console.error("Add Featured Product Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to add featured product",
      error: error.message
    });
  }
};

// ============= ADD MULTIPLE PRODUCTS TO FEATURED =============
export const addMultipleFeaturedProducts = async (req, res) => {
  try {
    const { products } = req.body; // Array of product objects

    if (!products || !Array.isArray(products) || products.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Please provide an array of products"
      });
    }

    const results = {
      success: [],
      failed: []
    };

    for (const item of products) {
      try {
        const { productId, title, description, badge, order, startDate, endDate } = item;

        // Validate product exists
        const product = await Product.findById(productId);
        if (!product) {
          results.failed.push({
            productId,
            reason: "Product not found"
          });
          continue;
        }

        // Check if product is already featured
        const existingFeatured = await FeaturedProduct.findOne({ product: productId });
        if (existingFeatured) {
          results.failed.push({
            productId,
            reason: "Product is already featured"
          });
          continue;
        }

        // Create featured product
        const featuredProduct = new FeaturedProduct({
          product: productId,
          title: title || product.name,
          description: description || product.description,
          badge: badge || null,
          order: order || 0,
          startDate: startDate || Date.now(),
          endDate: endDate || null
        });

        await featuredProduct.save();

        // Populate before adding to success list
        await featuredProduct.populate({
          path: 'product',
          select: 'name description image variants brand mainCategory subCategory',
          populate: [
            { path: 'brand', select: 'name' },
            { path: 'mainCategory', select: 'categoryName' },
            { path: 'subCategory', select: 'categoryName' }
          ]
        });

        results.success.push(featuredProduct);
      } catch (error) {
        results.failed.push({
          productId: item.productId,
          reason: error.message
        });
      }
    }

    res.status(201).json({
      success: true,
      message: `Added ${results.success.length} products to featured. ${results.failed.length} failed.`,
      data: {
        added: results.success,
        failed: results.failed,
        summary: {
          total: products.length,
          successful: results.success.length,
          failed: results.failed.length
        }
      }
    });
  } catch (error) {
    console.error("Add Multiple Featured Products Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to add featured products",
      error: error.message
    });
  }
};

// ============= GET ALL FEATURED PRODUCTS =============
export const getAllFeaturedProducts = async (req, res) => {
  try {
    const { includeInactive = false } = req.query;

    let filter = {};
    if (includeInactive !== 'true') {
      filter.isActive = true;
      // Also filter by date
      filter.$or = [
        { endDate: null },
        { endDate: { $gte: new Date() } }
      ];
    }

    const featuredProducts = await FeaturedProduct.find(filter)
      .populate({
        path: 'product',
        select: 'name description image variants brand mainCategory subCategory status',
        populate: [
          { path: 'brand', select: 'name brandId' },
          { path: 'mainCategory', select: 'categoryName mainCategoryId' },
          { path: 'subCategory', select: 'categoryName subCategoryId' }
        ]
      })
      .sort({ order: 1, createdAt: -1 });

    res.status(200).json({
      success: true,
      message: "Featured products retrieved successfully",
      count: featuredProducts.length,
      data: featuredProducts
    });
  } catch (error) {
    console.error("Get Featured Products Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch featured products",
      error: error.message
    });
  }
};

// ============= GET FEATURED PRODUCT BY ID =============
export const getFeaturedProductById = async (req, res) => {
  try {
    const { id } = req.params;

    const featuredProduct = await FeaturedProduct.findById(id)
      .populate({
        path: 'product',
        select: 'name description image variants brand mainCategory subCategory',
        populate: [
          { path: 'brand', select: 'name' },
          { path: 'mainCategory', select: 'categoryName' },
          { path: 'subCategory', select: 'categoryName' }
        ]
      });

    if (!featuredProduct) {
      return res.status(404).json({
        success: false,
        message: "Featured product not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Featured product retrieved successfully",
      data: featuredProduct
    });
  } catch (error) {
    console.error("Get Featured Product Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch featured product",
      error: error.message
    });
  }
};

// ============= UPDATE FEATURED PRODUCT =============
export const updateFeaturedProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, badge, order, isActive, startDate, endDate } = req.body;

    const updateData = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (badge !== undefined) updateData.badge = badge;
    if (order !== undefined) updateData.order = order;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (startDate !== undefined) updateData.startDate = startDate;
    if (endDate !== undefined) updateData.endDate = endDate;

    const featuredProduct = await FeaturedProduct.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).populate({
      path: 'product',
      select: 'name description image variants brand mainCategory subCategory',
      populate: [
        { path: 'brand', select: 'name' },
        { path: 'mainCategory', select: 'categoryName' },
        { path: 'subCategory', select: 'categoryName' }
      ]
    });

    if (!featuredProduct) {
      return res.status(404).json({
        success: false,
        message: "Featured product not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Featured product updated successfully",
      data: featuredProduct
    });
  } catch (error) {
    console.error("Update Featured Product Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update featured product",
      error: error.message
    });
  }
};

// ============= DELETE FEATURED PRODUCT =============
export const deleteFeaturedProduct = async (req, res) => {
  try {
    const { id } = req.params;

    const featuredProduct = await FeaturedProduct.findByIdAndDelete(id);

    if (!featuredProduct) {
      return res.status(404).json({
        success: false,
        message: "Featured product not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Featured product deleted successfully",
      data: featuredProduct
    });
  } catch (error) {
    console.error("Delete Featured Product Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete featured product",
      error: error.message
    });
  }
};

// ============= TOGGLE FEATURED PRODUCT STATUS =============
export const toggleFeaturedProductStatus = async (req, res) => {
  try {
    const { id } = req.params;

    const featuredProduct = await FeaturedProduct.findById(id);

    if (!featuredProduct) {
      return res.status(404).json({
        success: false,
        message: "Featured product not found"
      });
    }

    featuredProduct.isActive = !featuredProduct.isActive;
    await featuredProduct.save();

    await featuredProduct.populate({
      path: 'product',
      select: 'name description image'
    });

    res.status(200).json({
      success: true,
      message: `Featured product ${featuredProduct.isActive ? 'activated' : 'deactivated'} successfully`,
      data: featuredProduct
    });
  } catch (error) {
    console.error("Toggle Featured Product Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to toggle featured product status",
      error: error.message
    });
  }
};

// ============= GET ACTIVE FEATURED PRODUCTS (FOR LANDING PAGE) =============
export const getActiveFeaturedProducts = async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    const now = new Date();

    const featuredProducts = await FeaturedProduct.find({
      isActive: true,
      $or: [
        { endDate: null },
        { endDate: { $gte: now } }
      ]
    })
      .populate({
        path: 'product',
        match: { status: 'Available' }, // Only show available products
        select: 'name description image variants brand mainCategory subCategory',
        populate: [
          { path: 'brand', select: 'name' },
          { path: 'mainCategory', select: 'categoryName' },
          { path: 'subCategory', select: 'categoryName' }
        ]
      })
      .sort({ order: 1, createdAt: -1 })
      .limit(parseInt(limit));

    // Filter out featured products where the product is null (out of stock or deleted)
    const validFeaturedProducts = featuredProducts.filter(fp => fp.product !== null);

    res.status(200).json({
      success: true,
      message: "Active featured products retrieved successfully",
      count: validFeaturedProducts.length,
      data: validFeaturedProducts
    });
  } catch (error) {
    console.error("Get Active Featured Products Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch active featured products",
      error: error.message
    });
  }
};

export const createClinicSetup = async (req, res) => {
  try {
    const { name, contact, email, city, address, specialization } = req.body;

    const newClinicSetup = new ClinicSetup({
      name,
      contact,
      email,
      city,
      address,
      specialization
    });
    await newClinicSetup.save();

    res.status(200).json({
      message: "Clinic setup created successfully",
      data: newClinicSetup
    });
  } catch (error) {
    console.error("Create Clinic Setup Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create clinic setup",
      error: error.message
    });
  }

}

export const getClinicSetup = async (req, res) => {
  try {
    const clinicSetups = await ClinicSetup.find();
    res.status(200).json({
      message: "Clinic setups retrieved successfully",
      data: clinicSetups
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch clinic setups",
      error: error.message
    });
  }
}