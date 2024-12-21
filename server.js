const cors = require('cors');
const express = require('express');

require('dotenv').config();

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY); // Initialize Stripe once
const app = express();
app.use(cors());

// Middleware to parse JSON and log requests
app.use(express.json());
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

// Helper function to calculate the total amount
function calculateTotal(items) {
    if (!items || !Array.isArray(items)) {
        throw new Error('Invalid items array');
    }
    
    return items.reduce((sum, item) => {
        if (!item.amount || isNaN(item.amount) || item.amount <= 0) {
            throw new Error(`Invalid amount for item: ${JSON.stringify(item)}`);
        }
        return sum + parseInt(item.amount, 10); // Ensure integer and valid amount
    }, 0);
}

// Helper function to create a Payment Intent
async function createPaymentIntent(amount, currency = 'usd') {
    return await stripe.paymentIntents.create({
        amount,
        currency,
    });
}

// Root route
app.get('/', (req, res) => {
    res.send('Stripe server is running!');
});

// Test route
app.post('/test', (req, res) => {
    console.log('Test endpoint hit!');
    res.send('Test successful!');
});

//route to dynamically call for publishable key
app.get('/config', (req, res) => {
    res.json({ publishableKey: process.env.STRIPE_PUBLISHABLE_KEY });
});

const isValidItem = (item) => {
    return (
        typeof item.name === 'string' && // name must be a string
        typeof item.amount === 'number' && // amount must be a number
        item.amount > 0 // amount must be positive
    );
};


// Checkout route for creating a Payment Intent
app.post('/checkout', async (req, res) => {
    try {
        console.log('Checkout initiated:', req.body);

        const { items } = req.body; // Extract cart items
        if (!items || !Array.isArray(items)) {
            throw new Error('Invalid cart data received.');
        }

        // Inject validation logic here
        if (!items.every(isValidItem)) {
            throw new Error('One or more items in the cart are invalid.');
        }

        const total = calculateTotal(items); // Calculate total in cents
        console.log('Total calculated:', total);

        const paymentIntent = await createPaymentIntent(total); // Create Payment Intent
        console.log('Payment Intent created:', paymentIntent);

        res.json({ clientSecret: paymentIntent.client_secret }); // Send client secret to frontend
    } catch (error) {
        console.error('Error during checkout:', error.message);
        res.status(500).json({ error: error.message }); // Send error response
    }
});



// Informational route for POST expectation
app.get('/create-payment-intent', (req, res) => {
    res.send('This route expects a POST request to create a payment intent.');
});

//
app.use((req, res, next) => {
    res.status(404).send('Route not Found');
});


// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
