import { Router } from 'express';
// import { getMedicineSuggestions } from '../utils/medicineUtils.js';
import { createMedicineController, getMedicineByIdController, getMedicineSuggestionsController, getPopularMedicinesController, searchMedicinesController } from '../controller/medicineController.js';
const medicineRouter = Router();
medicineRouter.route('/suggestions').get(getMedicineSuggestionsController);
medicineRouter.route('/create').post( createMedicineController);
medicineRouter.route('/popular').get(getPopularMedicinesController);
medicineRouter.route('/:id').get(getMedicineByIdController);
medicineRouter.route('/').get(searchMedicinesController)
export default medicineRouter;  