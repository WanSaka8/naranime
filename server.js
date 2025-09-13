const express = require("express");
const fetch = require("node-fetch");
const path = require("path");
const URL = require("url").URL;

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, "public")));

// simple proxy to relay video/file to browser (streams response)
app.get("/proxy", async (req, res) => {
  const url = req.query.url;
  if (!url) return res.status(400).send("Missing url");

  try {
    // basic validation
    const parsed = new URL(url);
    // Fetch with a browser-like UA
    const resp = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/115 Safari/537.36"
      }
    });
    if (!resp.ok) {
      return res.status(502).send("Upstream fetch failed: " + resp.status);
    }

    // Pass through content-type and partial content headers if present
    const ctype = resp.headers.get("content-type") || "application/octet-stream";
    res.setHeader("Content-Type", ctype);
    const clen = resp.headers.get("content-length");
    if (clen) res.setHeader("Content-Length", clen);

    // support range requests by piping through (simple passthrough)
    // Note: advanced range handling is not implemented here.
    resp.body.pipe(res);
  } catch (err) {
    console.error("proxy error", err.message || err);
    res.status(500).send("Proxy error");
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
