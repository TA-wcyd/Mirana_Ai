const express = require("express");
const router = express.Router();
const multer = require("multer");
const pdfParse = require("pdf-parse");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const User = require("../models/User");
const { isAuthenticated } = require("../middleware/auth");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Store in memory (files are processed immediately, not persisted)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max (increased for PDFs)
  fileFilter: (req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf", "text/plain"];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("File type not supported. Use images (jpg, png, webp) or documents (pdf, txt)."));
    }
  },
});

// POST /api/chat/:chatId/upload — analyze uploaded file
router.post("/:chatId/upload", isAuthenticated, upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded." });

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ error: "User not found." });

    const chat = user.chats.id(req.params.chatId);
    if (!chat) return res.status(404).json({ error: "Chat not found." });

    const firstName = (user.displayName || user.email || "Boss").split(" ")[0];
    const isImage = req.file.mimetype.startsWith("image/");
    const isPDF = req.file.mimetype === "application/pdf";
    const userPrompt = req.body.prompt || (isImage ? "What do you see in this image?" : "Analyze this file for me.");

    let reply;

    if (isImage) {
      // Use Gemini Vision for images
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

      const imagePart = {
        inlineData: {
          data: req.file.buffer.toString("base64"),
          mimeType: req.file.mimetype,
        },
      };

      const result = await model.generateContent([
        `You are Mirana, an advanced AI assistant for ${firstName}. Analyze the uploaded image and respond naturally. Be specific about what you see. If it's code, explain it. If it's a screenshot of an error, help debug it. If it's a photo, describe it with personality. Keep the tone adapted to the user. ${userPrompt}`,
        imagePart,
      ]);

      reply = result.response.text();

    } else if (isPDF) {
      // ── PDF: try text extraction first, fall back to Gemini Vision ────────
      console.log(`📄 Parsing PDF: ${req.file.originalname} (${(req.file.size / 1024).toFixed(1)} KB)`);

      let pdfText = "";
      let pageCount = 0;
      let parseSuccess = false;

      try {
        const data = await pdfParse(req.file.buffer);
        pdfText = data.text || "";
        pageCount = data.numpages || 0;
        parseSuccess = true;
        console.log(`✅ PDF text extracted: ${pageCount} pages, ${pdfText.length} chars`);
      } catch (parseErr) {
        console.warn(`⚠️ pdf-parse failed (${parseErr.message}) — falling back to Gemini Vision`);
      }

      const visionModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

      if (parseSuccess && pdfText.trim()) {
        // ── Text-based PDF: use extracted text ─────────────────────────────
        const trimmedText = pdfText.trim().slice(0, 12000);
        const wasTrimmed = pdfText.length > 12000;

        const result = await visionModel.generateContent(
          `You are Mirana, an advanced AI assistant for ${firstName}. The user uploaded a PDF named "${req.file.originalname}" (${pageCount} page${pageCount !== 1 ? "s" : ""}).${wasTrimmed ? " Note: the file was long so only the first portion is shown." : ""}

Here is the extracted text content:
---
${trimmedText}
---

User's request: ${userPrompt}

Analyze it thoroughly and respond naturally. If it's a study document, help them understand it. If it's a report or contract, summarize the key points. If it's technical, explain it clearly.`
        );
        reply = result.response.text();
        console.log(`📄 PDF analyzed via text extraction`);

      } else {
        // ── Scanned / image-only PDF: send raw buffer to Gemini Vision ──────
        console.log(`📷 Scanned PDF detected — using Gemini Vision (native PDF support)...`);

        const pdfPart = {
          inlineData: {
            data: req.file.buffer.toString("base64"),
            mimeType: "application/pdf",
          },
        };

        const result = await visionModel.generateContent([
          `You are Mirana, an advanced AI assistant for ${firstName}. The user uploaded a scanned/image-based PDF named "${req.file.originalname}". Use your vision capabilities to read and analyze its full content — treat every page as an image you can see.\n\nUser's request: ${userPrompt}\n\nAnalyze it thoroughly and respond naturally. Extract all visible text, diagrams, tables, or key information you can see.`,
          pdfPart,
        ]);
        reply = result.response.text();
        console.log(`📷 Scanned PDF analyzed via Gemini Vision`);
      }

    } else {
      // ── Plain text files ─────────────────────────────────────────────────
      const textContent = req.file.buffer.toString("utf-8").slice(0, 12000);
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

      const result = await model.generateContent(
        `You are Mirana, an advanced AI assistant for ${firstName}. The user uploaded a text file (${req.file.originalname}). Here's the content:\n\n---\n${textContent}\n---\n\n${userPrompt}\n\nAnalyze it and respond naturally with insight.`
      );

      reply = result.response.text();
    }

    // Store in chat history
    chat.messages.push({
      role: "user",
      content: `📎 [Uploaded: ${req.file.originalname}] ${userPrompt}`,
    });
    chat.messages.push({
      role: "assistant",
      content: reply,
    });

    chat.updatedAt = new Date();
    await User.findByIdAndUpdate(req.user._id, { $set: { chats: user.chats } });

    console.log(`📎 File analyzed: ${req.file.originalname} (${req.file.mimetype})`);
    res.json({ reply, filename: req.file.originalname });
  } catch (err) {
    console.error("❌ POST /api/chat/:id/upload error:", err);
    res.status(500).json({
      error: "Failed to analyze file.",
      detail: err.message,
    });
  }
});

module.exports = router;
