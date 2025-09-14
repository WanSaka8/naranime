const express = require("express");
const fetch = require("node-fetch");
const path = require("path");
const URL = require("url").URL;

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, "public")));

// Improved proxy with domain-specific handling
app.get("/proxy", async (req, res) => {
  const url = req.query.url;
  if (!url) return res.status(400).json({ error: "Missing url parameter" });

  try {
    // Basic URL validation
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();
    
    console.log(`Proxying: ${url}`);
    
    // Domain-specific headers and handling
    let headers = {};
    let shouldProxy = true;

    if (hostname.includes('pixeldrain.com')) {
      // Pixeldrain specific headers
      headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        "Accept-Encoding": "gzip, deflate, br",
        "DNT": "1",
        "Connection": "keep-alive",
        "Upgrade-Insecure-Requests": "1",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "Sec-Fetch-User": "?1",
        "Cache-Control": "max-age=0"
      };
    } else if (hostname.includes('otakufiles')) {
      headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Referer": "https://otakufiles.com/",
        "Accept": "*/*",
        "Accept-Language": "en-US,en;q=0.9",
        "Cache-Control": "no-cache"
      };
    } else if (hostname.includes('streamtape')) {
      headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Referer": "https://streamtape.com/",
        "Accept": "*/*"
      };
    } else if (hostname.includes('drive.google.com') || hostname.includes('blogger.com') || hostname.includes('blogspot.com')) {
      // For Google services, redirect directly instead of proxying
      return res.redirect(url);
    } else {
      // Default headers for other domains
      headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "*/*",
        "Accept-Language": "en-US,en;q=0.9",
        "Cache-Control": "no-cache"
      };
    }

    const resp = await fetch(url, {
      headers,
      follow: 5,
      timeout: 30000,
      compress: false // Disable compression for better compatibility
    });

    if (!resp.ok) {
      console.error(`Upstream fetch failed: ${resp.status} ${resp.statusText}`);
      
      // For pixeldrain, try alternative approach
      if (hostname.includes('pixeldrain.com') && resp.status === 403) {
        // Return redirect to original URL for user to open directly
        return res.status(200).send(`
          <html>
            <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
              <h2>Direct Access Required</h2>
              <p>This content requires direct access. Click the link below:</p>
              <a href="${url}" target="_blank" style="color: #007bff; text-decoration: none; font-size: 18px;">
                Open Content →
              </a>
              <script>
                // Auto-open in new tab
                setTimeout(() => window.open('${url}', '_blank'), 1000);
              </script>
            </body>
          </html>
        `);
      }
      
      return res.status(502).json({ 
        error: "Upstream fetch failed", 
        status: resp.status,
        statusText: resp.statusText,
        url: url
      });
    }

    // Get content type and set appropriate headers
    const contentType = resp.headers.get("content-type") || "application/octet-stream";
    res.setHeader("Content-Type", contentType);
    
    // Handle content length
    const contentLength = resp.headers.get("content-length");
    if (contentLength) {
      res.setHeader("Content-Length", contentLength);
    }

    // Set CORS headers
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Range, Content-Type");
    
    // Support range requests for video streaming
    const range = req.headers.range;
    if (range && contentLength) {
      const acceptRanges = resp.headers.get("accept-ranges");
      if (acceptRanges === "bytes") {
        res.setHeader("Accept-Ranges", "bytes");
      }
    }

    // Set cache headers for media content
    if (contentType.startsWith('video/') || contentType.startsWith('audio/') || contentType.startsWith('application/vnd.apple.mpegurl')) {
      res.setHeader("Cache-Control", "public, max-age=3600");
    }

    // Pipe the response
    resp.body.pipe(res);

  } catch (err) {
    console.error("Proxy error:", err.message || err);
    
    if (err.code === 'ENOTFOUND') {
      return res.status(404).json({ error: "Source not found" });
    } else if (err.code === 'ETIMEDOUT') {
      return res.status(408).json({ error: "Request timeout" });
    } else {
      return res.status(500).json({ error: "Proxy error", details: err.message });
    }
  }
});

// Stream endpoint untuk desustream dan sources lain
app.get("/stream", async (req, res) => {
  const url = req.query.url;
  if (!url) return res.status(400).send("Missing stream URL");

  try {
    console.log(`Streaming from: ${url}`);
    
    // Headers khusus untuk desustream
    const headers = {
      'Host': 'desustream.info',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
      'Upgrade-Insecure-Requests': '1',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Sec-GPC': '1',
      'Sec-CH-UA': '"Not)A;Brand";v="8", "Chromium";v="138", "Brave";v="138"',
      'Sec-CH-UA-Mobile': '?0',
      'Sec-CH-UA-Platform': '"Windows"',
      'Connection': 'keep-alive'
    };

    const response = await fetch(url, { headers });
    
    if (!response.ok) {
      return res.status(502).send(`Stream fetch failed: ${response.status}`);
    }

    // Set headers untuk iframe embed
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Content-Type', response.headers.get('content-type') || 'text/html');
    res.setHeader('Access-Control-Allow-Origin', '*');

    // Stream response
    response.body.pipe(res);
    
  } catch (error) {
    console.error("Stream error:", error);
    res.status(500).send("Stream error");
  }
});

// API endpoint untuk mendapatkan video sources (bypass CORS)
app.get("/api/episode/:slug", async (req, res) => {
  const { slug } = req.params;
  const API_BASE = "https://kitanime-api.vercel.app/v1";
  
  try {
    const response = await fetch(`${API_BASE}/episode/${encodeURIComponent(slug)}`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
      }
    });
    
    if (!response.ok) {
      return res.status(response.status).json({ error: "API request failed" });
    }
    
    const data = await response.json();
    res.json(data);
    
  } catch (error) {
    console.error("API proxy error:", error);
    res.status(500).json({ error: "Failed to fetch episode data" });
  }
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date().toISOString() });
});

// Handle 404
app.use((req, res) => {
  res.status(404).json({ error: "Endpoint not found" });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error("Global error:", err);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📺 Proxy endpoint: http://localhost:${PORT}/proxy?url=<VIDEO_URL>`);
});