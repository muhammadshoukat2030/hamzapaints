import jwt from "jsonwebtoken";

// Middleware to check if admin is logged in (without attaching info to req)
export const isAdminLoggedIn = (req, res, next) => {
  const token = req.cookies?.token; // requires cookie-parser

  if (!token) return res.redirect("/auth/login");

  try {
    jwt.verify(token, process.env.SECRET_KEY); // verify token
    // No req.admin assignment, just allow access
    next();
  } catch (err) {
    console.error("JWT verification error:", err);
    res.redirect("/auth/login");
  }
};

