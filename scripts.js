
// Declare variables to hold Stripe-related objects
let stripe, elements, cardElement, stripeConfig;

 // Initialize Stripe elements and mount the card element
//  elements = stripe.elements();
//  cardElement = elements.create('card');
//  cardElement.mount('#card-element'); // Mount card element to the DOM placeholder

// Async function to fetch Stripe configuration and initialize Stripe
async function fetchConfig() {
    try {
        // Fetch the configuration from the server
        const response = await fetch('/config'); // Fetch from your server
        stripeConfig = await response.json(); // Parse the JSON response

        // Initialize Stripe with the fetched publishable key
        stripe = Stripe(stripeConfig.publishableKey); // Replace with your endpoint key field

        // // Initialize Stripe elements and mount the card element
        elements = stripe.elements();
        cardElement = elements.create('card');
        cardElement.mount('#card-element'); // Mount card element to the DOM placeholder

        console.log('Stripe initialized successfully with elements:', { stripe, elements });
        
        // Return initialized Stripe instance for future use
        return { stripe, elements };
    } catch (error) {
        console.error('Error initializing Stripe:', error); // Handle errors
        alert('Error initializing payment system. Please try again later.');
    }
}

// Call fetchConfig on page load or wherever necessary
fetchConfig();

// Cart array to hold added items
let cart = JSON.parse(localStorage.getItem('cart')) || [];

// Function to add item to cart
function addToCart(itemName, amount) {
    console.log(`addToCart called with: itemName=${itemName}, amount=${amount}`);
    
    // Check if item already exists in cart
    if (cart.some(item => item.name === itemName)) {
        alert('You already have this photo set in your cart. Only one copy per customer is allowed.');
        return;
    }
    
    // Add the item to the cart array
    cart.push({ name: itemName, amount });
    console.log('Update cart:', cart); //log cart contents
    // Save the updated cart in localStorage
    localStorage.setItem('cart', JSON.stringify(cart));
    // Update the DOM with the new item
    updateCartDisplay();
}

 // test cart display stuff
function updateCartDisplay() {
    console.log('updateCartDisplay called.');
    const cartItemsContainer = document.getElementById('cart-items');
    const totalContainer = document.getElementById('cart-total');
    cartItemsContainer.innerHTML = ''; // Clear the cart display

    let total = 0;

    cart.forEach(({ name, amount }) => {
        const cartItem = document.createElement('cart-item'); // Simple text display*
        cartItem.textContent = `${name}: $${(amount / 100).toFixed(2)}`;
        cartItemsContainer.appendChild(cartItem);

            // Add thumbnail image
    const thumbnailContainer = document.querySelector(`[data-name="${name}"]`).closest('.thumbnail'); // Find the closest .thumbnail
    if (thumbnailContainer) {
        const img = thumbnailContainer.querySelector('img'); // Find the image inside .thumbnail
        if (img) {
            const thumbnailImg = document.createElement('img');
            thumbnailImg.src = img.src; // Get the source of the image
            thumbnailImg.alt = name; // Set alt text
            thumbnailImg.classList.add('cart-thumbnail'); // Add a class for styling
            cartItem.appendChild(thumbnailImg); // Append to the cart item
         
        } else {
            console.error(`No image found in thumbnail container for item: ${name}`);
        }
    } else {
        console.error(`No thumbnail container found for item: ${name}`);
    }

        //REMOVE BUTTON
        const removeButton = document.createElement('button');
        removeButton.textContent = 'Remove';
        removeButton.onclick = function () {
            removeFromCart(name); // Use the name to remove the correct item
        };
        
        removeButton.setAttribute('aria-label', `Remove ${name} from cart`);
        cartItem.appendChild(removeButton);

        total += amount;
    });

    // Update the total price display
    totalContainer.textContent = `Total: $${(total / 100).toFixed(2)}`; // Display the total
}



// Function to remove items from the cart
function removeFromCart(name) {
    console.log(`removeFromCart called for: name=${name}`); // Debug
    const itemIndex = cart.findIndex(item => item.name === name); // Find index by name
    if (itemIndex > -1) { // Check if item exists
        console.log(`Item found at index ${itemIndex}, removing it.`); // Debug
        cart.splice(itemIndex, 1); // Remove the item from the array
        localStorage.setItem('cart', JSON.stringify(cart)); // Update localStorage
        updateCartDisplay(); // Refresh cart display
    } else {
        console.log(`Item with name=${name} not found in cart.`);
    }
}

//simpler version
// function removeFromCart(name) {
//     cart = cart.filter(item => item.name !== name);
//     localStorage.setItem('cart', JSON.stringify(cart));
//     updateCartDisplay();
// }


// Function to handle checkout
async function handleCheckout() {
    console.log('Checkout button clicked. Sending cart to server:', cart);

    if (cart.length === 0) {
        alert('Your cart is empty. Add items before checking out.');
        return;
    }

    try {
        const response = await fetch('http://127.0.0.1:3000/checkout', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ items: cart }),
        });

        if (response.ok) {           
            const data = await response.json(); // Parse and assign the JSON response
            // Confirm payment
            const result = await stripe.confirmCardPayment(data.clientSecret, {
                payment_method: {
                    card: cardElement,
                    billing_details: { name: document.getElementById('name').value, email: document.getElementById('email').value },
                },
            })
            console.log('Client secret received from backend:', data.clientSecret);


            if (result.error) {
                console.error('Payment failed:', result.error.message);
                alert(`Payment failed: ${result.error.message}`);
            } else {
                console.log('Payment successful:', result.paymentIntent);
                alert('Payment successful! Thank you for your purchase.');
            }
        } else {
            const errorData = await response.json(); // Parse and log error response
            console.error('Checkout failed:', errorData.error);
            alert(`Checkout failed: ${errorData.error}`);
        }
    } catch (error) {
        console.error('Error during checkout:', error);
        alert('An error occurred during checkout. Please try again later.');
    }
}

// Attach event listeners to all "Add to Cart" buttons
document.querySelectorAll('.add-to-cart').forEach(button => {
    button.addEventListener('click', function () {
        const itemName = this.getAttribute('data-name'); // Get item name
        const amount = parseInt(this.getAttribute('data-price')); // Get item price
        console.log(`Add to Cart button clicked: itemName=${itemName}, amount=${amount}`);
        
        // Error handling for missing or invalid data
        if (!itemName || isNaN(amount)) {
            console.error("Invalid itemName or amount:", itemName, amount);
            alert("There was an issue adding this item to your cart. Please try again.");
            return; // Stop execution if invalid
        }

        addToCart(itemName, amount);
    });
});
//ATTEMPTING TO INTEGRATE APPEARING CHECKOUT
// Get references to elements
const checkoutButton = document.getElementById('checkout-button');
const overlay = document.getElementById('overlay');
const checkoutForm = document.getElementById('checkout-form');

// Show the overlay and form
checkoutButton.addEventListener('click', () => {
    overlay.style.display = 'block';
    checkoutForm.style.display = 'block';
});

// Hide the overlay when clicking outside the form
overlay.addEventListener('click', (event) => {
    if (event.target === overlay) { // Ensure the click is outside the form
        overlay.style.display = 'none';
        checkoutForm.style.display = 'none';
    }
});



checkoutForm.addEventListener('submit', event => {
    event.preventDefault(); // Prevent form reload
    handleCheckout();
});


// Load cart items from localStorage when the page is loaded
window.onload = function () {
    updateCartDisplay(); // Display existing cart items
};