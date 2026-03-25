import express from "express";
import { getMarketData } from "../services/marketService.js";

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const data = await getMarketData();
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch market data" });
  }
});

export default router;