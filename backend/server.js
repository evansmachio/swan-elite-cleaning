const express = require("express");
const cors = require("cors");
const bcrypt = require("bcrypt");
require("dotenv").config();

const db = require("./config/database");

const app = express();

app.use(cors());
app.use(express.json());


// ==========================================
// TEST API
// ==========================================

app.get("/", (req, res) => {

    res.json({
        success: true,
        message: "Swan Elite website backend is running"
    });

});


// ==========================================
// GET SERVICES
// ==========================================

app.get("/api/services", async (req, res) => {

    try {

        const [services] = await db.query(
            "SELECT * FROM services ORDER BY id DESC"
        );

        res.json({
            success: true,
            services
        });

    } catch (error) {

        console.error("SERVICES ERROR:", error);

        res.status(500).json({
            success: false,
            message: "Failed to load services"
        });

    }

});


// ==========================================
// CREATE ORDER
// SAVE ORDER + CREATE NOTIFICATIONS
// ==========================================

app.post("/api/orders", async (req, res) => {

    try {

        console.log("\n=================================");
        console.log("NEW ORDER RECEIVED");
        console.log("=================================");
        console.log(req.body);


        const {
            name,
            phone,
            email,
            location,
            service_id,
            preferred_date,
            preferred_time,
            message
        } = req.body;


        // ==========================================
        // VALIDATION
        // ==========================================

        if (
            !name ||
            !phone ||
            !location ||
            !service_id ||
            !preferred_date
        ) {

            return res.status(400).json({
                success: false,
                message: "Please fill in all required fields."
            });

        }


        // ==========================================
        // CHECK SERVICE
        // ==========================================

        const [services] = await db.query(
            "SELECT id, name FROM services WHERE id = ?",
            [service_id]
        );


        if (services.length === 0) {

            return res.status(400).json({
                success: false,
                message: "Selected service does not exist."
            });

        }


        const serviceName = services[0].name;


        console.log("SERVICE:", serviceName);


        // ==========================================
        // SAVE CUSTOMER
        // ==========================================

        const [customer] = await db.query(
            `INSERT INTO customers
            (name, phone, email, location)
            VALUES (?, ?, ?, ?)`,
            [
                name,
                phone,
                email || null,
                location
            ]
        );


        console.log(
            "CUSTOMER SAVED:",
            customer.insertId
        );


        // ==========================================
        // SAVE ORDER
        // ==========================================

        const [order] = await db.query(
            `INSERT INTO orders
            (
                customer_id,
                service_id,
                preferred_date,
                preferred_time,
                message
            )
            VALUES (?, ?, ?, ?, ?)`,
            [
                customer.insertId,
                service_id,
                preferred_date,
                preferred_time || null,
                message || null
            ]
        );


        const orderId = order.insertId;


        console.log(
            "ORDER SAVED:",
            orderId
        );


        // ==========================================
        // CREATE NOTIFICATION CONTENT
        // ==========================================

        const notificationTitle =
            `New Order #${orderId}`;


        const notificationMessage =
`New service order received.

Customer: ${name}
Phone: ${phone}
Service: ${serviceName}
Location: ${location}
Preferred Date: ${preferred_date}
Preferred Time: ${preferred_time || "Not specified"}

Additional Information:
${message || "None"}`;


        // ==========================================
        // GET ALL ACTIVE ADMINS
        // ==========================================

        const [admins] = await db.query(
            `SELECT id, full_name, role
             FROM admins
             WHERE is_active = 1`
        );


        console.log(
            "ACTIVE ADMINS FOUND:",
            admins
        );


        // ==========================================
        // CHECK IF ADMINS EXIST
        // ==========================================

        if (admins.length === 0) {

            console.warn(
                "WARNING: No active administrators found."
            );

        }


        // ==========================================
        // CREATE NOTIFICATIONS
        // ==========================================

        let notificationsCreated = 0;


        for (const admin of admins) {

            try {

                const [notification] = await db.query(
                    `INSERT INTO notifications
                    (
                        order_id,
                        recipient_id,
                        recipient_role,
                        title,
                        message,
                        is_read
                    )
                    VALUES (?, ?, ?, ?, ?, ?)`,
                    [
                        orderId,
                        admin.id,
                        admin.role,
                        notificationTitle,
                        notificationMessage,
                        false
                    ]
                );


                notificationsCreated++;


                console.log(
                    `NOTIFICATION CREATED FOR ${admin.full_name} (ID: ${notification.insertId})`
                );


            } catch (notificationError) {

                console.error(
                    `NOTIFICATION ERROR FOR ADMIN ${admin.id}:`,
                    notificationError
                );

            }

        }


        // ==========================================
        // FINAL RESPONSE
        // ==========================================

        console.log(
            `TOTAL NOTIFICATIONS CREATED: ${notificationsCreated}`
        );


        console.log("=================================\n");


        res.status(201).json({

            success: true,

            message:
                "Your service order has been received successfully. We will contact you shortly.",

            order_id: orderId,

            notifications_created:
                notificationsCreated

        });


    } catch (error) {

        console.error(
            "ORDER CREATION ERROR:",
            error
        );


        res.status(500).json({

            success: false,

            message:
                "Unable to place your order."

        });

    }

});

// ==========================================
// ADMIN LOGIN
// ==========================================

app.post("/api/admin-login", async (req, res) => {

    try {

        const {
            email,
            password
        } = req.body;


        // Validate fields

        if (!email || !password) {

            return res.status(400).json({

                success: false,

                message:
                    "Email and password are required."

            });

        }


        // Find administrator

        const [admins] = await db.query(

            `SELECT
                id,
                full_name,
                email,
                password,
                role,
                is_active

             FROM admins

             WHERE email = ?

             LIMIT 1`,

            [email]

        );


        // Administrator does not exist

        if (admins.length === 0) {

            return res.status(401).json({

                success: false,

                message:
                    "Invalid email or password."

            });

        }


        const admin = admins[0];


        // Check account status

        if (!admin.is_active) {

            return res.status(403).json({

                success: false,

                message:
                    "This administrator account is inactive."

            });

        }


        // Compare password

        const passwordMatches =
            await bcrypt.compare(
                password,
                admin.password
            );


        if (!passwordMatches) {

            return res.status(401).json({

                success: false,

                message:
                    "Invalid email or password."

            });

        }


        // Successful login

        console.log(
            `ADMIN LOGIN: ${admin.full_name} | ID: ${admin.id} | ROLE: ${admin.role}`
        );


        res.json({

            success: true,

            message:
                "Administrator login successful.",

            admin: {

                id: admin.id,

                full_name:
                    admin.full_name,

                email:
                    admin.email,

                role:
                    admin.role

            }

        });


    } catch (error) {

        console.error(
            "ADMIN LOGIN ERROR:",
            error
        );


        res.status(500).json({

            success: false,

            message:
                "Unable to process administrator login."

        });

    }

});

// ==========================================
// CREATE ADMIN ACCOUNT
// ==========================================

app.post("/api/admins", async (req, res) => {

    try {

        const {
            full_name,
            email,
            password,
            role
        } = req.body;


        // ==========================================
        // VALIDATION
        // ==========================================

        if (
            !full_name ||
            !email ||
            !password ||
            !role
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "All fields are required."

            });

        }


        // ==========================================
        // CHECK ROLE
        // ==========================================

        if (
            role !== "Admin" &&
            role !== "Overall Admin"
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Invalid administrator role."

            });

        }


        // ==========================================
        // CHECK EMAIL
        // ==========================================

        const [existingAdmin] = await db.query(
            "SELECT id FROM admins WHERE email = ?",
            [email]
        );


        if (existingAdmin.length > 0) {

            return res.status(409).json({

                success: false,

                message:
                    "An administrator with this email already exists."

            });

        }


        // ==========================================
        // HASH PASSWORD
        // ==========================================

        const hashedPassword =
            await bcrypt.hash(password, 10);


        // ==========================================
        // SAVE ADMIN
        // ==========================================

        const [result] = await db.query(
            `INSERT INTO admins
            (
                full_name,
                email,
                password,
                role,
                is_active
            )
            VALUES (?, ?, ?, ?, ?)`,
            [
                full_name,
                email,
                hashedPassword,
                role,
                true
            ]
        );


        console.log(
            `ADMIN CREATED: ${full_name} | ${role}`
        );


        res.status(201).json({

            success: true,

            message:
                "Administrator account created successfully.",

            admin_id:
                result.insertId

        });


    } catch (error) {

        console.error(
            "ADMIN CREATION ERROR:",
            error
        );


        res.status(500).json({

            success: false,

            message:
                "Unable to create administrator account."

        });

    }

});


// ==========================================
// GET NOTIFICATIONS
// ==========================================

app.get("/api/notifications/:adminId", async (req, res) => {

    try {

        const adminId = req.params.adminId;


        const [notifications] = await db.query(
            `SELECT
                n.id,
                n.order_id,
                n.recipient_id,
                n.recipient_role,
                n.title,
                n.message,
                n.is_read,
                n.created_at
             FROM notifications n
             WHERE n.recipient_id = ?
             ORDER BY n.created_at DESC`,
            [adminId]
        );


        res.json({

            success: true,

            notifications

        });


    } catch (error) {

        console.error(
            "NOTIFICATION FETCH ERROR:",
            error
        );


        res.status(500).json({

            success: false,

            message:
                "Unable to load notifications."

        });

    }

});


// ==========================================
// GET UNREAD NOTIFICATION COUNT
// ==========================================

app.get("/api/notifications/:adminId/unread-count", async (req, res) => {

    try {

        const adminId = req.params.adminId;


        const [result] = await db.query(
            `SELECT COUNT(*) AS unread_count
             FROM notifications
             WHERE recipient_id = ?
             AND is_read = 0`,
            [adminId]
        );


        res.json({

            success: true,

            unread_count:
                result[0].unread_count

        });


    } catch (error) {

        console.error(
            "UNREAD COUNT ERROR:",
            error
        );


        res.status(500).json({

            success: false,

            message:
                "Unable to get unread notification count."

        });

    }

});


// ==========================================
// MARK NOTIFICATION AS READ
// ==========================================

app.put("/api/notifications/:notificationId/read", async (req, res) => {

    try {

        const notificationId =
            req.params.notificationId;


        await db.query(
            `UPDATE notifications
             SET is_read = 1
             WHERE id = ?`,
            [notificationId]
        );


        res.json({

            success: true,

            message:
                "Notification marked as read."

        });


    } catch (error) {

        console.error(
            "MARK READ ERROR:",
            error
        );


        res.status(500).json({

            success: false,

            message:
                "Unable to update notification."

        });

    }

});

// ==========================================
// GET ALL SERVICE ORDERS
// ADMIN ORDERS PAGE
// ==========================================

app.get("/api/admin/orders", async (req, res) => {

    try {

        const [orders] = await db.query(`
            SELECT
                o.id,
                o.preferred_date,
                o.preferred_time,
                o.message,
                o.status,
                o.created_at,

                c.id AS customer_id,
                c.name AS customer_name,
                c.phone AS customer_phone,
                c.email AS customer_email,
                c.location AS customer_location,

                s.id AS service_id,
                s.name AS service_name,
                s.description AS service_description,
                s.price AS service_price

            FROM orders o

            INNER JOIN customers c
                ON o.customer_id = c.id

            INNER JOIN services s
                ON o.service_id = s.id

            ORDER BY o.created_at DESC
        `);


        res.json({

            success: true,

            orders

        });


    } catch (error) {

        console.error(
            "ADMIN ORDERS FETCH ERROR:",
            error
        );


        res.status(500).json({

            success: false,

            message:
                "Unable to load service orders."

        });

    }

});

// ==========================================
// UPDATE SERVICE ORDER STATUS
// ==========================================

app.put("/api/admin/orders/:orderId/status", async (req, res) => {

    try {

        const orderId = req.params.orderId;
        const { status } = req.body;


        // Allowed statuses

        const allowedStatuses = [
            "Pending",
            "Confirmed",
            "Completed",
            "Cancelled"
        ];


        if (!allowedStatuses.includes(status)) {

            return res.status(400).json({

                success: false,

                message: "Invalid order status."

            });

        }


        // Check that order exists

        const [orders] = await db.query(

            `SELECT id
             FROM orders
             WHERE id = ?`,

            [orderId]

        );


        if (orders.length === 0) {

            return res.status(404).json({

                success: false,

                message: "Order not found."

            });

        }


        // Update status

        await db.query(

            `UPDATE orders
             SET status = ?
             WHERE id = ?`,

            [
                status,
                orderId
            ]

        );


        console.log(
            `ORDER #${orderId} STATUS UPDATED: ${status}`
        );


        res.json({

            success: true,

            message:
                `Order #${orderId} has been marked as ${status}.`

        });


    } catch (error) {

        console.error(
            "ORDER STATUS UPDATE ERROR:",
            error
        );


        res.status(500).json({

            success: false,

            message:
                "Unable to update order status."

        });

    }

});

// ==========================================
// GET ALL CUSTOMERS
// ==========================================

app.get("/api/admin/customers", async (req, res) => {

    try {

        const [customers] = await db.query(`
            
            SELECT
                c.id,
                c.name,
                c.phone,
                c.email,
                c.location,
                c.created_at,

                COUNT(o.id) AS total_orders,

                MAX(o.created_at) AS last_order_date

            FROM customers c

            LEFT JOIN orders o
                ON c.id = o.customer_id

            GROUP BY
                c.id,
                c.name,
                c.phone,
                c.email,
                c.location,
                c.created_at

            ORDER BY c.created_at DESC

        `);


        res.json({

            success: true,

            customers: customers

        });


    } catch (error) {

        console.error(
            "GET CUSTOMERS ERROR:",
            error
        );


        res.status(500).json({

            success: false,

            message: "Unable to load customers."

        });

    }

});

// ==========================================
// ADD NEW SERVICE
// ==========================================

app.post("/api/admin/services", async (req, res) => {

    try {

        const {
            name,
            description,
            price
        } = req.body;


        // Validate service name

        if (!name || !name.trim()) {

            return res.status(400).json({

                success: false,

                message: "Service name is required."

            });

        }


        // Insert service

        const [result] = await db.query(

            `INSERT INTO services
            (name, description, price)
            VALUES (?, ?, ?)`,

            [
                name.trim(),
                description
                    ? description.trim()
                    : null,
                price
                    ? price.trim()
                    : "Request Quote"
            ]

        );


        res.status(201).json({

            success: true,

            message: "Service added successfully.",

            serviceId: result.insertId

        });


    } catch (error) {

        console.error(
            "ADD SERVICE ERROR:",
            error
        );


        res.status(500).json({

            success: false,

            message: "Unable to add service."

        });

    }

});


// ==========================================
// UPDATE SERVICE
// ==========================================

app.put("/api/admin/services/:serviceId", async (req, res) => {

    try {

        const serviceId =
            req.params.serviceId;

        const {
            name,
            description,
            price
        } = req.body;


        if (!name || !name.trim()) {

            return res.status(400).json({

                success: false,

                message: "Service name is required."

            });

        }


        // Check service exists

        const [services] = await db.query(

            `SELECT id
             FROM services
             WHERE id = ?`,

            [serviceId]

        );


        if (services.length === 0) {

            return res.status(404).json({

                success: false,

                message: "Service not found."

            });

        }


        // Update service

        await db.query(

            `UPDATE services

             SET
                name = ?,
                description = ?,
                price = ?

             WHERE id = ?`,

            [
                name.trim(),

                description
                    ? description.trim()
                    : null,

                price
                    ? price.trim()
                    : "Request Quote",

                serviceId
            ]

        );


        res.json({

            success: true,

            message: "Service updated successfully."

        });


    } catch (error) {

        console.error(
            "UPDATE SERVICE ERROR:",
            error
        );


        res.status(500).json({

            success: false,

            message: "Unable to update service."

        });

    }

});

// ==========================================
// REPORTS
// ==========================================

app.get("/api/admin/reports", async (req, res) => {

    try {

        // ------------------------------------------
        // ORDER SUMMARY
        // ------------------------------------------

        const [orderSummary] = await db.query(`
            SELECT
                COUNT(*) AS total_orders,

                SUM(status = 'Pending') AS pending_orders,

                SUM(status = 'Confirmed') AS confirmed_orders,

                SUM(status = 'Completed') AS completed_orders,

                SUM(status = 'Cancelled') AS cancelled_orders

            FROM orders
        `);


        // ------------------------------------------
        // TOTAL CUSTOMERS
        // ------------------------------------------

        const [customerSummary] = await db.query(`
            SELECT COUNT(*) AS total_customers
            FROM customers
        `);


        // ------------------------------------------
        // TOTAL SERVICES
        // ------------------------------------------

        const [serviceSummary] = await db.query(`
            SELECT COUNT(*) AS total_services
            FROM services
        `);


        // ------------------------------------------
        // ORDERS BY SERVICE
        // ------------------------------------------

        const [servicePerformance] = await db.query(`
            SELECT
                s.id,
                s.name,
                COUNT(o.id) AS total_orders
            FROM services s
            LEFT JOIN orders o
                ON s.id = o.service_id
            GROUP BY
                s.id,
                s.name
            ORDER BY total_orders DESC, s.name ASC
        `);


        // ------------------------------------------
        // ORDERS BY STATUS
        // ------------------------------------------

        const [statusBreakdown] = await db.query(`
            SELECT
                status,
                COUNT(*) AS total
            FROM orders
            GROUP BY status
            ORDER BY total DESC
        `);


        // ------------------------------------------
        // MONTHLY ORDERS
        // LAST 6 MONTHS
        // ------------------------------------------

        const [monthlyOrders] = await db.query(`
            SELECT
                DATE_FORMAT(created_at, '%Y-%m') AS month,
                DATE_FORMAT(created_at, '%b %Y') AS month_name,
                COUNT(*) AS total_orders
            FROM orders
            WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 5 MONTH)
            GROUP BY
                DATE_FORMAT(created_at, '%Y-%m'),
                DATE_FORMAT(created_at, '%b %Y')
            ORDER BY month ASC
        `);


        // ------------------------------------------
        // SEND REPORT
        // ------------------------------------------

        res.json({

            success: true,

            report: {

                orders: orderSummary[0],

                customers: customerSummary[0],

                services: serviceSummary[0],

                servicePerformance,

                statusBreakdown,

                monthlyOrders

            }

        });

    } catch (error) {

        console.error("REPORTS ERROR:", error);

        res.status(500).json({

            success: false,

            message: "Unable to load reports."

        });

    }

});



// ======================================================
// ADMINISTRATORS
// ======================================================

// GET ALL ADMINISTRATORS
app.get("/api/admin/administrators", async (req, res) => {
    try {

        const [admins] = await db.query(`
            SELECT
                id,
                full_name,
                email,
                role,
                is_active,
                created_at
            FROM admins
            ORDER BY created_at DESC
        `);

        res.json({
            success: true,
            administrators: admins
        });

    } catch (error) {

        console.error("GET ADMINISTRATORS ERROR:", error);

        res.status(500).json({
            success: false,
            message: "Unable to load administrators."
        });
    }
});


// CREATE ADMINISTRATOR
app.post("/api/admin/administrators", async (req, res) => {
    try {

        const {
            full_name,
            email,
            password,
            role
        } = req.body;


        if (!full_name || !email || !password || !role) {

            return res.status(400).json({
                success: false,
                message: "All administrator fields are required."
            });
        }


        if (!["Admin", "Overall Admin"].includes(role)) {

            return res.status(400).json({
                success: false,
                message: "Invalid administrator role."
            });
        }


        if (password.length < 6) {

            return res.status(400).json({
                success: false,
                message: "Password must contain at least 6 characters."
            });
        }


        const [existing] = await db.query(
            "SELECT id FROM admins WHERE email = ?",
            [email]
        );


        if (existing.length > 0) {

            return res.status(409).json({
                success: false,
                message: "An administrator with this email already exists."
            });
        }


        const hashedPassword =
            await bcrypt.hash(password, 10);


        const [result] = await db.query(`
            INSERT INTO admins
            (full_name, email, password, role)
            VALUES (?, ?, ?, ?)
        `, [
            full_name,
            email,
            hashedPassword,
            role
        ]);


        res.status(201).json({
            success: true,
            message: "Administrator created successfully.",
            administratorId: result.insertId
        });


    } catch (error) {

        console.error(
            "CREATE ADMINISTRATOR ERROR:",
            error
        );

        res.status(500).json({
            success: false,
            message: "Unable to create administrator."
        });
    }
});


// UPDATE ADMINISTRATOR
app.put("/api/admin/administrators/:adminId", async (req, res) => {
    try {

        const { adminId } = req.params;

        const {
            full_name,
            email,
            role,
            password
        } = req.body;


        if (!full_name || !email || !role) {

            return res.status(400).json({
                success: false,
                message: "Name, email and role are required."
            });
        }


        if (!["Admin", "Overall Admin"].includes(role)) {

            return res.status(400).json({
                success: false,
                message: "Invalid administrator role."
            });
        }


        const [existing] = await db.query(
            "SELECT id FROM admins WHERE id = ?",
            [adminId]
        );


        if (!existing.length) {

            return res.status(404).json({
                success: false,
                message: "Administrator not found."
            });
        }


        const [emailExists] = await db.query(
            "SELECT id FROM admins WHERE email = ? AND id != ?",
            [email, adminId]
        );


        if (emailExists.length > 0) {

            return res.status(409).json({
                success: false,
                message: "Another administrator already uses this email."
            });
        }


        if (password && password.length < 6) {

            return res.status(400).json({
                success: false,
                message: "Password must contain at least 6 characters."
            });
        }


        if (password) {

            const hashedPassword =
                await bcrypt.hash(password, 10);


            await db.query(`
                UPDATE admins
                SET
                    full_name = ?,
                    email = ?,
                    role = ?,
                    password = ?
                WHERE id = ?
            `, [
                full_name,
                email,
                role,
                hashedPassword,
                adminId
            ]);

        } else {

            await db.query(`
                UPDATE admins
                SET
                    full_name = ?,
                    email = ?,
                    role = ?
                WHERE id = ?
            `, [
                full_name,
                email,
                role,
                adminId
            ]);
        }


        res.json({
            success: true,
            message: "Administrator updated successfully."
        });


    } catch (error) {

        console.error(
            "UPDATE ADMINISTRATOR ERROR:",
            error
        );

        res.status(500).json({
            success: false,
            message: "Unable to update administrator."
        });
    }
});


// ACTIVATE / DEACTIVATE ADMINISTRATOR
app.put("/api/admin/administrators/:adminId/status", async (req, res) => {
    try {

        const { adminId } = req.params;

        const { is_active } = req.body;


        if (typeof is_active !== "boolean") {

            return res.status(400).json({
                success: false,
                message: "Invalid administrator status."
            });
        }


        const [existing] = await db.query(
            "SELECT id FROM admins WHERE id = ?",
            [adminId]
        );


        if (!existing.length) {

            return res.status(404).json({
                success: false,
                message: "Administrator not found."
            });
        }


        await db.query(`
            UPDATE admins
            SET is_active = ?
            WHERE id = ?
        `, [
            is_active,
            adminId
        ]);


        res.json({
            success: true,
            message: is_active
                ? "Administrator activated successfully."
                : "Administrator deactivated successfully."
        });


    } catch (error) {

        console.error(
            "ADMIN STATUS ERROR:",
            error
        );

        res.status(500).json({
            success: false,
            message: "Unable to update administrator status."
        });
    }
});

// ==========================================
// START SERVER
// ==========================================

const PORT =
    process.env.PORT || 5000;


app.listen(PORT, () => {

    console.log(
        `Swan Elite backend running on port ${PORT}`
    );

});