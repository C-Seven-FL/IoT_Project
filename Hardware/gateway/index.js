const express = require("express");

const app = express();
const PORT = 3001;

app.use(express.json());

app.post("/data", (req, res) => {
    console.log(req.body);

    res.json({
        status: "ok"
    });
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});