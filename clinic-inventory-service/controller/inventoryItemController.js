  import InventoryItem from "../model/inventoryItem.js";
  import InventoryCategory from "../model/inventoryCategory.js";

  // ✅ Add new item inside a category
  export const addItem = async (req, res) => {
    try {
      const {
        clinicId,
        categoryId,
        name,
        supplier,
        unitCost,
        currentStock,
        minimumStock,
        reorderLevel,
      } = req.body;

      // 1️⃣ Validate inputs
      // if (!clinicId  || !name || !unitCost) {
      //   return res.status(400).json({
      //     success: false,
      //     message: "clinicId, categoryId, name, and unitCost are required",
      //   });
      // }

      // 2️⃣ Verify category belongs to this clinic
      // const category = await InventoryCategory.findOne({
      //   _id: categoryId,
      //   clinicId,
      // });
      // if (!category) {
      //   return res.status(404).json({
      //     success: false,
      //     message: "Category not found for this clinic",
      //   });
      // }

      // 3️⃣ Prevent duplicate items
      // const existingItem = await InventoryItem.findOne({
      //   clinicId,
      //   categoryId,
      //   name: { $regex: new RegExp(`^${name}$`, "i") },
      // });
      // if (existingItem) {
      //   return res.status(400).json({
      //     success: false,
      //     message: `Item "${name}" already exists in this category`,
      //   });
      // }

      // 4️⃣ Create item
      const item = await InventoryItem.create({
        clinicId,
        categoryId,
        name,
        supplier,
        unitCost,
        currentStock,
        minimumStock,
        reorderLevel,
      });

      res.status(201).json({
        success: true,
        message: "Item added successfully",
        item,
      });
    } catch (error) {
      console.error("Error adding item:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  };


  export const getItemsByCategory = async (req, res) => {
    try {
      const { clinicId, categoryId } = req.params;    
      if (!clinicId || !categoryId) {
          return res.status(400).json({
              success: false,
              message: "clinicId and categoryId are required in params",
          });
      }
      const items = await InventoryItem.find({ clinicId, categoryId }).sort({ name: 1 });
      res.status(200).json({ success: true, items });
    } catch (error) {
      console.error("Error fetching items:", error);
      res.status(500).json({ success: false, message: error.message });
    } 
  };

  export const getItemsByIds = async (req, res) => {
    try {
      const { itemIds,clinicId } = req.params;
      if (!itemIds?.length || !clinicId) {
          return res.status(400).json({
              success: false, 
              message: "clinicId and itemIds array are required in body",
          });
      }
      const items =  await InventoryItem.find({ 
          _id: { $in: itemIds },
          clinicId
      });
      res.status(200).json({ success: true, items });
    } catch (error) {
      console.error("Error fetching items by IDs:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  };

  export const getLowStockItems = async (req, res) => {
    try {
      const { clinicId } = req.params;

      if (!clinicId) {
        return res.status(400).json({ success: false, message: "Clinic ID required" });
      }

      // Find items where currentStock <= minStock
      const lowStockItems = await InventoryItem.find({
        clinicId,
        $expr: { $lte: ["$currentStock", "$minimumStock"] },
      }).populate( "name");

      if (!lowStockItems.length) {
        return res.status(200).json({ success: true, message: "No low stock items", items: [] });
      }

      res.status(200).json({
        success: true,
        count: lowStockItems.length,
        items: lowStockItems,
      });
    } catch (error) {
      console.error("Error fetching low stock items:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  };


  export const        getInventorySummary = async (req, res) => {
    try {
      const { clinicId } = req.params;

      if (!clinicId) {
        return res.status(400).json({
          success: false,
          message: "Clinic ID is required",
        });
      }

      // 1️⃣ Total categories
      const totalCategories = await InventoryCategory.countDocuments({ clinicId });

      // 2️⃣ Total items
      const totalItems = await InventoryItem.countDocuments({ clinicId });

      // 3️⃣ Low stock items
      const lowStockCount = await InventoryItem.countDocuments({
        clinicId,
        $expr: { $lte: ["$currentStock", "$minimumStock"] },
      });

      // 4️⃣ Total inventory value
      const totalValueAgg = await InventoryItem.aggregate([
        { $match: { clinicId } },
        {
          $group: {
            _id: null,
            totalValue: { $sum: { $multiply: ["$currentStock", "$unitCost"] } },
          },
        },
      ]);
      const totalValue =
        totalValueAgg.length > 0 ? totalValueAgg[0].totalValue : 0;

      // 5️⃣ Final response
      res.status(200).json({
        success: true,
        clinicId,
        summary: {
          totalCategories,
          totalItems,
          lowStockCount,
          totalValue,
        },
      });
    } catch (error) {
      console.error("Error fetching inventory summary:", error);
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  };


  export const getFilteredInventoryItems  = async (req, res) => {
  try {
    const { clinicId } = req.params;
    const { limit = 10, search = "", cursor } = req.query;

    if (!clinicId) {
      return res
        .status(400)
        .json({ success: false, message: "Clinic ID is required" });
    }

    const limitNum = parseInt(limit);

    // Build base filter
    const filter = { clinicId };
    if (search.trim() !== "") {
      filter.name = { $regex: search.trim(), $options: "i" };
    }

    // Apply cursor condition (for pagination)
    if (cursor) {
      filter._id = { $lt: new mongoose.Types.ObjectId(cursor) }; // items older than last one
    }

    // Fetch items (sorted newest first)
    const items = await InventoryItem.find(filter)
      .populate("categoryId", "name")
      .sort({ _id: -1 })
      .limit(limitNum)
      .lean();

    // Add lowStock flag
    const processed = items.map((item) => ({
      ...item,
      lowStock: item.currentStock <= item.minimumStock,
    }));

    // Sort low-stock first
    processed.sort((a, b) => {
      if (a.lowStock && !b.lowStock) return -1;
      if (!a.lowStock && b.lowStock) return 1;
      return 0;
    });

    // Determine next cursor
    const nextCursor =
      items.length > 0 ? items[items.length - 1]._id : null;

    res.status(200).json({
      success: true,
      pagination: {
        nextCursor, // send this cursor for next page
        hasMore: !!nextCursor,
        pageSize: limitNum,
      },
      items: processed,
    });
  } catch (error) {
    console.error("Error fetching paginated inventory items:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};