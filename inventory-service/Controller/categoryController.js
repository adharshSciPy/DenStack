import Category from "../Model/CategorySchema.js";
import Product from "../Model/ProductSchema.js";

const createCategory = async (req, res) => {
  try {
    const { categoryName, description, parentCategory } = req.body
    const category = await Category.create({
      categoryName, description, parentCategory: parentCategory || null,
    })
    res.status(200).json({ message: "Category Created Successfully", data: category })
  } catch (error) {
    res.status(500).json({ message: "Internal Server Error", error: error.message })
  }
}

const getmainCategory = async (req, res) => {
  try {
    const details = await Category.find({ parentCategory: null });
    res.status(200).json({ message: "Category Fetched", data: details })
  } catch (error) {
    res.status(500).json({ message: "Internal Server Error", error: error.message })
  }
}

const getSubCategory = async (req, res) => {
  try {
    const subCategories = await Category.find({ parentCategory: req.params.id });
    res.status(200).json({ message: "Fetch Subcategory", data: subCategories });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getAllCategory = async (req, res) => {
  try {
    const categories = await Category.find().populate("parentCategory", "name");
    res.status(200).json({ message: "Fecth all categories", data: categories });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const deletedCategory = await Category.findByIdAndDelete(id);
    res.status(200).json({ message: "Category Deleted", data: deletedCategory })
  } catch (error) {
    res.status(500).json({ message: "Internal Server Error", error: error.message })
  }
}

const categoryProducts = async (req, res) => {
  try {
    const data = await Product.aggregate([
      {
        $group: {
          _id: "$mainCategory",
          productCount: { $sum: 1 }
        }
      },
      {
        $lookup: {
          from: "categories", // ⚠️ must be exact MongoDB collection name
          localField: "_id",
          foreignField: "_id",
          as: "category"
        }
      },
      {
        $unwind: {
          path: "$category",
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $project: {
          _id: 0,
          categoryId: "$_id",
          categoryName: { $ifNull: ["$category.categoryName", "Unknown"] },
          productCount: 1
        }
      },
      {
        $sort: { productCount: -1 }
      }
    ])

    res.status(200).json(data)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

const getCategoryDashboard = async (req, res) => {
  try {
    const categories = await Category.aggregate([
      // 1️⃣ Only MAIN categories
      { $match: { parentCategory: null } },

      // 2️⃣ Find subcategories
      {
        $lookup: {
          from: "categories",
          localField: "_id",
          foreignField: "parentCategory",
          as: "subCategories"
        }
      },

      // 3️⃣ Collect main + sub category IDs
      {
        $addFields: {
          allCategoryIds: {
            $concatArrays: [
              ["$_id"],
              "$subCategories._id"
            ]
          }
        }
      },

      // 4️⃣ Lookup products using mainCategory OR subCategory
      {
        $lookup: {
          from: "products",
          let: { catIds: "$allCategoryIds" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $or: [
                    { $in: ["$mainCategory", "$$catIds"] },
                    { $in: ["$subCategory", "$$catIds"] }
                  ]
                }
              }
            }
          ],
          as: "products"
        }
      },

      // 5️⃣ Calculate count & revenue
      {
        $addFields: {
          products: { $size: "$products" },
          revenue: {
            $sum: {
              $map: {
                input: "$products",
                as: "p",
                in: {
                  $multiply: [
                    "$$p.price",
                    { $ifNull: ["$$p.stock", 1] }
                  ]
                }
              }
            }
          }
        }
      },

      // 6️⃣ Final output (UI ready)
      {
        $project: {
          categoryName: 1,
          products: 1,
          revenue: 1
        }
      }
    ]);

    res.status(200).json({
      message: "Category dashboard data",
      data: categories
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


export {
  createCategory, getmainCategory, getSubCategory, getAllCategory, deleteCategory, categoryProducts, getCategoryDashboard
}