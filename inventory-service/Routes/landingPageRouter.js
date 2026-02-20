// ============================================
// routes/landingRoutes.js
// ============================================

import express from "express";
import { optionalAuth } from "../middlewares/authmiddleware.js";
import {
  createCarouselSlide,
  getAllCarouselSlides,
  updateCarouselSlide,
  deleteCarouselSlide,
  createBrand,
  getAllBrands,
  getBrandById,
  getBrandsByMainCategory,
  getBrandsBySubCategory,
  updateBrand,
  deleteBrand,
  addTopBrand,
  addMultipleTopBrands,
  getAllTopBrands,
  updateTopBrand,
  deleteTopBrand,
  getTopBrandById,
  createMainCategory,
  getAllMainCategories,
  getMainCategoryById,
  updateMainCategory,
  deleteMainCategory,
  createSubCategory,
  getSubCategories,
  getAllSubCategories,
  getSubCategoryById,
  updateSubCategory,
  deleteSubCategory,
  getMainCategoryHierarchy,
  addTopCategory,
  addMultipleTopCategories,
  getAllTopCategories,
  updateTopCategory,
  deleteTopCategory,
  createFeaturedCategory,
  getAllFeaturedCategories,
  updateFeaturedCategory,
  deleteFeaturedCategory,
  getTopSellingProducts,
  createCategorySection,
  getAllCategorySections,
  getCategorySectionById,
  updateCategorySection,
  addProduct,
  getProducts,
  getProductById,
  getProductsByFilters,
  getProductsByMainCategory,
  getProductsBySubCategory,
  getProductsByBrand,
  updateProduct,
  deleteProduct,
  getTopSellingProductsSimple,
  addFeaturedProduct,
  addMultipleFeaturedProducts,
  getAllFeaturedProducts,
  getFeaturedProductById,
  updateFeaturedProduct,
  deleteFeaturedProduct,
  toggleFeaturedProductStatus,
  getActiveFeaturedProducts,
  createClinicSetup,
  getClinicSetup,
  getAllMainCategoriesWithDetails,
  getMainCategoryWithDetails
} from "../Controller/LandingController.js";
import landingUpload from "../middlewares/landingUpload.js";
import ClinicSetup from "../Model/ClinicSetupSchema.js";

const landingRouter = express.Router();

const flexibleUpload = landingUpload.fields([
  { name: "image", maxCount: 1 },
  { name: "images", maxCount: 10 },
]);

// ============================================
// 🌍 PUBLIC ROUTES (No Authentication Required)
// Anyone can view and manage products/categories
// ============================================

// ============= CAROUSEL ROUTES =============
landingRouter.post("/carousel/create", flexibleUpload, createCarouselSlide);
landingRouter.get("/carousel/getAll", getAllCarouselSlides);
landingRouter.put("/carousel/update/:id", flexibleUpload, updateCarouselSlide);
landingRouter.delete("/carousel/delete/:id", deleteCarouselSlide);

// ============= BRAND ROUTES =============
landingRouter.post("/brands/create", flexibleUpload, createBrand);
landingRouter.get("/brands/getAll", getAllBrands);
landingRouter.get("/brands/getById/:id", getBrandById);
landingRouter.get(
  "/brands/byMainCategory/:mainCategoryId",
  getBrandsByMainCategory,
);
landingRouter.get(
  "/brands/bySubCategory/:subCategoryId",
  getBrandsBySubCategory,
);
landingRouter.put("/brands/update/:id", flexibleUpload, updateBrand);
landingRouter.delete("/brands/delete/:id", deleteBrand);

// ============= TOP BRANDS ROUTES =============
landingRouter.post("/top-brands/add", addTopBrand);
landingRouter.post("/top-brands/add-multiple", addMultipleTopBrands);
landingRouter.get("/top-brands/getAll", getAllTopBrands);
landingRouter.put("/top-brands/update/:id", updateTopBrand);
landingRouter.delete("/top-brands/delete/:id", deleteTopBrand);
landingRouter.get("/top-brands/:id", getTopBrandById);

// ============= MAIN CATEGORY ROUTES =============
landingRouter.post("/main/create", flexibleUpload, createMainCategory);
landingRouter.get("/main/getAll", getAllMainCategories);
landingRouter.get("/main/getById/:id", getMainCategoryById);
landingRouter.put("/main/update/:id", flexibleUpload, updateMainCategory);
landingRouter.delete("/main/delete/:id", deleteMainCategory);

//these apis will fetch all the subcat,brand,prod from the main category
landingRouter.get("/main/getWithDetails", getAllMainCategoriesWithDetails);
landingRouter.get("/main/getWithDetails/:id", getMainCategoryWithDetails);

// ============= SUB CATEGORY ROUTES =============
landingRouter.post("/sub/create", createSubCategory);
landingRouter.get("/sub/getByParent/:mainCategoryId", getSubCategories);
landingRouter.get("/sub/getAll", getAllSubCategories);
landingRouter.get("/sub/getById/:id", getSubCategoryById);
landingRouter.put("/sub/update/:id", updateSubCategory);
landingRouter.delete("/sub/delete/:id", deleteSubCategory);

// ============= UTILITY ROUTES =============
landingRouter.get("/hierarchy", getMainCategoryHierarchy);

// ============= TOP CATEGORIES ROUTES =============
landingRouter.post(
  "/topCategories/create",
  landingUpload.single("image"),
  addTopCategory,
);
landingRouter.post(
  "/topCategories/add-multiple",
  flexibleUpload,
  addMultipleTopCategories,
);
landingRouter.get("/topCategories/getAll", getAllTopCategories);
landingRouter.put(
  "/topCategories/update/:id",
  flexibleUpload,
  updateTopCategory,
);
landingRouter.delete("/topCategories/delete/:id", deleteTopCategory);

// ============= FEATURED CATEGORIES ROUTES =============
landingRouter.post(
  "/featuredCategories/create",
  flexibleUpload,
  createFeaturedCategory,
);
landingRouter.get("/featuredCategories/getAll", getAllFeaturedCategories);
landingRouter.put(
  "/featuredCategories/update/:id",
  flexibleUpload,
  updateFeaturedCategory,
);
landingRouter.delete("/featuredCategories/delete/:id", deleteFeaturedCategory);

// ============= CATEGORY SECTIONS ROUTES =============
landingRouter.post("/categorySections/create", createCategorySection);
landingRouter.get("/categorySections/getAll", getAllCategorySections);
landingRouter.get("/categorySections/getById/:id", getCategorySectionById);
landingRouter.put("/categorySections/update/:id", updateCategorySection);

// ============= PRODUCT ROUTES =============
// Add product (NO AUTH - anyone can add)
landingRouter.post("/products/add", flexibleUpload, addProduct);
landingRouter.get("/products", optionalAuth, getProducts);
landingRouter.get("/products/:id", optionalAuth, getProductById);

// Get products with optional personalized pricing
landingRouter.get("/products/filter", optionalAuth, getProductsByFilters);
landingRouter.get(
  "/products/byMainCategory/:mainCategoryId",
  optionalAuth,
  getProductsByMainCategory,
);
landingRouter.get(
  "/products/bySubCategory/:subCategoryId",
  optionalAuth,
  getProductsBySubCategory,
);
landingRouter.get(
  "/products/byBrand/:brandId",
  optionalAuth,
  getProductsByBrand,
);
landingRouter.get("/products/top-selling", optionalAuth, getTopSellingProducts);
landingRouter.get(
  "/products/top-selling-simple",
  optionalAuth,
  getTopSellingProductsSimple,
);

// Update and delete products (NO AUTH - anyone can manage)
landingRouter.put("/products/update/:productId", flexibleUpload, updateProduct);
landingRouter.delete("/products/delete/:productId", deleteProduct);

// ============= FEATURED PRODUCTS ROUTES =============
landingRouter.post("/featured-products/add", addFeaturedProduct);
landingRouter.post(
  "/featured-products/add-multiple",
  addMultipleFeaturedProducts,
);
landingRouter.get("/featured-products/getAll", getAllFeaturedProducts);
landingRouter.get("/featured-products/active", getActiveFeaturedProducts);
landingRouter.get("/featured-products/getById/:id", getFeaturedProductById);
landingRouter.put("/featured-products/update/:id", updateFeaturedProduct);
landingRouter.put("/featured-products/toggle/:id", toggleFeaturedProductStatus);
landingRouter.delete("/featured-products/delete/:id", deleteFeaturedProduct);


// ClinicSetup

landingRouter.post("/clinic-setup/create", createClinicSetup);
landingRouter.get("/clinic-setup/get", getClinicSetup);

// ============= TOP SELLING PRODUCTS ROUTES =============
landingRouter.get("/topSelling/getAll", getTopSellingProducts);

export default landingRouter;
