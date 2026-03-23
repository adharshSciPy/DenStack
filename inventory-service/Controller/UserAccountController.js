import UserAccount from "../Model/UserAccountSchema.js";
import bcrypt from 'bcryptjs';

const createUserAccount = async (req, res) => {
    try {
        const { firstName, lastName, email, phoneNumber, DOB, specialization, clinicName, licenseNumber } = req.body;
        const newUserAccount = new UserAccount({
            firstName, lastName, email, phoneNumber, DOB, specialization, clinicName, licenseNumber
        });
        await newUserAccount.save();
        res.status(200).json({ message: "User account created successfully", userAccount: newUserAccount });
    } catch (error) {
        res.status(500).json({ message: "Error creating user account", error: error.message });
    }
}
export const getAddresses = async (req, res) => {
  try {
    const user = await UserAccount.findById(req.user.id).select('addresses');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
 
    res.json({ success: true, data: user.addresses });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
 
// POST /api/v1/ecommerceuser/addresses
export const addAddress = async (req, res) => {
  try {
    const { label, fullName, phone, addressLine1, addressLine2, city, state, pincode, country, isDefault } = req.body;
 
    const user = await UserAccount.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
 
    // If new address is default, unset all others
    if (isDefault) {
      user.addresses.forEach(a => { a.isDefault = false; });
    }
 
    // If this is the first address, make it default automatically
    const makeDefault = isDefault || user.addresses.length === 0;
 
    user.addresses.push({
      label: label || 'Home',
      fullName, phone, addressLine1,
      addressLine2: addressLine2 || '',
      city, state, pincode,
      country: country || 'India',
      isDefault: makeDefault,
    });
 
    await user.save();
    res.status(201).json({ success: true, message: 'Address added', data: user.addresses });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
 
// PUT /api/v1/ecommerceuser/addresses/:addressId
export const updateAddress = async (req, res) => {
  try {
    const { addressId } = req.params;
    const user = await UserAccount.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
 
    const address = user.addresses.id(addressId);
    if (!address) return res.status(404).json({ success: false, message: 'Address not found' });
 
    const { label, fullName, phone, addressLine1, addressLine2, city, state, pincode, country, isDefault } = req.body;
 
    if (isDefault) {
      user.addresses.forEach(a => { a.isDefault = false; });
    }
 
    if (label       !== undefined) address.label       = label;
    if (fullName    !== undefined) address.fullName    = fullName;
    if (phone       !== undefined) address.phone       = phone;
    if (addressLine1 !== undefined) address.addressLine1 = addressLine1;
    if (addressLine2 !== undefined) address.addressLine2 = addressLine2;
    if (city        !== undefined) address.city        = city;
    if (state       !== undefined) address.state       = state;
    if (pincode     !== undefined) address.pincode     = pincode;
    if (country     !== undefined) address.country     = country;
    if (isDefault   !== undefined) address.isDefault   = isDefault;
 
    await user.save();
    res.json({ success: true, message: 'Address updated', data: user.addresses });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
 
// DELETE /api/v1/ecommerceuser/addresses/:addressId
export const deleteAddress = async (req, res) => {
  try {
    const { addressId } = req.params;
    const user = await UserAccount.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
 
    const address = user.addresses.id(addressId);
    if (!address) return res.status(404).json({ success: false, message: 'Address not found' });
 
    const wasDefault = address.isDefault;
    address.deleteOne();
 
    // If deleted address was default, make the first remaining one default
    if (wasDefault && user.addresses.length > 0) {
      user.addresses[0].isDefault = true;
    }
 
    await user.save();
    res.json({ success: true, message: 'Address deleted', data: user.addresses });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
 
// PUT /api/v1/ecommerceuser/addresses/:addressId/set-default
export const setDefaultAddress = async (req, res) => {
  try {
    const { addressId } = req.params;
    const user = await UserAccount.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
 
    user.addresses.forEach(a => { a.isDefault = a._id.toString() === addressId; });
    await user.save();
 
    res.json({ success: true, message: 'Default address updated', data: user.addresses });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
 
// ─────────────────────────────────────────────────────────────────────────────
// WISHLIST
// ─────────────────────────────────────────────────────────────────────────────
 
// GET /api/v1/ecommerceuser/wishlist
export const getWishlist = async (req, res) => {
  try {
    const user = await UserAccount.findById(req.user.id)
      .select('wishlist')
      .populate('wishlist.productId', 'name image originalPrice clinicDiscountPrice doctorDiscountPrice stock status');
 
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
 
    res.json({ success: true, data: user.wishlist });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
 
// POST /api/v1/ecommerceuser/wishlist/:productId
export const addToWishlist = async (req, res) => {
  try {
    const { productId } = req.params;
    const user = await UserAccount.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
 
    const already = user.wishlist.find(w => w.productId.toString() === productId);
    if (already) {
      return res.status(400).json({ success: false, message: 'Product already in wishlist' });
    }
 
    user.wishlist.push({ productId });
    await user.save();
 
    res.status(201).json({ success: true, message: 'Added to wishlist', count: user.wishlist.length });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
 
// DELETE /api/v1/ecommerceuser/wishlist/:productId
export const removeFromWishlist = async (req, res) => {
  try {
    const { productId } = req.params;
    const user = await UserAccount.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
 
    user.wishlist = user.wishlist.filter(w => w.productId.toString() !== productId);
    await user.save();
 
    res.json({ success: true, message: 'Removed from wishlist', count: user.wishlist.length });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
 
// GET /api/v1/ecommerceuser/wishlist/check/:productId
export const checkWishlist = async (req, res) => {
  try {
    const { productId } = req.params;
    const user = await UserAccount.findById(req.user.id).select('wishlist');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
 
    const inWishlist = user.wishlist.some(w => w.productId.toString() === productId);
    res.json({ success: true, inWishlist });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
 
// ─────────────────────────────────────────────────────────────────────────────
// CHANGE PASSWORD
// ─────────────────────────────────────────────────────────────────────────────
 
// PUT /api/v1/ecommerceuser/change-password
export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;
 
    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({ success: false, message: 'All password fields are required' });
    }
 
    if (newPassword !== confirmPassword) {
      return res.status(400).json({ success: false, message: 'New passwords do not match' });
    }
 
    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
    }
 
    const user = await UserAccount.findById(req.user.id).select('+password');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
 
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Current password is incorrect' });
    }
 
    user.password = await bcrypt.hash(newPassword, 12);
    await user.save();
 
    res.json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
export { createUserAccount };