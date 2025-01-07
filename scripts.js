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
        displayFeedback("Payment system initialized successfully.", "success");
    } catch (error) {
        console.error("Error initializing Stripe:", error);
        displayFeedback(
            "Error initializing payment system. Please try again later.",
            "error",
        );
    }
}

// Call initializeStripe on page load
initializeStripe();

// Utility function to display feedback messages
function displayFeedback(message, type = "success") {
    const feedbackElement = document.getElementById("feedback");
    feedbackElement.style.display = "block";
    feedbackElement.style.color = type === "success" ? "green" : "red";
    feedbackElement.textContent = message;

    // Auto-hide feedback after 5 seconds
    setTimeout(() => {
        feedbackElement.style.display = "none";
    }, 5000);
}

// Cart functionality
let cart = JSON.parse(localStorage.getItem("cart")) || [];

function addToCart(itemName, amount) {
    console.log(`Adding to cart: ${itemName} - $${amount / 100}`);

    // Check if item already exists in cart
    if (cart.some((item) => item.name === itemName)) {
        displayFeedback(
            "You already have this photo set in your cart. Only one copy per customer is allowed.",
            "error",
        );
        return;
    }

    cart.push({ name: itemName, amount });
    localStorage.setItem("cart", JSON.stringify(cart));
    updateCartDisplay();
    displayFeedback("Item added to cart successfully.", "success");
}

function updateCartDisplay() {
    const cartItemsContainer = document.getElementById("cart-items");
    const totalContainer = document.getElementById("cart-total");
    cartItemsContainer.innerHTML = "";

    let total = 0;

    cart.forEach(({ name, amount }) => {
        const cartItem = document.createElement("div");
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
        displayFeedback("Item removed from cart.", "success");
    }
}

// Payment processing
async function handleCheckout(event) {
    event.preventDefault();

    if (cart.length === 0) {
        displayFeedback(
            "Your cart is empty. Add items before checking out.",
            "error",
        );
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
            displayFeedback(`Payment failed: ${result.error.message}`, "error");
        } else {
            console.log("Payment successful:", result.paymentIntent);
            displayFeedback(
                "Payment successful! Thank you for your purchase.",
                "success",
            );
            cart = [];
            localStorage.removeItem("cart");
            updateCartDisplay();
            overlay.style.display = "none";
            checkoutForm.style.display = "none";
        }
    } catch (error) {
        console.error("Checkout error:", error);
        displayFeedback(
            "An error occurred during checkout. Please try again later.",
            "error",
        );
    }
}

// Attach event listeners to buttons
document.querySelectorAll(".add-to-cart").forEach((button) => {
    button.addEventListener("click", function () {
        const itemName = this.getAttribute("data-name");
        const amount = parseInt(this.getAttribute("data-price"));

        if (!itemName || isNaN(amount)) {
            console.error("Invalid item data:", { itemName, amount });
            displayFeedback(
                "There was an issue adding this item to your cart.",
                "error",
            );
            return;
        }

        addToCart(itemName, amount);
    });
});

// Function to handle profile creation
async function handleProfileCreation(event) {
    event.preventDefault();
    const email = document.getElementById("profile-email").value;
    const username = document.getElementById("profile-username").value;
    const password = document.getElementById("profile-password").value;
    const phone = document.getElementById("profile-phone").value;

    if (!email || !username || !password) {
        alert("Please fill out all required fields.");
        return;
    }

    try {
        const response = await fetch("/create-profile", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, username, password, phone }),
        });

        if (!response.ok) {
            throw new Error("Failed to create profile.");
        }

        const data = await response.json();
        profileCreated = true;
        alert(data.message || "Profile created successfully.");
        document.getElementById("profile-modal").style.display = "none";
    } catch (error) {
        console.error("Error creating profile:", error);
        alert("Failed to create profile. Please try again later.");
    }
}

// Attach event listener for profile form submission
document
    .getElementById("profile-form")
    .addEventListener("submit", handleProfileCreation);

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
