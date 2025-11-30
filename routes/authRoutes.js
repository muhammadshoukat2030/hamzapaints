import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import Admin from "../models/Admin.js";
import { isAdminAlreadyLoggedIn } from "../middleware/isadminalreadyloggedin.js";
import { isAdminLoggedIn } from "../middleware/isadminloggedin.js";

const router = express.Router();



// LOGIN PAGE
router.get("/login",isAdminAlreadyLoggedIn, (req, res) => {
  res.render("login");
});



// CREATE ADMIN (ONLY ONCE)
// router.get("/create-admin", async (req, res) => {
//   try {
//     // Check if admin already exists
//     const alreadyAdmin = await Admin.findOne();
//     if (alreadyAdmin) {
//       return res.status(400).json({
//         success: false,
//         message: "Admin already exists!"
//       });
//     }

//     const username = process.env.ADMIN_USERNAME;
//     const password = process.env.ADMIN_PASSWORD;

//     if (!username || !password) {
//       return res.status(500).json({
//         success: false,
//         message: "ENV credentials missing!"
//       });
//     }

//     const salt = await bcrypt.genSalt(10);
//     const hashed = await bcrypt.hash(password, salt);

//     const admin = await Admin.create({
//       username,
//       password: hashed
//     });

//     return res.json({
//       success: true,
//       message: "Admin created successfully!",
//       admin: {
//         username: admin.username,
//         createdAt: admin.createdAt
//       }
//     });

//   } catch (err) {
//     console.error(err);
//     return res.status(500).json({
//       success: false,
//       message: "Server error creating admin!"
//     });
//   }
// });



// LOGIN POST
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    // Check if both fields exist
    if (!username || !password) {
      return res.status(400).json({ success: false, message: "All fields are required!" });
    }

    // Check admin exists
    const admin = await Admin.findOne({ username });
    if (!admin) {
      return res.status(401).json({ success: false, message: "Username or password is wrong!" });
    }

    // Compare password
    const match = await bcrypt.compare(password, admin.password);
    if (!match) {
      return res.status(401).json({ success: false, message: "Username or password is wrong!" });
    }

    // Create JWT token
    const token = jwt.sign(
      { username: admin.username },
      process.env.SECRET_KEY,
      { expiresIn: "1d" }
    );

    // Send cookie
    res.cookie("token", token, {
      httpOnly: true,   // secure (browser JS can't read)
      secure: false,    // true if using https
      maxAge: 24 * 60 * 60 * 1000
    });

    // Success response
    return res.json({
      success: true,
      message: "Logged in successfully!"
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      message: "Server error! Please try again."
    });
  }
});




// LOGOUT
router.get("/logout",isAdminLoggedIn, (req, res) => {
  res.clearCookie("token");
  res.redirect("/auth/login");
});





export default router;
