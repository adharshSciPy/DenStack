import mongoose, { Schema } from 'mongoose';

const UserAccountSchema = new Schema({
    firstName: { type: String },
    lastName: { type: String },
    email: { type: String, unique: true },
    phoneNumber: { type: Number },
    DOB: { type: String },
    specialization: { type: String },
    clinicName: { type: String },
    licenseNumber: { type: String }
})

const UserAccount = mongoose.model('UserAccount', UserAccountSchema);
export default UserAccount;