import express, { response } from "express";
import cors from "cors";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get("/test/api", (req, response) => {
  response.json({ message: "Hello from the server!", status: "success" });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
