import BuyingGuide from "../Model/BuyingGuideSchema.js";

const createBuyingGuide = async (req, res) => {
    try {
        const {
            title,
            subtitle,
            description,
            sections,
            products
        } = req.body;

        if (!title || !subtitle || !description) {
            return res.status(400).json({
                success: false,
                message: "Required fields missing"
            });
        }

        // 🖼️ Main Image
        const mainImage = req.files?.mainImage?.[0]
            ? `/uploads/${req.files.mainImage[0].filename}`
            : null;

        // 📌 Sections
        const parsedSections = sections
            ? JSON.parse(sections).map((section, index) => ({
                ...section,
                image: req.files?.sectionImages?.[index]
                    ? `/uploads/${req.files.sectionImages[index].filename}`
                    : null
            }))
            : [];

        // 🛒 Products
        const parsedProducts = products
            ? JSON.parse(products).map((product, index) => ({
                ...product,
                image: req.files?.productImages?.[index]
                    ? `/uploads/${req.files.productImages[index].filename}`
                    : null
            }))
            : [];

        // ✅ AUTO product count (SOURCE OF TRUTH)
        const productCount = parsedProducts.length;

        const guide = await BuyingGuide.create({
            title,
            subtitle,
            description,
            mainImage,
            sections: parsedSections,
            products: parsedProducts,
            productCount
        });

        res.status(201).json({
            success: true,
            message: "Buying Guide created successfully",
            data: guide
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};




export {
    createBuyingGuide
}
