import EcommerceUser from "../models/EcommerceUserSchema.js";
import {
  emailValidator,
  passwordValidator,
  nameValidator,
  phoneValidator,
} from "../utils/validators.js";


const registerEcommerceUser = async (req, res) => {
  try {
    const { name, email, password, phoneNumber } = req.body;
    if (!nameValidator(name))
      return res.status(400).json({ message: "Invalid name" });
    if (!emailValidator(email))
      return res.status(400).json({ message: "Invalid email" });
    if (!passwordValidator(password))
      return res.status(400).json({ message: "Invalid password" });
    if (!phoneValidator(phoneNumber))
      return res.status(400).json({ message: "Invalid phone number" });


    const existingUser = await EcommerceUser.findOne({ $or: [{ email }, { phoneNumber }] });
    if (existingUser) {
      if (existingUser.email === email)
        return res.status(400).json({ message: "Email already exists" });
      else
        return res.status(400).json({ message: "Phone number already exists" });
    }

    // Create user
    const newSuperAdmin = new EcommerceUser({ name, email, password, phoneNumber });
    await newSuperAdmin.save();

    const accessToken = newSuperAdmin.generateAccessToken();
    const refreshToken = newSuperAdmin.generateRefreshToken();

    res.status(201).json({
      message: "User registered successfully",
      superAdmin: {
        id: newSuperAdmin._id,
        name: newSuperAdmin.name,
        email: newSuperAdmin.email,
        phoneNumber: newSuperAdmin.phoneNumber
      },
      accessToken,
      refreshToken,
    });
  } catch (error) {
    if (error.code === 11000) {
      const duplicateField = Object.keys(error.keyPattern)[0];
      return res.status(400).json({ message: `${duplicateField} already exists` });
    }
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

const loginEcommerceUser = async (req, res) => {
  const { email, password } = req.body;

  try {

    if (!emailValidator(email))
      return res.status(400).json({ message: "Invalid email" });
    if (!passwordValidator(password))
      return res.status(400).json({ message: "Invalid password" });


    const superAdmin = await EcommerceUser.findOne({ email });
    if (!superAdmin)
      return res.status(401).json({ message: "Email or password is incorrect" });


    const isMatch = await superAdmin.isPasswordCorrect(password);
    if (!isMatch)
      return res.status(401).json({ message: "Email or password is incorrect" });


    const accessToken = superAdmin.generateAccessToken();
    const refreshToken = superAdmin.generateRefreshToken();
    res.status(200).json({
      message: "Login successful",
      superAdmin: {
        id: superAdmin._id,
        name: superAdmin.name,
        email: superAdmin.email,
        phoneNumber: superAdmin.phoneNumber
      },
      accessToken,
      refreshToken,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
}


export { registerEcommerceUser, loginEcommerceUser }