import BuyingGuide from "../Model/BuyingGuideSchema.js";
import Product from "../Model/ProductSchema.js";
import mongoose from "mongoose";

const getImageUrl = (req, filename) => {
  if (!filename) return null;
  return `${req.protocol}://${req.get("host")}/uploads/${filename}`;
};

const createBuyingGuide = async (req, res) => {
  try {
    const { title, subtitle, description, steps } = req.body;

    if (!title || !steps) {
      return res.status(400).json({
        success: false,
        message: "Title and steps are required"
      });
    }

    // Parse steps JSON
    const parsedSteps = JSON.parse(steps);

    // Map uploaded files
    const filesMap = {};
    if (req.files && req.files.length > 0) {
      req.files.forEach(file => {
        filesMap[file.fieldname] = file.filename;
      });
    }

    // Main Image
    const mainImage = getImageUrl(req, filesMap["mainImage"]);

    // 🔍 Validate steps & products
    for (let stepIndex = 0; stepIndex < parsedSteps.length; stepIndex++) {
      const step = parsedSteps[stepIndex];

      // Step image
      const stepImageKey = `stepImage_${stepIndex}`;
      if (filesMap[stepImageKey]) {
        step.image = getImageUrl(req, filesMap[stepImageKey]);
      }

      // Validate products
      if (step.products && step.products.length > 0) {
        for (let productIndex = 0; productIndex < step.products.length; productIndex++) {
          const stepProduct = step.products[productIndex];

          if (!mongoose.Types.ObjectId.isValid(stepProduct.productId)) {
            return res.status(400).json({
              success: false,
              message: `Invalid productId at step ${stepIndex + 1}`
            });
          }

          const product = await Product.findById(stepProduct.productId);

          if (!product) {
            return res.status(404).json({
              success: false,
              message: `Product not found at step ${stepIndex + 1}`
            });
          }

          // Product image override (if uploaded)
          const productImageKey = `step_${stepIndex}_product_${productIndex}`;
          if (filesMap[productImageKey]) {
            stepProduct.image = getImageUrl(
              req,
              filesMap[productImageKey]
            );
          } else {
            stepProduct.image = product.image;
          }

          // Sync product name
          stepProduct.name = product.name;
        }
      }
    }

    // Save
    const buyingGuide = await BuyingGuide.create({
      title,
      subtitle,
      description,
      mainImage,
      steps: parsedSteps
    });

    return res.status(201).json({
      success: true,
      message: "Buying guide created successfully",
      data: buyingGuide
    });

  } catch (error) {
    console.error("Create Buying Guide Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create buying guide",
      error: error.message
    });
  }
};

const getBuyingGuide = async (req, res) => {
  try {
    const buyingGuides = await BuyingGuide.find()
      .select("title subtitle description mainImage steps");

    const formattedResponse = buyingGuides.map(guide => {
      const productCount = guide.steps.reduce(
        (total, step) => total + (step.products?.length || 0),
        0
      );

      return {
        _id: guide._id,
        title: guide.title,
        subtitle: guide.subtitle,
        description: guide.description,
        mainImage: guide.mainImage,
        productCount
      };
    });

    return res.status(200).json({
      success: true,
      data: formattedResponse
    });

  } catch (error) {
    console.error("Get Buying Guide Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch buying guides",
      error: error.message
    });
  }
};

const getBuyingGuideStepsById = async (req, res) => {
  try {
    const { guideId } = req.params;
    const buyingGuide = await BuyingGuide.findById(guideId);
    if (!buyingGuide) {
      return res.status(404).json({
        success: false,
        message: "Buying guide not found"
      });
    }
    return res.status(200).json({
      success: true,
      data: buyingGuide.steps
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch buying guide steps",
      error: error.message
    });
  }
}

const deleteBuyingGuide = async (req, res) => {
  try {
    const { guideId } = req.params;
    const deletedGuide = await BuyingGuide.findByIdAndDelete(guideId);
    res.status(200).json({
      success: true,
      message: "Buying guide deleted successfully",
      data: deletedGuide
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to delete buying guide",
      error: error.message
    });
  }
}




export {
  createBuyingGuide, getBuyingGuide, getBuyingGuideStepsById, deleteBuyingGuide
}
