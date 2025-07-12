// app.js
// ========================
// Required dependencies
// ========================
const express = require('express');
const { exec } = require("child_process");
const fs = require("fs-extra");
const path = require('path');
const pino = require("pino");
const { Boom } = require("@hapi/boom");
const { toBuffer } = require("qrcode");
const {
  default: SuhailWASocket,
  useMultiFileAuthState,
  Browsers,
  delay,
  DisconnectReason,
  makeInMemoryStore,
} = require("@whiskeysockets/baileys");

// ========================
// Global variables
// ========================
const app = express();
const PORT = process.env.PORT || 3000;

// Global variable to hold the latest QR code buffer and session status
let latestQRBuffer = null;
let sessionStatus = "Waiting for QR Code...";
let clientSocket = null;

// Clean auth folder on startup
const authDir = path.join(__dirname, 'auth_info_baileys');
if (fs.existsSync(authDir)) {
  fs.emptyDirSync(authDir);
}

// ========================
// Start Baileys (WhatsApp) Session
// ========================
const startWhatsAppSession = async () => {
  const store = makeInMemoryStore({
    logger: pino().child({ level: 'silent', stream: 'store' })
  });

  try {
    const { state, saveCreds } = await useMultiFileAuthState(authDir);
    const Smd = SuhailWASocket({
      printQRInTerminal: false,
      logger: pino({ level: "silent" }),
      browser: Browsers.macOS("Desktop"),
      auth: state
    });

    clientSocket = Smd; // Store the socket globally

    // Listen to connection events
    Smd.ev.on("connection.update", async (update) => {
      const { connection, lastDisconnect, qr } = update;

      // When a QR code is provided, update our global variable
      if (qr) {
        try {
          latestQRBuffer = await toBuffer(qr);
          sessionStatus = "Scan the QR Code below to connect.";
        } catch (error) {
          console.error("Error generating QR code buffer:", error);
          sessionStatus = "Error generating QR code.";
        }
      }

      // When connected, do your session logic
      if (connection === "open") {
        sessionStatus = "Connected! Session is active.";
        // Wait a moment before processing
        await delay(3000);
        const user = Smd.user.id;

        // Read the creds.json file
        const authFilePath = path.join(authDir, 'creds.json');
        const sessionData = fs.readFileSync(authFilePath, 'utf8');

        // Send the creds.json file to the user
        await Smd.sendMessage(user, {
          document: { 
            url: `data:application/json;base64,${Buffer.from(sessionData).toString('base64')}` 
          },
          mimetype: 'application/json',
          fileName: 'creds.json',
          caption: 'Here is your WhatsApp session file. Keep it safe!'
        });

        const MESSAGE = process.env.MESSAGE || `
*🎉 SESSION GENERATED SUCCESSFULLY! ✅*

*💪 Empowering Your Experience with Silva MD Bot*

*🌟 Show your support by giving our repo a star! 🌟*
🔗 https://github.com/SilvaTechB/silva-md-bot

*💭 Need help? Join our support groups:*
https://whatsapp.com/channel/0029VaAkETLLY6d8qhLmZt2d

*📚 Learn & Explore More with Tutorials:*
🪄 YouTube Channel https://www.youtube.com/@silvaedits254

*🥀 Powered by Silva MD Bot & Silva Tech Inc 🥀*
*Together, we build the future of automation! 🚀*
        `;
        await Smd.sendMessage(user, { text: MESSAGE });
        await delay(1000);
        try {
          await fs.emptyDirSync(authDir);
        } catch (e) {
          console.error(e);
        }
      }

      // Save updated credentials
      Smd.ev.on('creds.update', saveCreds);

      // Handle disconnection events
      if (connection === "close") {
        let reasonCode = new Boom(lastDisconnect?.error)?.output.statusCode;
        if (reasonCode === DisconnectReason.connectionClosed) {
          console.log("Connection closed!");
        } else if (reasonCode === DisconnectReason.connectionLost) {
          console.log("Connection Lost from Server!");
        } else if (reasonCode === DisconnectReason.restartRequired) {
          console.log("Restart Required, Restarting...");
          startWhatsAppSession().catch(err => console.log(err));
        } else if (reasonCode === DisconnectReason.timedOut) {
          console.log("Connection Timed Out!");
        } else {
          console.log('Connection closed with unknown reason. Restarting...');
          await delay(5000);
          exec('pm2 restart qasim'); // adjust process restart command if needed
          process.exit(0);
        }
      }
    });
  } catch (err) {
    console.error("WhatsApp Session Error:", err);
    exec('pm2 restart qasim');
    await fs.emptyDirSync(authDir);
  }
};

// Start the WhatsApp connection once when the server starts
startWhatsAppSession().catch(err => {
  console.error("Error starting WhatsApp session:", err);
  exec('pm2 restart qasim');
  fs.emptyDirSync(authDir);
});

// ========================
// Express Routes
// ========================

// Main page route serving an attractive HTML page
app.get('/', (req, res) => {
  // Get visitor's IP address
  const ipAddress =
    req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'Unknown IP';

  // HTML content with inline CSS and client-side JavaScript for battery and time/date
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Silva MD Bot Session</title>
  <style>
    /* Modern attractive background and styling */
    body {
      margin: 0;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background: linear-gradient(135deg, #1f1c2c, #928dab);
      color: #f0f0f0;
      text-align: center;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }
    .container {
      background: rgba(0, 0, 0, 0.6);
      padding: 20px;
      border-radius: 12px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      max-width: 90%;
      margin: 20px;
    }
    h1 {
      margin-bottom: 10px;
    }
    #qr {
      width: 250px;
      height: 250px;
      margin: 20px auto;
      border: 5px solid #f0f0f0;
      border-radius: 12px;
      background: #fff;
    }
    .info {
      margin-top: 15px;
      font-size: 1.1em;
    }
    footer {
      margin-top: 20px;
      font-size: 0.9em;
    }
    button {
      margin-top: 10px;
      padding: 10px 20px;
      font-size: 1em;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      background-color: #4CAF50;
      color: white;
    }
    button:hover {
      background-color: #45a049;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Silva MD Bot Session</h1>
    <p class="info">Status: <span id="status">${sessionStatus}</span></p>
    <p class="info">Your IP Address: <strong>${ipAddress}</strong></p>
    <div id="qr">
      <!-- QR Code image will be displayed here -->
      <img id="qrImage" src="/qr" alt="QR Code" width="250" height="250" style="border-radius: 12px;">
    </div>
    <p class="info">Battery: <span id="battery">Loading...</span></p>
    <p class="info">Date & Time: <span id="clock">Loading...</span></p>
    <button onclick="refreshQR()">Refresh QR Code</button>
  </div>
  <footer>
    &copy; ${new Date().getFullYear()} Silva Tech Inc.
  </footer>

  <script>
    // Function to refresh the QR code image
    function refreshQR() {
      const qrImg = document.getElementById('qrImage');
      qrImg.src = '/qr?' + new Date().getTime();
    }

    // Update clock every second
    function updateClock() {
      const now = new Date();
      const options = { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute:'2-digit', second:'2-digit' };
      document.getElementById('clock').innerText = now.toLocaleDateString(undefined, options);
    }
    setInterval(updateClock, 1000);
    updateClock();

    // Get battery status (if supported)
    if (navigator.getBattery) {
      navigator.getBattery().then(function(battery) {
        function updateBatteryStatus() {
          document.getElementById('battery').innerText = Math.round(battery.level * 100) + '%';
        }
        updateBatteryStatus();
        battery.addEventListener('levelchange', updateBatteryStatus);
      });
    } else {
      document.getElementById('battery').innerText = 'Not Supported';
    }

    // Optionally, poll the session status from the server (if you implement an API endpoint)
    async function fetchStatus() {
      try {
        const res = await fetch('/status');
        const data = await res.json();
        document.getElementById('status').innerText = data.status;
      } catch (error) {
        console.error('Error fetching status:', error);
      }
    }
    setInterval(fetchStatus, 5000);
  </script>
</body>
</html>
  `;
  res.send(html);
});

// Endpoint to serve the current QR code image
app.get('/qr', (req, res) => {
  if (latestQRBuffer) {
    res.setHeader('Content-Type', 'image/png');
    res.send(latestQRBuffer);
  } else {
    // If no QR code is available yet, send a placeholder or error status.
    res.status(204).send(); // No content
  }
});

// Optional: API endpoint to check the session status
app.get('/status', (req, res) => {
  res.json({ status: sessionStatus });
});

// Endpoint to download the creds.json file if available
app.get('/creds', (req, res) => {
  const authFilePath = path.join(authDir, 'creds.json');
  if (fs.existsSync(authFilePath)) {
    res.download(authFilePath, 'creds.json');
  } else {
    res.status(404).send('Session file not available yet');
  }
});

// Start Express server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
