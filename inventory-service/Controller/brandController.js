import Brand from "../Model/BrandSchema.js";


const createBrand = async (req, res) => {
  try {
    const { name, category } = req.body;

    const brand = await Brand.create({ name, category });
    res.status(201).json(brand);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


const getBrandsByCategory = async (req, res) => {
  try {
    const brands = await Brand.find({ category: req.params.categoryId });
    res.json(brands);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


const getAllBrands = async (req, res) => {
  try {
    const brands = await Brand.find().populate("category", "name");
    res.json(brands);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export{
    createBrand,getBrandsByCategory,getAllBrands
}
