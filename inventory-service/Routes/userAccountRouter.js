import express from 'express';
import { createUserAccount,getAddresses,
  addAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
  getWishlist,
  addToWishlist,
  removeFromWishlist,
  checkWishlist,
  changePassword, } from '../Controller/UserAccountController.js';

import { verifyAuthToken } from '../middlewares/authMiddleware.js';

const userAccountRouter = express.Router();

// ── Existing ──────────────────────────────────────────────────────────────────
userAccountRouter.patch('/createuserAccount', createUserAccount);

// ── Addresses ─────────────────────────────────────────────────────────────────
userAccountRouter.get   ('/addresses',                        verifyAuthToken, getAddresses);
userAccountRouter.post  ('/addresses',                        verifyAuthToken, addAddress);
userAccountRouter.put   ('/addresses/:addressId',             verifyAuthToken, updateAddress);
userAccountRouter.delete('/addresses/:addressId',             verifyAuthToken, deleteAddress);
userAccountRouter.put   ('/addresses/:addressId/set-default', verifyAuthToken, setDefaultAddress);

// ── Wishlist ──────────────────────────────────────────────────────────────────
userAccountRouter.get   ('/wishlist',                  verifyAuthToken, getWishlist);
userAccountRouter.post  ('/wishlist/:productId',       verifyAuthToken, addToWishlist);
userAccountRouter.delete('/wishlist/:productId',       verifyAuthToken, removeFromWishlist);
userAccountRouter.get   ('/wishlist/check/:productId', verifyAuthToken, checkWishlist);

// ── Change Password ───────────────────────────────────────────────────────────
userAccountRouter.put('/change-password', verifyAuthToken, changePassword);

export default userAccountRouter;