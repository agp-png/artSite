// Stripe-related variables
let stripe, elements, cardElement, stripeConfig;

// Initialize Stripe elements when page loads
async function initializeStripe() {
    try {
        const response = await fetch("/config");
        stripeConfig = await response.json();
        stripe = Stripe(stripeConfig.publishableKey);
        elements = stripe.elements();
        cardElement = elements.create("card");
        cardElement.mount("#card-element");
    } catch (error) {
        console.error("Error initializing Stripe:", error);
        alert("Error initializing payment system. Please try again later.");
    }
}

// Call initializeStripe on page load
initializeStripe();

// Cart functionality
let cart = JSON.parse(localStorage.getItem("cart")) || [];

function addToCart(itemName, amount) {
    console.log(`Adding to cart: ${itemName} - $${amount / 100}`);

    // Check if item already exists in cart
    if (cart.some((item) => item.name === itemName)) {
        alert(
            "You already have this photo set in your cart. Only one copy per customer is allowed.",
        );
        return;
    }

    cart.push({ name: itemName, amount });
    localStorage.setItem("cart", JSON.stringify(cart));
    updateCartDisplay();
}

function updateCartDisplay() {
    const cartItemsContainer = document.getElementById("cart-items");
    const totalContainer = document.getElementById("cart-total");
    cartItemsContainer.innerHTML = "";

    let total = 0;

    cart.forEach(({ name, amount }) => {
        const cartItem = document.createElement("cart-item");
        cartItem.textContent = `${name}: $${(amount / 100).toFixed(2)}`;
        cartItemsContainer.appendChild(cartItem);

        // Add thumbnail image
        const thumbnailContainer = document
            .querySelector(`[data-name="${name}"]`)
            .closest(".thumbnail");
        if (thumbnailContainer) {
            const img = thumbnailContainer.querySelector("img");
            if (img) {
                const thumbnailImg = document.createElement("img");
                thumbnailImg.src = img.src;
                thumbnailImg.alt = name;
                thumbnailImg.classList.add("cart-thumbnail");
                cartItem.appendChild(thumbnailImg);
            }
        }

        // Add remove button
        const removeButton = document.createElement("button");
        removeButton.textContent = "Remove";
        removeButton.onclick = () => removeFromCart(name);
        removeButton.setAttribute("aria-label", `Remove ${name} from cart`);
        cartItem.appendChild(removeButton);

        total += amount;
    });

    totalContainer.textContent = `Total: $${(total / 100).toFixed(2)}`;
}

function removeFromCart(name) {
    const itemIndex = cart.findIndex((item) => item.name === name);
    if (itemIndex > -1) {
        cart.splice(itemIndex, 1);
        localStorage.setItem("cart", JSON.stringify(cart));
        updateCartDisplay();
    }
}

// Payment processing
async function handleCheckout(event) {
    event.preventDefault();

    if (cart.length === 0) {
        alert("Your cart is empty. Add items before checking out.");
        return;
    }

    try {
        const response = await fetch("/checkout", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ items: cart }),
        });

        if (!response.ok) {
            throw new Error("Network response was not ok");
        }

        const { clientSecret } = await response.json();

        const result = await stripe.confirmCardPayment(clientSecret, {
            payment_method: {
                card: cardElement,
                billing_details: {
                    name: document.getElementById("name").value,
                    email: document.getElementById("email").value,
                },
            },
        });

        if (result.error) {
            console.error("Payment failed:", result.error);
            alert(`Payment failed: ${result.error.message}`);
        } else {
            console.log("Payment successful:", result.paymentIntent);
            alert("Payment successful! Thank you for your purchase.");
            cart = [];
            localStorage.removeItem("cart");
            updateCartDisplay();
            overlay.style.display = "none";
            checkoutForm.style.display = "none";
        }
    } catch (error) {
        console.error("Checkout error:", error);
        alert("An error occurred during checkout. Please try again later.");
    }
}

// Event Listeners
document.querySelectorAll(".add-to-cart").forEach((button) => {
    button.addEventListener("click", function () {
        const itemName = this.getAttribute("data-name");
        const amount = parseInt(this.getAttribute("data-price"));

        if (!itemName || isNaN(amount)) {
            console.error("Invalid item data:", { itemName, amount });
            alert("There was an issue adding this item to your cart.");
            return;
        }

        addToCart(itemName, amount);
    });
});

// Checkout form display handling
const checkoutButton = document.getElementById("checkout-button");
const overlay = document.getElementById("overlay");
const checkoutForm = document.getElementById("checkout-form");

checkoutButton.addEventListener("click", () => {
    overlay.style.display = "block";
    checkoutForm.style.display = "block";
});

overlay.addEventListener("click", (event) => {
    if (event.target === overlay) {
        overlay.style.display = "none";
        checkoutForm.style.display = "none";
    }
});

// Attach checkout handler to form
document
    .getElementById("checkout-form-element")
    .addEventListener("submit", handleCheckout);

// Initialize cart display on page load
window.onload = function () {
    updateCartDisplay();
};
