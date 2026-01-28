import express from 'express';
import { createUserAccount } from '../Controller/UserAccountController.js';

const userAccountRouter = express.Router();

userAccountRouter.patch('/createuserAccount', createUserAccount);

export default userAccountRouter;