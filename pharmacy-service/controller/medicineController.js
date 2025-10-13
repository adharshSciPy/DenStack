import Medicine from "../model/medicineSchema.js";

// ➕ Add new medicine
 const createMedicine = async (req, res) => {
  try {
    const medicine = new Medicine(req.body);
    await medicine.save();
    res.status(201).json({ message: "Medicine added", medicine });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 📦 Get all medicines (with optional vendor filter)
 const getMedicines = async (req, res) => {
  try {
    const filter = {};
    if (req.query.vendorId) filter.vendorId = req.query.vendorId;

    const medicines = await Medicine.find(filter).populate("vendorId", "name");
    res.json(medicines);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ✏️ Update medicine details or stock
 const updateMedicine = async (req, res) => {
  try {
    const medicine = await Medicine.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });
    res.json({ message: "Medicine updated", medicine });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ❌ Delete a medicine
 const deleteMedicine = async (req, res) => {
  try {
    await Medicine.findByIdAndDelete(req.params.id);
    res.json({ message: "Medicine deleted" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export { createMedicine, getMedicines, updateMedicine, deleteMedicine };