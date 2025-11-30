// Middleware to check if admin is already logged in
export const isAdminAlreadyLoggedIn = (req, res, next) => {
  const token = req.cookies?.token; // cookie-parser required

  if (token) {
    return res.redirect("/home"); // already logged in
  }

  next(); // not logged in
};
