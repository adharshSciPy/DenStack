export const checkRole = (allowedRoles = []) => {
    return (req, res, next) => {
        const user = req.user;

        if (!user) {
            return res.status(401).json({ message: "Unauthorized: No user found" });
        }

        // Convert both sides to string to match
        const role = String(user.role);

        if (!allowedRoles.includes(role)) {
            return res.status(403).json({
                message: "Forbidden: You are not allowed to perform this action"
            });
        }

        next();
    };
};
