//complete routes for patient complaints, treatment procedures, medical history, treatment advice, dental history, examination findings, and patient diagnosis. Each route is protected by clinic authentication middleware to ensure that only authorized clinics can access these endpoints.
import {Router}from 'express';
import ClinicAutheticationMiddleware from '../middleware/ClinicAutheticationMiddleware.js';
const patientAndTreatmentDetailsRouter = Router();


import { createPatientComplaint,getAllPatientComplaints,getPatientComplaintById, updatePatientComplaint, deletePatientComplaint, } from '../controller/patientComplaintController.js';
import { createTreatmentProcedure,getAllTreatmentProcedures,searchTreatmentProcedures,getTreatmentProcedureById, updateTreatmentProcedure, deleteTreatmentProcedure } from '../controller/treatmentAndProcedureController.js';
import { createMedicalHistory,getAllMedicalHistories,getMedicalHistoryById, updateMedicalHistory, deleteMedicalHistory } from '../controller/medicalHistoryController.js'; 
import { createTreatmentAdvice,getAllTreatmentAdvices,getTreatmentAdviceById, updateTreatmentAdvice,deleteTreatmentAdvice} from '../controller/treatmentAdviceController.js';
import { createDentalHistory, getAllDentalHistories, getDentalHistoryById, updateDentalHistory, deleteDentalHistory, addCommonDentalHistories, searchDentalHistories } from '../controller/dentalHistoryController.js';
import { createExaminationFinding, getAllExaminationFindings, getExaminationFindingById, updateExaminationFinding, deleteExaminationFinding, addCommonFindings } from '../controller/examinationFindingController.js';
import { createPatientDiagnosis, getAllPatientDiagnoses, getPatientDiagnosisById, updatePatientDiagnosis, deletePatientDiagnosis, addCommonDiagnoses } from '../controller/patientDiagnosisController.js';
          
const requireClinicAuth = (req, res, next) => {
    // Only require clinic authentication for modifying operations
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
        return ClinicAutheticationMiddleware(req, res, next);
    }
    // Skip authentication for GET and other safe methods
    next();
};
// Apply clinic authentication to all routes
patientAndTreatmentDetailsRouter.use(requireClinicAuth);

// 
// ===== TREATMENT PROCEDURES ROUTES =====
patientAndTreatmentDetailsRouter.post('/treatment-procedures', createTreatmentProcedure);
patientAndTreatmentDetailsRouter.get('/treatment-procedures', getAllTreatmentProcedures);   
patientAndTreatmentDetailsRouter.get('/treatment-procedures/search', searchTreatmentProcedures);
patientAndTreatmentDetailsRouter.get('/treatment-procedures/:id', getTreatmentProcedureById);
patientAndTreatmentDetailsRouter.put('/treatment-procedures/:id', updateTreatmentProcedure);
patientAndTreatmentDetailsRouter.delete('/treatment-procedures/:id', deleteTreatmentProcedure);

// ===== PATIENT COMPLAINTS ROUTES =====
patientAndTreatmentDetailsRouter.post('/patient-complaints', createPatientComplaint);
// patientAndTreatmentDetailsRouter.post('/patient-complaints/common', addCommonPatientComplaints);
patientAndTreatmentDetailsRouter.get('/patient-complaints', getAllPatientComplaints);
patientAndTreatmentDetailsRouter.get('/patient-complaints/:id', getPatientComplaintById);
patientAndTreatmentDetailsRouter.put('/patient-complaints/:id', updatePatientComplaint);
patientAndTreatmentDetailsRouter.delete('/patient-complaints/:id', deletePatientComplaint);

// ===== MEDICAL HISTORY ROUTES =====
patientAndTreatmentDetailsRouter.post('/medical-history', createMedicalHistory);
patientAndTreatmentDetailsRouter.get('/medical-history', getAllMedicalHistories);
patientAndTreatmentDetailsRouter.get('/medical-history/:id', getMedicalHistoryById);
patientAndTreatmentDetailsRouter.put('/medical-history/:id', updateMedicalHistory);
patientAndTreatmentDetailsRouter.delete('/medical-history/:id', deleteMedicalHistory);

// ===== TREATMENT ADVICE ROUTES =====
patientAndTreatmentDetailsRouter.post('/treatment-advice', createTreatmentAdvice);
patientAndTreatmentDetailsRouter.get('/treatment-advice', getAllTreatmentAdvices);
patientAndTreatmentDetailsRouter.get('/treatment-advice/:id', getTreatmentAdviceById);
patientAndTreatmentDetailsRouter.put('/treatment-advice/:id', updateTreatmentAdvice);
patientAndTreatmentDetailsRouter.delete('/treatment-advice/:id', deleteTreatmentAdvice);

// ===== DENTAL HISTORY ROUTES =====
patientAndTreatmentDetailsRouter.post('/dental-history',createDentalHistory);
patientAndTreatmentDetailsRouter.post('/dental-history/common', addCommonDentalHistories);
patientAndTreatmentDetailsRouter.get('/dental-history', getAllDentalHistories);
patientAndTreatmentDetailsRouter.get('/dental-history/search', searchDentalHistories);
patientAndTreatmentDetailsRouter.get('/dental-history/:id', getDentalHistoryById);
patientAndTreatmentDetailsRouter.put('/dental-history/:id', updateDentalHistory);
patientAndTreatmentDetailsRouter.delete('/dental-history/:id', deleteDentalHistory);

// ===== EXAMINATION FINDINGS ROUTES =====
patientAndTreatmentDetailsRouter.post('/examination-findings', createExaminationFinding);
patientAndTreatmentDetailsRouter.post('/examination-findings/common', addCommonFindings);
patientAndTreatmentDetailsRouter.get('/examination-findings', getAllExaminationFindings);
patientAndTreatmentDetailsRouter.get('/examination-findings/:id', getExaminationFindingById);
patientAndTreatmentDetailsRouter.put('/examination-findings/:id', updateExaminationFinding);
patientAndTreatmentDetailsRouter.delete('/examination-findings/:id', deleteExaminationFinding);

// ===== PATIENT DIAGNOSIS ROUTES =====
patientAndTreatmentDetailsRouter.post('/patient-diagnosis', createPatientDiagnosis);
patientAndTreatmentDetailsRouter.post('/patient-diagnosis/common', addCommonDiagnoses);
patientAndTreatmentDetailsRouter.get('/patient-diagnosis', getAllPatientDiagnoses);
patientAndTreatmentDetailsRouter.get('/patient-diagnosis/:id', getPatientDiagnosisById);
patientAndTreatmentDetailsRouter.put('/patient-diagnosis/:id', updatePatientDiagnosis);
patientAndTreatmentDetailsRouter.delete('/patient-diagnosis/:id', deletePatientDiagnosis);

export default patientAndTreatmentDetailsRouter;