

export const assignInventory = async (req, res) => {
    try {
        const { productId, quantity, assignTo } = req.body;
        const clinicId = req.clinicId;

        const item = await ClinicInventory.findOne({ clinicId, productId });

        if (!item) return res.status(404).json({ message: "Item not found" });

        if (item.quantity < quantity)
            return res.status(400).json({ message: "Not enough stock" });

        item.quantity -= quantity;

        await item.save();

        // Create a new entry for the assigned section
        await ClinicInventory.create({
            clinicId,
            productId,
            quantity,
            assignedTo: assignTo,
            inventoryType: assignTo
        });

        res.status(200).json({ message: "Inventory assigned successfully" });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err });
    }
};



