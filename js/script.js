
// ===============================
// MOBILE MENU
// ===============================

const menuToggle = document.querySelector(".menu-toggle");
const nav = document.querySelector("#mainNav");

if (menuToggle && nav) {

    menuToggle.setAttribute("aria-expanded", "false");

    menuToggle.addEventListener("click", () => {

        const isOpen = nav.classList.toggle("open");

        menuToggle.setAttribute(
            "aria-expanded",
            String(isOpen)
        );

    });

}


// ===============================
// CLOSE MOBILE MENU AFTER CLICKING A LINK
// ===============================

document.querySelectorAll(".nav a").forEach(link => {

    link.addEventListener("click", () => {

        if (nav && menuToggle) {

            nav.classList.remove("open");

            menuToggle.setAttribute(
                "aria-expanded",
                "false"
            );

        }

    });

});


// ===============================
// CLOSE MENU USING ESCAPE KEY
// ===============================

document.addEventListener("keydown", event => {

    if (event.key === "Escape" && nav && menuToggle) {

        nav.classList.remove("open");

        menuToggle.setAttribute(
            "aria-expanded",
            "false"
        );

    }

});


// ===============================
// CURRENT YEAR
// ===============================

const year = document.getElementById("year");

if (year) {

    year.textContent = new Date().getFullYear();

}


// ===============================
// GENERAL WEBSITE JAVASCRIPT
// ===============================

// Add other general website functions here.
//
// IMPORTANT:
// Do NOT put order form code here.
//
// Order form functionality is handled by:
// js/order.js
