import express from "express";
import {
    createCarouselSlide,
    getAllCarouselSlides,
    updateCarouselSlide,
    deleteCarouselSlide,
    createTopBrand,
    getAllTopBrands,
    updateTopBrand,
    deleteTopBrand,
    createTopCategory,
    getAllTopCategories,
    updateTopCategory,
    deleteTopCategory,
    createFeaturedCategory,
    getAllFeaturedCategories,
    updateFeaturedCategory,
    deleteFeaturedCategory,
    createTopSellingProduct,
    updateTopSellingProduct,
    getAllTopSellingProducts,
    deleteTopSellingProduct,
    createCategorySection,
    getAllCategorySections,
    getCategorySectionById,
    updateCategorySection,
    addProductToCategorySection,
    removeProductFromCategorySection,
    deleteCategorySection
} from "../Controller/landingPageController.js";
import upload from "../middlewares/upload.js";

const landingRouter = express.Router();

// ============= CAROUSEL ROUTES =============
landingRouter.post("/carousel/create", upload.single("image"), createCarouselSlide);
landingRouter.get("/carousel/getAll", getAllCarouselSlides);
landingRouter.put("/carousel/update/:id", upload.single("image"), updateCarouselSlide);
landingRouter.delete("/carousel/delete/:id", deleteCarouselSlide);

// ============= TOP BRANDS ROUTES =============
landingRouter.post("/topBrands/create", upload.single("image"), createTopBrand);
landingRouter.get("/topBrands/getAll", getAllTopBrands);
landingRouter.put("/topBrands/update/:id", upload.single("image"), updateTopBrand); // NEW
landingRouter.delete("/topBrands/delete/:id", deleteTopBrand);

// ============= TOP CATEGORIES ROUTES =============
landingRouter.post("/topCategories/create", upload.single("image"), createTopCategory);
landingRouter.get("/topCategories/getAll", getAllTopCategories);
landingRouter.put("/topCategories/update/:id", upload.single("image"), updateTopCategory); // NEW
landingRouter.delete("/topCategories/delete/:id", deleteTopCategory);

// ============= FEATURED CATEGORIES ROUTES =============
landingRouter.post("/featuredCategories/create", upload.single("image"), createFeaturedCategory);
landingRouter.get("/featuredCategories/getAll", getAllFeaturedCategories);
landingRouter.put("/featuredCategories/update/:id", upload.single("image"), updateFeaturedCategory); // NEW
landingRouter.delete("/featuredCategories/delete/:id", deleteFeaturedCategory);

// ============= TOP SELLING PRODUCTS ROUTES =============
landingRouter.post("/topSelling/create", createTopSellingProduct);
landingRouter.get("/topSelling/getAll", getAllTopSellingProducts);
landingRouter.put("/topSelling/update/:id", updateTopSellingProduct); // NEW
landingRouter.delete("/topSelling/delete/:id", deleteTopSellingProduct);

// ============= CATEGORY SECTIONS ROUTES (Category 1, 2, 3...) =============

landingRouter.post("/categorySections/create", createCategorySection);
landingRouter.get("/categorySections/getAll", getAllCategorySections);
landingRouter.get("/categorySections/getById/:id", getCategorySectionById);
landingRouter.put("/categorySections/update/:id", updateCategorySection);
landingRouter.post("/categorySections/:id/addProduct", addProductToCategorySection);
landingRouter.delete("/categorySections/:id/removeProduct/:productId", removeProductFromCategorySection);
landingRouter.delete("/categorySections/delete/:id", deleteCategorySection);
export default landingRouter;