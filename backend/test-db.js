
const db = require("./config/database");

async function testDatabase() {
    try {
        const connection = await db.getConnection();

        console.log("SUCCESS: Connected to MySQL!");

        const [rows] = await connection.query(
            "SELECT DATABASE() AS database_name"
        );

        console.log("Connected database:", rows[0].database_name);

        connection.release();
        await db.end();

    } catch (error) {
        console.error("DATABASE CONNECTION FAILED:");
        console.error(error.message);

        await db.end();
        process.exitCode = 1;
    }
}

testDatabase();
