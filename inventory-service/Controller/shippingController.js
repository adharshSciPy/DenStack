import ShippingSettings from "../Model/ShippingSettingSchema.js";

export const setShippingCharge = async (req, res) => {
  try {
    const { shippingCharge } = req.body;

    let settings = await ShippingSettings.findOne();

    if (!settings) {
      settings = new ShippingSettings({ shippingCharge });
    } else {
      settings.shippingCharge = shippingCharge;
    }

    await settings.save();

    res.json({
      success: true,
      message: "Shipping charge updated",
      data: settings
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const getShippingCharge = async (req, res) => {
  try {

    const settings = await ShippingSettings.findOne();

    res.json({
      success: true,
      shippingCharge: settings?.shippingCharge || 0
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};