const express = require("express");
const cors = require("cors");
const Database = require("@replit/database");
const { google } = require("googleapis");
const nodemailer = require("nodemailer");
require("dotenv").config();
const bcrypt = require("bcrypt");
const { calculateTotal, validatePassword, fetchFile } = require("./utility");
const db = new Database();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const saltRounds = 10;

// Parse Google Service Account credentials
const serviceCredentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);

// Initialize Google Auth
const auth = new google.auth.GoogleAuth({
    credentials: serviceCredentials,
    scopes: ["https://www.googleapis.com/auth/drive.readonly"],
});

// Get Google Drive client
const drive = google.drive({ version: "v3", auth });

const app = express();
app.use(cors());
app.use(express.json());

// Serve static files
app.use(express.static(".", { index: "index.html" }));

//Helper function to send email
async function sendEmail(to, subject, text, html, retries = 3) {
    try {
        const transporter = nodemailer.createTransport({
            service: "gmail",
            auth: {
                user: process.env.EMAIL,
                pass: process.env.EMAIL_PASSWORD,
            },
        });

        await transporter.sendMail({
            from: process.env.EMAIL,
            to,
            subject,
            text,
            html,
        });
        console.log(`Email sent to ${to}`);
        return true;
    } catch (error) {
        if (retries > 0) {
            console.warn(
                `Retrying email to ${to}... (${retries} retries left)`,
            );
            return await sendEmail(to, subject, text, html, retries - 1);
        }
        console.error(`Failed to send email to ${to}:`, error.message);
        return false;
    }
}

app.get("/config", (req, res) => {
    if (!process.env.STRIPE_PUBLISHABLE_KEY) {
        return res
            .status(500)
            .json({ error: "Stripe publishable key not configured" });
    }
    res.json({ publishableKey: process.env.STRIPE_PUBLISHABLE_KEY });
});

// Helper function for hashing passwords
async function hashPassword(password) {
    saltRounds = 10;
    return await bcrypt.hash(password, saltRounds);
}

// Helper function for validating user input
function validateInput(fields, requiredFields) {
    for (const field of requiredFields) {
        if (!fields[field]) {
            return `Missing required field: ${field}`;
        }
    }
    return null;
}

// Create a new user account
app.post("/register", async (req, res) => {
    const { email, username, password } = req.body;

    const validationError = validateInput(req.body, [
        "email",
        "username",
        "password",
    ]);
    if (validationError)
        return res.status(400).json({ error: validationError });

    try {
        const existingUser = await db.get(email);
        if (existingUser)
            return res.status(400).json({ error: "User already exists." });

        const hashedPassword = await hashPassword(password);
        const userProfile = {
            username,
            email,
            password: hashedPassword,
            purchaseHistory: [],
        };
        await db.set(email, userProfile);

        res.json({ message: "Account created successfully." });
    } catch (error) {
        next(error);
    }
});

// Login user
app.post("/login", async (req, res) => {
    const { email, password } = req.body;

    const validationError = validateInput(req.body, ["email", "password"]);
    if (validationError)
        return res.status(400).json({ error: validationError });

    try {
        const user = await db.get(email);
        if (!user) return res.status(404).json({ error: "User not found." });

        const isPasswordValid = await validatePassword(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ error: "Invalid password." });
        }

        res.json({
            message: "Login successful.",
            profile: { email, username: user.username },
        });
    } catch (error) {
        next(error);
    }
});

// Fetch user profile
app.get("/profile", async (req, res) => {
    const { email } = req.query;

    if (!email) return res.status(400).json({ error: "Email is required." });

    try {
        const user = await db.get(email);
        if (!user) return res.status(404).json({ error: "User not found." });

        res.json({ profile: user });
    } catch (error) {
        console.error("Error fetching profile:", error.message);
        res.status(500).json({ error: "An error occurred. Please try again." });
    }
});

// Update user profile
app.put("/profile", async (req, res) => {
    const { email, username, phone } = req.body;

    if (!email || !username)
        return res
            .status(400)
            .json({ error: "Email and username are required." });

    try {
        const user = await db.get(email);
        if (!user) return res.status(404).json({ error: "User not found." });

        // Update profile fields
        user.username = username;
        if (phone) user.phone = phone;

        await db.set(email, user);
        res.json({ message: "Profile updated successfully.", profile: user });
    } catch (error) {
        console.error("Error updating profile:", error.message);
        res.status(500).json({ error: "An error occurred. Please try again." });
    }
});

// Password recovery

app.post("/recover-password", async (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ error: "Email is required." });
    }

    try {
        const user = await db.get(email);
        if (!user) {
            return res.status(404).json({ error: "User not found." });
        }

        // Generate a new temporary password
        const newPassword = Math.random().toString(36).slice(-8); // Generate an 8-character password
        const hashedPassword = await bcrypt.hash(newPassword, 10); // Hash the new password
        user.password = hashedPassword;

        await db.set(email, user); // Save the updated user with the new hashed password

        // Send the new password to the user via email
        const emailSuccess = await sendEmail(
            email,
            "Password Recovery",
            `Your new password is: ${newPassword}`,
            `<p>Your new password is: <strong>${newPassword}</strong></p>`,
        );

        if (!emailSuccess) {
            return res.status(500).json({
                error: "Failed to send recovery email. Please try again later.",
            });
        }

        res.json({ message: "New password sent to your email." });
    } catch (error) {
        console.error("Error during password recovery:", error.message);
        res.status(500).json({
            error: "An error occurred. Please try again later.",
        });
    }
});

// Update user account information
app.put("/update-account", async (req, res) => {
    const { email, username, newPassword } = req.body;

    const validationError = validateInput(req.body, ["email", "username"]);
    if (validationError)
        return res.status(400).json({ error: validationError });

    try {
        const user = await db.get(email);
        if (!user) return res.status(404).json({ error: "User not found." });

        user.username = username;
        if (newPassword) user.password = hashPassword(newPassword);

        await db.set(email, user);
        res.json({ message: "Account updated successfully.", profile: user });
    } catch (error) {
        next(error);
    }
});

// Checkout route
app.post("/checkout", async (req, res) => {
    try {
        console.log("Checkout initiated:", req.body);

        const { items, email } = req.body;
        if (!items || !Array.isArray(items) || !email) {
            throw new Error("Invalid cart data or missing email.");
        }
        // Check if the user already has a profile
        let userProfile = await db.get(email);

        // Notify users of skeleton profile creation
        if (!userProfile) {
            userProfile = {
                email,
                username: null,
                phone: null,
                purchaseHistory: [],
                notified: false, // Add notified flag
            };
            await db.set(email, userProfile);
        }

        if (!userProfile.notified) {
            await sendEmail(
                email,
                "Welcome to Your New Profile",
                "We've created a profile for you to track your purchases.",
                `<p>Hello, art enjoyer! We've created a profile for you to track your purchases! Complete your profile to enjoy more features.</p>`,
            );

            userProfile.notified = true; // Update flag
            await db.set(email, userProfile);
        }

        // Validate all items in the cart
        const isValidItem = (item) => {
            return (
                typeof item.name === "string" &&
                typeof item.amount === "number" &&
                item.amount > 0
            );
        };

        if (!items.every(isValidItem)) {
            throw new Error("One or more items in the cart are invalid.");
        }

        const total = calculateTotal(items);

        // Create Stripe Payment Intent
        const paymentIntent = await stripe.paymentIntents.create({
            amount: total,
            currency: "usd",
        });

        console.log("Payment Intent created:", paymentIntent);

        // Respond with the client secret for payment confirmation
        res.json({ clientSecret: paymentIntent.client_secret });
    } catch (error) {
        console.error("Error during checkout:", error.message);
        res.status(500).json({ error: error.message });
    }
});

// Endpoint to handle file purchase and email delivery
app.post("/send-file", async (req, res) => {
    const { email, fileId, fileName } = req.body;

    if (!email || !fileId || !fileName) {
        return res
            .status(400)
            .json({ error: "Email, fileId, and fileName are required." });
    }

    try {
        // Fetch the file from Google Drive
        const fileStream = await fetchFile(fileId);

        // Send the file via email
        const emailSuccess = await sendEmail(
            email,
            "Your Purchased File",
            "Thank you for your purchase! Here is your file.",
            fileStream,
            fileName,
        );

        if (!emailSuccess) {
            return res.status(500).json({
                error: "Failed to send file. Please try again later.",
            });
        }

        res.json({ message: "File sent successfully." });
    } catch (error) {
        next(error);
    }
});

// Update a user's purchase history
app.post("/update-purchase", async (req, res) => {
    const { email, fileId, fileName } = req.body;

    if (!email || !fileId || !fileName) {
        return res
            .status(400)
            .json({ error: "Email, fileId, and fileName are required." });
    }

    try {
        const user = await db.get(email);
        if (!user) return res.status(404).json({ error: "User not found." });

        const newPurchase = {
            fileId,
            fileName,
            purchaseDate: new Date().toISOString(),
        };

        user.purchaseHistory.push(newPurchase);

        await db.set(email, user);
        res.json({ message: "Purchase history updated.", profile: user });
    } catch (error) {
        next(error);
    }
});

// Middleware for error handling
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: err.message || "Internal server error" });
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
