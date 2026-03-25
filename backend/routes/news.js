import express from "express";
import { getNews } from "../services/newsService.js";

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const news = await getNews();
    res.json(news);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch news" });
  }
});

export default router;