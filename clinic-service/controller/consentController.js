import ConsentForm from "../model/consentForm.js";

// ==============================
// 📤 Upload Multiple Consent Forms (with titles)
// ==============================
export const uploadConsentForm = async (req, res) => {
  try {
    const files = req.files;
    const titles = req.body.titles; // can be string or array
    console.log(req.clinicId);
    
    if (!files || files.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Files are required",
      });
    }

    const forms = await Promise.all(
      files.map((file, index) => {
        // 🔒 File type validation
        if (
          !file.mimetype.includes("pdf") &&
          !file.mimetype.includes("image")
        ) {
          throw new Error("Invalid file type");
        }

        // 🧠 Handle title (array or single)
        let title;
        if (Array.isArray(titles)) {  
          title = titles[index] || file.originalname;
        } else {
          title = titles || file.originalname;
        }

        return ConsentForm.create({
          clinicId: req.clinicId,
          title,
          fileUrl: file.path.replace(/\\/g, "/"),
          fileType: file.mimetype.includes("pdf") ? "pdf" : "image",
          uploadedBy: req.clinicId,
        });
      })
    );

    return res.status(201).json({
      success: true,
      message: "Consent forms uploaded successfully",
      count: forms.length,
      data: forms,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message || "Upload failed",
    });
  }
};

// ==============================
// 📥 Get Consent Forms (Clinic-wise)
// ==============================
export const getConsentFormsByClinic = async (req, res) => {
  try {
    const forms = await ConsentForm.find({
      clinicId: req.clinicId,
      isActive: true,
    }).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: forms.length,
      data: forms,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message || "Failed to fetch consent forms",
    });
  }
};

// ==============================
// ❌ Soft Delete Consent Form (Secure)
// ==============================
export const deleteConsentForm = async (req, res) => {
  try {
    const { id } = req.params;

    // 🔹 Fetch the form first
    const form = await ConsentForm.findById(id);

    if (!form) {
      return res.status(404).json({
        success: false,
        message: "Consent form not found",
      });
    }

    // 🔒 Ownership check
    if (form.clinicId.toString() !== req.clinicId) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized access",
      });
    }

    // 🔹 Delete after validation
    await ConsentForm.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: "Consent form deleted successfully",
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message || "Delete failed",
    });
  }
};