import cron from "node-cron";
import Nurse from "../models/nurseSchema.js";
import Pharmacist from "../models/pharmacistSchema.js";
import Receptionist from "../models/receptionSchema.js";
export default function staffShiftCron() {
cron.schedule("0 0 * * *", async () => { // runs every day at 00:00
  const models = [Nurse, Pharmacist, Receptionist];

  for (const Model of models) {
    await Model.updateMany(
      { "shifts.isActive": true },
      {
        $set: {
          "shifts.$[elem].isActive": false,
          "shifts.$[elem].archivedAt": new Date(),
        },
      },
      { arrayFilters: [{ "elem.endDate": { $lt: new Date() } }], multi: true }
    );
  }
  console.log("Shift status updated at midnight for all staff");
});     }
