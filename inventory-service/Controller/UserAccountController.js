import UserAccount from "../Model/UserAccountSchema.js";

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

export { createUserAccount };