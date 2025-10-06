
const emailValidator = (email) => {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
};

const passwordValidator = (password) => {
  const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_\-+[\]{}|;:',.<>?]).{8,64}$/;
  return regex.test(password);
};

const nameValidator = (name) => {
  return typeof name === "string" && name.trim().length >= 2 && name.trim().length <= 50;
};


const phoneValidator = (phoneNumber) => {
  const regex = /^[6-9]\d{9}$/;
  return regex.test(phoneNumber);
};

export { emailValidator, passwordValidator, nameValidator, phoneValidator };
