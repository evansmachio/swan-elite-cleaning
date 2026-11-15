
const API_URL = "http://localhost:5000";
const WHATSAPP_NUMBER = "254793525224";

/* =========================================
   LOAD SERVICES FROM MYSQL DATABASE
========================================= */

async function loadServices() {
    const serviceSelect = document.getElementById("service_id");

    if (!serviceSelect) {
        console.error("Service select element not found.");
        return;
    }

    try {
        serviceSelect.innerHTML =
            '<option value="">Loading services...</option>';

        const response = await fetch(`${API_URL}/api/services`);
        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.message || "Could not load services.");
        }

        if (!Array.isArray(data.services)) {
            throw new Error("Invalid services response.");
        }

        serviceSelect.innerHTML =
            '<option value="">-- Select a Service --</option>';

        data.services.forEach(service => {
            const option = document.createElement("option");

            option.value = service.id;
            option.textContent = service.name;

            serviceSelect.appendChild(option);
        });

        if (data.services.length === 0) {
            serviceSelect.innerHTML =
                '<option value="">No services currently available</option>';
            return;
        }

        // Automatically select a service passed in the URL.
        const params = new URLSearchParams(window.location.search);
        const requestedService = params.get("service");

        if (requestedService) {
            const matchingOption = Array.from(serviceSelect.options)
                .find(option =>
                    option.textContent.toLowerCase() ===
                    requestedService.toLowerCase()
                );

            if (matchingOption) {
                serviceSelect.value = matchingOption.value;
            }
        }

        console.log("Services loaded successfully:", data.services);

    } catch (error) {
        console.error("SERVICE LOADING ERROR:", error);

        serviceSelect.innerHTML =
            '<option value="">Unable to load services. Refresh the page.</option>';
    }
}


/* =========================================
   ORDER FORM SUBMISSION
========================================= */

const orderForm = document.getElementById("orderForm");

if (orderForm) {
    orderForm.addEventListener("submit", async function(event) {
        event.preventDefault();

        const messageBox = document.getElementById("orderMessage");
        const submitButton = orderForm.querySelector(
            'button[type="submit"]'
        );

        const serviceSelect = document.getElementById("service_id");

        // Prevent duplicate submissions.
        if (submitButton && submitButton.disabled) {
            return;
        }

        // Validate selected service.
        if (!serviceSelect.value) {
            showMessage("Please select a service.", "error");
            return;
        }

        const selectedOption =
            serviceSelect.options[serviceSelect.selectedIndex];

        // Collect customer information.
        const orderData = {
            name: document.getElementById("name").value.trim(),
            phone: document.getElementById("phone").value.trim(),
            email: "",
            location: document.getElementById("location").value.trim(),
            service_id: serviceSelect.value,
            preferred_date: document.getElementById("preferred_date").value,
            preferred_time: document.getElementById("preferred_time").value,
            message: document.getElementById("message").value.trim()
        };

        // Additional basic validation.
        if (
            !orderData.name ||
            !orderData.phone ||
            !orderData.location ||
            !orderData.service_id ||
            !orderData.preferred_date
        ) {
            showMessage("Please complete all required fields.", "error");
            return;
        }

        /*
         * Open a blank tab immediately after the user's click.
         * This helps prevent the browser from blocking WhatsApp
         * after the database request finishes.
         */
        const whatsappWindow = window.open("about:blank", "_blank");

        if (whatsappWindow) {
            whatsappWindow.opener = null;
        }

        if (submitButton) {
            submitButton.disabled = true;
            submitButton.textContent = "Saving Order...";
        }

        showMessage("Saving your order. Please wait...", "info");

        try {
            // Send order to the Node.js backend.
            const response = await fetch(`${API_URL}/api/orders`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(orderData)
            });

            const data = await response.json();

            console.log("SERVER RESPONSE:", data);

            if (!response.ok || !data.success) {
                throw new Error(
                    data.message || "Unable to save your order."
                );
            }

            const orderId = data.order_id;
            const serviceName = selectedOption.textContent;

            // Prepare WhatsApp message.
            const whatsappMessage =
`Hello Swan Elite Cleaning and Pest Control Services.

I would like to order a service.

Order Number: #${orderId}

Name: ${orderData.name}

Phone: ${orderData.phone}

Location: ${orderData.location}

Service: ${serviceName}

Preferred Date: ${orderData.preferred_date}

Preferred Time: ${orderData.preferred_time || "Not specified"}

Additional Information:
${orderData.message || "None"}

Thank you.`;

            const whatsappURL =
                `https://wa.me/${WHATSAPP_NUMBER}?text=${
                    encodeURIComponent(whatsappMessage)
                }`;

            // Redirect the already-opened tab to WhatsApp.
            if (whatsappWindow && !whatsappWindow.closed) {
                whatsappWindow.location.href = whatsappURL;
            }

            // Clear form after successful database save.
            orderForm.reset();

            if (whatsappWindow) {
                showMessage(
                    `Order #${orderId} saved successfully! Please complete sending your request in WhatsApp.`,
                    "success"
                );
            } else {
                showMessage(
                    `Order #${orderId} saved successfully! Your browser blocked WhatsApp. Open WhatsApp manually and contact ${WHATSAPP_NUMBER}.`,
                    "success"
                );
            }

            console.log("ORDER SAVED:", orderId);

        } catch (error) {
            console.error("ORDER SUBMISSION ERROR:", error);

            if (whatsappWindow && !whatsappWindow.closed) {
                whatsappWindow.close();
            }

            showMessage(
                error.message ||
                "Unable to connect to the server. Please try again.",
                "error"
            );

        } finally {
            if (submitButton) {
                submitButton.disabled = false;
                submitButton.textContent = "Send Order via WhatsApp →";
            }
        }
    });
}


/* =========================================
   DISPLAY FORM MESSAGES
========================================= */

function showMessage(message, type) {
    const messageBox = document.getElementById("orderMessage");

    if (!messageBox) return;

    messageBox.textContent = message;

    messageBox.style.display = "block";
    messageBox.style.padding = "14px";
    messageBox.style.borderRadius = "9px";
    messageBox.style.marginTop = "15px";

    if (type === "success") {
        messageBox.style.background = "#e8f8ef";
        messageBox.style.color = "#087d50";
    } else if (type === "error") {
        messageBox.style.background = "#fff0f0";
        messageBox.style.color = "#c0392b";
    } else {
        messageBox.style.background = "#edf5ff";
        messageBox.style.color = "#124d78";
    }
}


/* =========================================
   START APPLICATION
========================================= */

loadServices();
