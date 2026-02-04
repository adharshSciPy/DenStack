import mongoose, { Schema } from "mongoose";

const ClinicSetupSchema = new Schema({
    name: {
        type: String
    },
    contact: {
        type: String
    },
    email: {
        type: String
    },
    city: {
        type: String
    },
    address: {
        type: String
    },
    specialization: {
        type: String
    }
})

const ClinicSetup = mongoose.model('ClinicSetup', ClinicSetupSchema);
export default ClinicSetup;