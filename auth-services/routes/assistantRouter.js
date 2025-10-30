import { Router } from "express"
import { registerAssistant, loginAssistant, allAssistant, fetchAssistantById, fetchAssistantByUniqueId } from "../controller/assistantController.js"

const assistantRouter = Router();

assistantRouter.route("/registerAssist").post(registerAssistant);
assistantRouter.route("/loginAssist").post(loginAssistant);
assistantRouter.route("/allAssists").get(allAssistant);
assistantRouter.route("/assistsById/:id").get(fetchAssistantById);
assistantRouter.route("/assistsByUniqueid/:id").get(fetchAssistantByUniqueId);

export default assistantRouter;