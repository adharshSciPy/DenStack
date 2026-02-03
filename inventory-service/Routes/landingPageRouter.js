import express from "express";
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
  // getTopSellingProductsForLanding,
  createCategorySection,
  getAllCategorySections,
  getCategorySectionById,
  updateCategorySection,
  addProduct,
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
  getClinicSetup

} from "../Controller/LandingController.js";
import landingUpload from "../middlewares/landingUpload.js";
import ClinicSetup from "../Model/ClinicSetupSchema.js";
const landingRouter = express.Router();

// Flexible middleware - accepts both single and multiple files
const flexibleUpload = landingUpload.fields([
  { name: "image", maxCount: 1 },
  { name: "images", maxCount: 10 },
]);

// ============= CAROUSEL ROUTES =============
landingRouter.post("/carousel/create", flexibleUpload, createCarouselSlide);
landingRouter.get("/carousel/getAll", getAllCarouselSlides);
landingRouter.put("/carousel/update/:id", flexibleUpload, updateCarouselSlide);
landingRouter.delete("/carousel/delete/:id", deleteCarouselSlide);

// =============BRAND , TOP BRANDS ROUTES =============
landingRouter.post("/brands/create", flexibleUpload, createBrand);
landingRouter.get("/brands/getAll", getAllBrands);
landingRouter.get("/brands/getById/:id", getBrandById);
landingRouter.get("/brands/byMainCategory/:mainCategoryId", getBrandsByMainCategory);
landingRouter.get("/brands/bySubCategory/:subCategoryId", getBrandsBySubCategory);
landingRouter.put("/brands/update/:id", flexibleUpload, updateBrand);
landingRouter.delete("/brands/delete/:id", deleteBrand);

landingRouter.post("/top-brands/add", addTopBrand);
landingRouter.post("/top-brands/add-multiple", addMultipleTopBrands);
landingRouter.get("/top-brands/getAll", getAllTopBrands);
landingRouter.put("/top-brands/update/:id", updateTopBrand);
landingRouter.delete("/top-brands/delete/:id", deleteTopBrand);
landingRouter.get("/top-brands/:id", getTopBrandById);

// ============= TOP CATEGORIES ROUTES =============
landingRouter.post("/topCategories/create", flexibleUpload, addTopCategory);
landingRouter.post(
  "/topCategories/add-multiple",
  flexibleUpload,
  addMultipleTopCategories
);
landingRouter.get("/-/getAll", getAllTopCategories);
landingRouter.put(
  "/topCategories/update/:id",
  flexibleUpload,
  updateTopCategory
);
landingRouter.delete("/topCategories/delete/:id", deleteTopCategory);
// ============= MAIN CATEGORY ROUTES =============
landingRouter.post("/main/create", flexibleUpload, createMainCategory);
landingRouter.get("/main/getAll", getAllMainCategories);
landingRouter.get("/main/getById/:id", getMainCategoryById);
landingRouter.put("/main/update/:id", flexibleUpload, updateMainCategory);
landingRouter.delete("/main/delete/:id", deleteMainCategory);

// ============= SUB CATEGORY ROUTES =============
landingRouter.post("/sub/create", createSubCategory);
landingRouter.get("/sub/getByParent/:mainCategoryId", getSubCategories);
landingRouter.get("/sub/getAll", getAllSubCategories);
landingRouter.get("/sub/getById/:id", getSubCategoryById);
landingRouter.put("/sub/update/:id", updateSubCategory);
landingRouter.delete("/sub/delete/:id", deleteSubCategory);

// ============= UTILITY ROUTES =============
landingRouter.get("/hierarchy", getMainCategoryHierarchy);

// ============= FEATURED CATEGORIES ROUTES =============
landingRouter.post(
  "/featuredCategories/create",
  flexibleUpload,
  createFeaturedCategory
);
landingRouter.get("/featuredCategories/getAll", getAllFeaturedCategories);
landingRouter.put(
  "/featuredCategories/update/:id",
  flexibleUpload,
  updateFeaturedCategory
);
landingRouter.delete("/featuredCategories/delete/:id", deleteFeaturedCategory);

// ============= TOP SELLING PRODUCTS ROUTES =============
landingRouter.get("/topSelling/getAll", getTopSellingProducts);


// ============= CATEGORY SECTIONS ROUTES =============
landingRouter.post("/categorySections/create", createCategorySection);
landingRouter.get("/categorySections/getAll", getAllCategorySections);
landingRouter.get("/categorySections/getById/:id", getCategorySectionById);
landingRouter.put("/categorySections/update/:id", updateCategorySection);
// ============= PRODUCT MANAGEMENT ROUTES (NEW) =============
// Add product (requires mainCategoryId, subCategoryId, brandId)
landingRouter.post("/products/add", flexibleUpload, addProduct);

// Get products with filters (query params: mainCategoryId, subCategoryId, brandId)
landingRouter.get("/products/filter", getProductsByFilters);

// Get products by specific category/brand
landingRouter.get("/products/byMainCategory/:mainCategoryId", getProductsByMainCategory);
landingRouter.get("/products/bySubCategory/:subCategoryId", getProductsBySubCategory);
landingRouter.get("/products/byBrand/:brandId", getProductsByBrand);

// Update and delete products
landingRouter.put("/products/update/:productId", flexibleUpload, updateProduct);
landingRouter.delete("/products/delete/:productId", deleteProduct);

// Get top selling products 
landingRouter.get("/products/top-selling", getTopSellingProducts);

// Get top selling products 
landingRouter.get("/products/top-selling-simple", getTopSellingProductsSimple);

// ============= FEATURED PRODUCTS ROUTES =============
// Add product to featured
landingRouter.post("/featured-products/add", addFeaturedProduct);

// Add multiple products to featured
landingRouter.post("/featured-products/add-multiple", addMultipleFeaturedProducts);

// Get all featured products (admin)
landingRouter.get("/featured-products/getAll", getAllFeaturedProducts);

// Get active featured products (for landing page)
landingRouter.get("/featured-products/active", getActiveFeaturedProducts);

// Get featured product by ID
landingRouter.get("/featured-products/getById/:id", getFeaturedProductById);

// Update featured product
landingRouter.put("/featured-products/update/:id", updateFeaturedProduct);

// Toggle featured product status
landingRouter.put("/featured-products/toggle/:id", toggleFeaturedProductStatus);

// Delete featured product
landingRouter.delete("/featured-products/delete/:id", deleteFeaturedProduct);

// ClinicSetup

landingRouter.post("/clinic-setup/create", createClinicSetup);
landingRouter.get("/clinic-setup/get", getClinicSetup);

export default landingRouter;
