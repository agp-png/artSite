
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// Configure CORS and middleware
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type']
}));

app.use(express.json());
app.use(express.static('.', { index: 'index.html' }));

// Logging middleware
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
        return sum + parseInt(item.amount, 10);
    }, 0);
}

// Helper function to create a Payment Intent
async function createPaymentIntent(amount, currency = 'usd') {
    return await stripe.paymentIntents.create({
        amount,
        currency,
    });
}

// Route to get Stripe publishable key
app.get('/config', (req, res) => {
    if (!process.env.STRIPE_PUBLISHABLE_KEY) {
        return res.status(500).json({ error: 'Stripe publishable key not configured' });
    }
    res.json({ publishableKey: process.env.STRIPE_PUBLISHABLE_KEY });
});

const isValidItem = (item) => {
    return (
        typeof item.name === 'string' &&
        typeof item.amount === 'number' &&
        item.amount > 0
    );
};

// Checkout route
app.post('/checkout', async (req, res) => {
    try {
        console.log('Checkout initiated:', req.body);

        const { items } = req.body;
        if (!items || !Array.isArray(items)) {
            throw new Error('Invalid cart data received.');
        }

        if (!items.every(isValidItem)) {
            throw new Error('One or more items in the cart are invalid.');
        }

        const total = calculateTotal(items);
        console.log('Total calculated:', total);

        const paymentIntent = await createPaymentIntent(total);
        console.log('Payment Intent created:', paymentIntent);

        res.json({ clientSecret: paymentIntent.client_secret });
    } catch (error) {
        console.error('Error during checkout:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on port ${PORT}`);
});
