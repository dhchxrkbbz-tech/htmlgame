const http = require("http");
const fs = require("fs");
const path = require("path");

const port = Number(process.env.UPDATE_FEED_PORT || 3005);
const baseDir = path.join(__dirname, "updates");

const mimeTypes = {
  ".yml": "text/yaml",
  ".yaml": "text/yaml",
  ".json": "application/json",
  ".exe": "application/octet-stream",
  ".blockmap": "application/octet-stream",
};

http.createServer((req, res) => {
  const safePath = decodeURIComponent(req.url.replace(/^\/updates\/?/, "") || "latest.yml");
  const filePath = path.join(baseDir, safePath);

  if (!filePath.startsWith(baseDir)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not found");
      return;
    }

    const extension = path.extname(filePath).toLowerCase();
    res.writeHead(200, { "Content-Type": mimeTypes[extension] || "application/octet-stream" });
    res.end(content);
  });
}).listen(port, () => {
  console.log(`Update feed server listening on http://localhost:${port}/updates`);
});