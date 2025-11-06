import Brand from "../Model/BrandSchema.js";


const createBrand = async (req, res) => {
  try {
    const { name, category } = req.body;

    if (!name || !category) {
      return res.status(400).json({ message: "Name, Category are required" })
    }

    // Handle uploaded image
    let imagePath = "";
    if (req.file) {
      imagePath = `/uploads/${req.file.filename}`;
    }

    const newBrand = new Brand({
      name,
      category,
      image: imagePath,
    });

    await newBrand.save();
    res.status(200).json({ message: "Brand Created", data: newBrand });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


const getBrandsByCategory = async (req, res) => {
  try {
    const brands = await Brand.find({ category: req.params.id });
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

const deleteBrand = async (req, res) => {
  const { id } = req.params;
  try {
    const deleteData = await Brand.findByIdAndDelete(id);
    res.status(200).json({ message: "Brand Deleted", data: deleteData })
  } catch (error) {
    res.status(500).json({ message: "Internal Server Error", error: error.message })
  }
}

export {
  createBrand, getBrandsByCategory, getAllBrands, deleteBrand
}
