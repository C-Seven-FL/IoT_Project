require("dotenv").config();

const app = require("./app");
const connectDb = require("./db");

const port = process.env.PORT || 3030;

async function startServer() {
    try {
        await connectDb();

        app.listen(port, () => {
            console.log(`Server is running on http://localhost:${port}`);
        });
    } catch (error) {
        console.error("Failed to start server:", error.message);
        process.exit(1);
    }
}

startServer();