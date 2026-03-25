import express from "express";
const router = express.Router();

router.get("/", (req, res) => {
  res.json({ message: "AI route works!" });
});

export default router;