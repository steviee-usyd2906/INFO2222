/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("fs");
const http = require("http");
const https = require("https");
const { parse } = require("url");
const next = require("next");

const dev = process.env.NODE_ENV !== "production";
//const hostname = process.env.HOSTNAME || "localhost";
const hostname = "localhost";
const port = Number.parseInt(process.env.PORT || "3000", 10);
const httpPort = Number.parseInt(process.env.HTTP_PORT || "3001", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

const keyPath = process.env.HTTPS_KEY_PATH || "./certs/localhost-key.pem";
const certPath = process.env.HTTPS_CERT_PATH || "./certs/localhost.pem";

if (!fs.existsSync(keyPath) || !fs.existsSync(certPath)) {
  throw new Error(
    `HTTPS certificate files not found. Set HTTPS_KEY_PATH/HTTPS_CERT_PATH or create certs at ${keyPath} and ${certPath}.`
  );
}

const tlsOptions = {
  key: fs.readFileSync(keyPath),
  // TLS handshake (high level):
  // 1) ClientHello: browser says "here are the TLS versions/ciphers I support".
  // 2) ServerHello: server picks strong settings (here we require TLS 1.2+).
  // Certificate verification / server authentication:
  // The certificate lets the client confirm it is talking to this server identity.
  cert: fs.readFileSync(certPath),
 // minVersion: "TLSv1.2",
  minVersion: "TLSv1.3",
  maxVersion: "TLSv1.3"
};

app.prepare().then(() => {
  https
    .createServer(tlsOptions, (req, res) => {
      // Key exchange (typically ECDHE in modern TLS):
      // client and server derive a shared session key without sending that key directly.
      // After the handshake, application data is encrypted in transit
      // (commonly with AES-GCM) so logins/passwords are protected on the network.
      const parsedUrl = parse(req.url, true);
      handle(req, res, parsedUrl);
    })
    .listen(port, hostname, () => {
      console.log(
        `> HTTPS server ready on https://${hostname}:${port} (${dev ? "development" : "production"})`
      );
    });

  // Redirect plain HTTP requests to HTTPS so all app traffic uses the encrypted TLS channel.
  http
    .createServer((req, res) => {
      const requestHost = req.headers.host || `${hostname}:${httpPort}`;
      const hostWithoutPort = requestHost.split(":")[0];
      const targetPath = req.url || "/";
      const httpsUrl = `https://${hostWithoutPort}:${port}${targetPath}`;

      if (targetPath.startsWith("/api/")) {
        // API credentials (especially passwords) must never travel over plaintext HTTP.
        res.writeHead(426, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            error: "HTTPS required for API routes. Passwords must never be sent over plaintext HTTP.",
            redirectTo: httpsUrl,
          })
        );
        return;
      }

      res.writeHead(301, { Location: httpsUrl });
      res.end();
    })
    .listen(httpPort, hostname, () => {
      console.log(`> HTTP redirect server ready on http://${hostname}:${httpPort} -> https://${hostname}:${port}`);
    });
});
