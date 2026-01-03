import Carousel from "../Model/CarouselSchema.js";
import TopBrand from "../Model/TopBrandSchema.js";
import TopCategory from "../Model/TopCategorySchema.js";
import FeaturedCategory from "../Model/FeaturedCategorySchema.js";
import TopSellingProduct from "../Model/TopSellingProductSchema.js";
import CategorySection from "../Model/CategorySectionSchema.js";

// ============= CAROUSEL SLIDES =============
export const createCarouselSlide = async (req, res) => {
    try {
        const { title, subtitle, linkUrl, order } = req.body;

        if (!req.file) {
            return res.status(400).json({ message: "Image is required" });
        }

        const carousel = new Carousel({
            title,
            subtitle,
            imageUrl: req.file.path || `/uploads/${req.file.filename}`,
            linkUrl,
            order: order || 0
        });

        await carousel.save();

        res.status(201).json({
            message: "Carousel slide created successfully",
            data: carousel
        });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

export const getAllCarouselSlides = async (req, res) => {
    try {
        const slides = await Carousel.find({ isActive: true })
            .sort({ order: 1 })
            .select('-__v');

        res.status(200).json({
            message: "Carousel slides fetched successfully",
            data: slides
        });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

export const updateCarouselSlide = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, subtitle, linkUrl, order, isActive } = req.body;

        const updateData = { title, subtitle, linkUrl, order, isActive };

        if (req.file) {
            updateData.imageUrl = req.file.path || `/uploads/${req.file.filename}`;
        }

        const carousel = await Carousel.findByIdAndUpdate(
            id,
            updateData,
            { new: true, runValidators: true }
        );

        if (!carousel) {
            return res.status(404).json({ message: "Carousel slide not found" });
        }

        res.status(200).json({
            message: "Carousel slide updated successfully",
            data: carousel
        });
    } catch (err) {
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
export const createTopBrand = async (req, res) => {
    try {
        const { brandId, order } = req.body;

        if (!req.file) {
            return res.status(400).json({ message: "Image is required" });
        }

        const topBrand = new TopBrand({
            brandId,
            imageUrl: req.file.path || `/uploads/${req.file.filename}`,
            order: order || 0
        });

        await topBrand.save();

        res.status(201).json({
            message: "Top brand created successfully",
            data: topBrand
        });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

export const getAllTopBrands = async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);

        const topBrands = await TopBrand.find({ isActive: true })
            .populate('brandId', 'brandName description')
            .sort({ order: 1 })
            .skip(skip)
            .limit(parseInt(limit));

        const total = await TopBrand.countDocuments({ isActive: true });

        res.status(200).json({
            message: "Top brands fetched successfully",
            data: topBrands,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(total / parseInt(limit)),
                totalItems: total,
                itemsPerPage: parseInt(limit)
            }
        });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

export const deleteTopBrand = async (req, res) => {
    try {
        const { id } = req.params;

        const topBrand = await TopBrand.findByIdAndDelete(id);

        if (!topBrand) {
            return res.status(404).json({ message: "Top brand not found" });
        }

        res.status(200).json({ message: "Top brand deleted successfully" });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// ============= TOP CATEGORIES =============
export const createTopCategory = async (req, res) => {
    try {
        const { categoryId, displayName, order } = req.body;

        if (!req.file) {
            return res.status(400).json({ message: "Image is required" });
        }

        const topCategory = new TopCategory({
            categoryId,
            displayName,
            imageUrl: req.file.path || `/uploads/${req.file.filename}`,
            order: order || 0
        });

        await topCategory.save();

        res.status(201).json({
            message: "Top category created successfully",
            data: topCategory
        });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

export const getAllTopCategories = async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);

        const topCategories = await TopCategory.find({ isActive: true })
            .populate('categoryId', 'categoryName description')
            .sort({ order: 1 })
            .skip(skip)
            .limit(parseInt(limit));

        const total = await TopCategory.countDocuments({ isActive: true });

        res.status(200).json({
            message: "Top categories fetched successfully",
            data: topCategories,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(total / parseInt(limit)),
                totalItems: total,
                itemsPerPage: parseInt(limit)
            }
        });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

export const deleteTopCategory = async (req, res) => {
    try {
        const { id } = req.params;

        const topCategory = await TopCategory.findByIdAndDelete(id);

        if (!topCategory) {
            return res.status(404).json({ message: "Top category not found" });
        }

        res.status(200).json({ message: "Top category deleted successfully" });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// ============= FEATURED CATEGORIES =============
export const createFeaturedCategory = async (req, res) => {
    try {
        const { categoryId, title, description, order } = req.body;

        if (!req.file) {
            return res.status(400).json({ message: "Image is required" });
        }

        const featuredCategory = new FeaturedCategory({
            categoryId,
            title,
            description,
            imageUrl: req.file.path || `/uploads/${req.file.filename}`,
            order: order || 0
        });

        await featuredCategory.save();

        res.status(201).json({
            message: "Featured category created successfully",
            data: featuredCategory
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
            .populate('categoryId', 'categoryName description')
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
                itemsPerPage: parseInt(limit)
            }
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
export const createTopSellingProduct = async (req, res) => {
    try {
        const { productId, salesCount, order } = req.body;

        const topSelling = new TopSellingProduct({
            productId,
            salesCount: salesCount || 0,
            order: order || 0
        });

        await topSelling.save();

        res.status(201).json({
            message: "Top selling product created successfully",
            data: topSelling
        });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

export const getAllTopSellingProducts = async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);

        const topSelling = await TopSellingProduct.find({ isActive: true })
            .populate({
                path: 'productId',
                select: 'productName description price discountPrice images rating reviewCount',
                populate: [
                    { path: 'category', select: 'categoryName' },
                    { path: 'brand', select: 'brandName' }
                ]
            })
            .sort({ salesCount: -1, order: 1 })
            .skip(skip)
            .limit(parseInt(limit));

        const total = await TopSellingProduct.countDocuments({ isActive: true });

        res.status(200).json({
            message: "Top selling products fetched successfully",
            data: topSelling,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(total / parseInt(limit)),
                totalItems: total,
                itemsPerPage: parseInt(limit)
            }
        });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

export const deleteTopSellingProduct = async (req, res) => {
    try {
        const { id } = req.params;

        const topSelling = await TopSellingProduct.findByIdAndDelete(id);

        if (!topSelling) {
            return res.status(404).json({ message: "Top selling product not found" });
        }

        res.status(200).json({ message: "Top selling product deleted successfully" });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};
// ============= UPDATE TOP BRAND =============
export const updateTopBrand = async (req, res) => {
    try {
        const { id } = req.params;
        const { brandId, order, isActive } = req.body;

        const updateData = { brandId, order, isActive };

        if (req.file) {
            updateData.imageUrl = req.file.path || `/uploads/${req.file.filename}`;
        }

        const topBrand = await TopBrand.findByIdAndUpdate(
            id,
            updateData,
            { new: true, runValidators: true }
        ).populate('brandId', 'brandName description');

        if (!topBrand) {
            return res.status(404).json({ message: "Top brand not found" });
        }

        res.status(200).json({
            message: "Top brand updated successfully",
            data: topBrand
        });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// ============= UPDATE TOP CATEGORY =============
export const updateTopCategory = async (req, res) => {
    try {
        const { id } = req.params;
        const { categoryId, displayName, order, isActive } = req.body;

        const updateData = { categoryId, displayName, order, isActive };

        if (req.file) {
            updateData.imageUrl = req.file.path || `/uploads/${req.file.filename}`;
        }

        const topCategory = await TopCategory.findByIdAndUpdate(
            id,
            updateData,
            { new: true, runValidators: true }
        ).populate('categoryId', 'categoryName description');

        if (!topCategory) {
            return res.status(404).json({ message: "Top category not found" });
        }

        res.status(200).json({
            message: "Top category updated successfully",
            data: topCategory
        });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

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
            { new: true, runValidators: true }
        ).populate('categoryId', 'categoryName description');

        if (!featuredCategory) {
            return res.status(404).json({ message: "Featured category not found" });
        }

        res.status(200).json({
            message: "Featured category updated successfully",
            data: featuredCategory
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
            { new: true, runValidators: true }
        ).populate({
            path: 'productId',
            select: 'productName description price discountPrice images rating reviewCount',
            populate: [
                { path: 'category', select: 'categoryName' },
                { path: 'brand', select: 'brandName' }
            ]
        });

        if (!topSelling) {
            return res.status(404).json({ message: "Top selling product not found" });
        }

        res.status(200).json({
            message: "Top selling product updated successfully",
            data: topSelling
        });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};
export const createCategorySection = async (req, res) => {
    try {
        const { sectionTitle, categoryId, products, displayType, order, productsLimit } = req.body;

        const categorySection = new CategorySection({
            sectionTitle,
            categoryId,
            products: products || [],
            displayType: displayType || "grid",
            order: order || 0,
            productsLimit: productsLimit || 12
        });

        await categorySection.save();

        res.status(201).json({
            message: "Category section created successfully",
            data: categorySection
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
            .populate('categoryId', 'categoryName description')
            .populate({
                path: 'products',
                select: 'productName description price discountPrice images rating reviewCount stock',
                populate: [
                    { path: 'category', select: 'categoryName' },
                    { path: 'brand', select: 'brandName' }
                ]
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
                itemsPerPage: parseInt(limit)
            }
        });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

export const getCategorySectionById = async (req, res) => {
    try {
        const { id } = req.params;

        const section = await CategorySection.findById(id)
            .populate('categoryId', 'categoryName description')
            .populate({
                path: 'products',
                select: 'productName description price discountPrice images rating reviewCount stock',
                populate: [
                    { path: 'category', select: 'categoryName' },
                    { path: 'brand', select: 'brandName' }
                ]
            });

        if (!section) {
            return res.status(404).json({ message: "Category section not found" });
        }

        res.status(200).json({
            message: "Category section fetched successfully",
            data: section
        });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

export const updateCategorySection = async (req, res) => {
    try {
        const { id } = req.params;
        const { sectionTitle, categoryId, products, displayType, order, productsLimit, isActive } = req.body;

        const updateData = {
            sectionTitle,
            categoryId,
            products,
            displayType,
            order,
            productsLimit,
            isActive
        };

        const section = await CategorySection.findByIdAndUpdate(
            id,
            updateData,
            { new: true, runValidators: true }
        )
            .populate('categoryId', 'categoryName description')
            .populate({
                path: 'products',
                select: 'productName description price discountPrice images rating reviewCount stock',
                populate: [
                    { path: 'category', select: 'categoryName' },
                    { path: 'brand', select: 'brandName' }
                ]
            });

        if (!section) {
            return res.status(404).json({ message: "Category section not found" });
        }

        res.status(200).json({
            message: "Category section updated successfully",
            data: section
        });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

export const addProductToCategorySection = async (req, res) => {
    try {
        const { id } = req.params;
        const { productId } = req.body;

        const section = await CategorySection.findByIdAndUpdate(
            id,
            { $addToSet: { products: productId } }, // Prevents duplicate products
            { new: true }
        )
            .populate('categoryId', 'categoryName description')
            .populate({
                path: 'products',
                select: 'productName description price discountPrice images rating reviewCount stock'
            });

        if (!section) {
            return res.status(404).json({ message: "Category section not found" });
        }

        res.status(200).json({
            message: "Product added to category section successfully",
            data: section
        });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

export const removeProductFromCategorySection = async (req, res) => {
    try {
        const { id, productId } = req.params;

        const section = await CategorySection.findByIdAndUpdate(
            id,
            { $pull: { products: productId } },
            { new: true }
        )
            .populate('categoryId', 'categoryName description')
            .populate({
                path: 'products',
                select: 'productName description price discountPrice images rating reviewCount stock'
            });

        if (!section) {
            return res.status(404).json({ message: "Category section not found" });
        }

        res.status(200).json({
            message: "Product removed from category section successfully",
            data: section
        });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

export const deleteCategorySection = async (req, res) => {
    try {
        const { id } = req.params;

        const section = await CategorySection.findByIdAndDelete(id);

        if (!section) {
            return res.status(404).json({ message: "Category section not found" });
        }

        res.status(200).json({ message: "Category section deleted successfully" });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};