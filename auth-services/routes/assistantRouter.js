import { Router } from "express"
import { registerAssistant, loginAssistant, allAssistant, fetchAssistantById, fetchAssistantByUniqueId, updateAssistant, deleteAssistant, approveAssist, forgotAssistantPassword, verifyAssistantOTP, resetAssistantPassword } from "../controller/assistantController.js"

const assistantRouter = Router();

assistantRouter.route("/registerAssist").post(registerAssistant);
assistantRouter.route("/loginAssist").post(loginAssistant);
assistantRouter.route("/allAssists").get(allAssistant);
assistantRouter.route("/assistsById/:id").get(fetchAssistantById);
assistantRouter.route("/assistsByUniqueid/:id").get(fetchAssistantByUniqueId);
assistantRouter.route("/updateAssistant/:id").put(updateAssistant);
assistantRouter.route("/deleteAssistant/:id").delete(deleteAssistant);
assistantRouter.route("/approveAssist/:id").put(approveAssist);
assistantRouter.route("/forgot-password").post(forgotAssistantPassword);
assistantRouter.route("/verify-otp").post(verifyAssistantOTP);
assistantRouter.route("/reset-password").post(resetAssistantPassword);

export default assistantRouter;