const express = require('express');
const bodyParser = require('body-parser');
const { ImapFlow } = require('imapflow');
const simpleParser = require('mailparser').simpleParser;

const app = express();

// Use middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Store extracted OTPs and connection state
const extractedOTPs = {
  canva: [],
  openai: []
};
let isConnected = false;
let lastCheckTime = null;
let emailClient = null;
let checkInterval = null;

// HARDCODED EMAIL CREDENTIALS - REPLACE WITH YOUR OWN
const EMAIL_CONFIG = {
  email: 'email@fake.com',    // Replace with your actual email
  password: Password',  // Replace with your app password
  imapHost: 'imap.gmail.com',    // IMAP server (Gmail default)
  imapPort: 993,
  imapSecure: true
};

// Current user email (for UI display only)
let currentEmail = '';

// Serve a simple frontend
app.get('/', (req, res) => {
  // Get latest OTPs
  const latestCanvaOTP = extractedOTPs.canva.length > 0 ? extractedOTPs.canva[0] : null;
  const latestOpenAIOTP = extractedOTPs.openai.length > 0 ? extractedOTPs.openai[0] : null;
  
  // Current year for copyright
  const currentYear = new Date().getFullYear();
  
  let html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>OTP Extractor</title>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        :root {
          --canva-color: #00c4cc;
          --canva-dark: #00a5ad;
          --openai-color: #10a37f;
          --openai-dark: #0d876b;
          --bg-color: #f8fafc;
          --card-bg: #ffffff;
          --text-color: #1e293b;
          --text-secondary: #64748b;
          --border-color: #e2e8f0;
          --shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1);
        }
        
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        body {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
          background-color: var(--bg-color);
          color: var(--text-color);
          line-height: 1.5;
        }
        
        .container {
          max-width: 1000px;
          margin: 0 auto;
          padding: 20px;
        }
        
        header {
          text-align: center;
          margin-bottom: 30px;
          padding: 20px 0;
          border-bottom: 1px solid var(--border-color);
        }
        
        h1 {
          font-size: 32px;
          font-weight: 700;
          margin-bottom: 5px;
          background: linear-gradient(45deg, var(--canva-color), var(--openai-color));
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
        }
        
        .subtitle {
          color: var(--text-secondary);
          font-size: 16px;
        }
        
        .login-section {
          background-color: var(--card-bg);
          border-radius: 12px;
          box-shadow: var(--shadow);
          padding: 25px;
          margin-bottom: 30px;
        }
        
        .section-title {
          font-size: 20px;
          font-weight: 600;
          margin-bottom: 15px;
          color: var(--text-color);
        }
        
        form {
          display: flex;
          gap: 10px;
        }
        
        input {
          flex: 1;
          padding: 12px 15px;
          border: 1px solid var(--border-color);
          border-radius: 8px;
          font-size: 16px;
          transition: border-color 0.2s;
        }
        
        input:focus {
          outline: none;
          border-color: var(--canva-color);
          box-shadow: 0 0 0 3px rgba(0, 196, 204, 0.1);
        }
        
        button {
          background-color: var(--canva-color);
          color: white;
          border: none;
          padding: 12px 20px;
          border-radius: 8px;
          font-size: 16px;
          font-weight: 500;
          cursor: pointer;
          transition: background-color 0.2s, transform 0.1s;
        }
        
        button:hover {
          background-color: var(--canva-dark);
        }
        
        button:active {
          transform: translateY(1px);
        }
        
        .message {
          margin-top: 15px;
          padding: 10px 15px;
          border-radius: 8px;
          font-size: 14px;
        }
        
        .success {
          background-color: #ecfdf5;
          color: #065f46;
          border-left: 4px solid #10b981;
        }
        
        .error {
          background-color: #fef2f2;
          color: #991b1b;
          border-left: 4px solid #ef4444;
        }
        
        .status {
          display: flex;
          align-items: center;
          margin-top: 15px;
          padding: 10px;
          background-color: #f8fafc;
          border-radius: 8px;
        }
        
        .status-dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          margin-right: 10px;
        }
        
        .status-dot.connected {
          background-color: #10b981;
        }
        
        .status-dot.disconnected {
          background-color: #ef4444;
        }
        
        .status-text {
          font-size: 14px;
          color: var(--text-secondary);
        }
        
        .otp-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 30px;
          margin-bottom: 30px;
        }
        
        .otp-card {
          background-color: var(--card-bg);
          border-radius: 12px;
          box-shadow: var(--shadow);
          padding: 25px;
          position: relative;
          overflow: hidden;
        }
        
        .canva-card {
          border-top: 5px solid var(--canva-color);
        }
        
        .openai-card {
          border-top: 5px solid var(--openai-color);
        }
        
        .service-logo {
          position: absolute;
          top: 15px;
          right: 15px;
          width: 32px;
          height: 32px;
          object-fit: contain;
          opacity: 0.7;
        }
        
        .service-name {
          font-weight: 600;
          font-size: 18px;
          margin-bottom: 5px;
        }
        
        .canva-card .service-name {
          color: var(--canva-color);
        }
        
        .openai-card .service-name {
          color: var(--openai-color);
        }
        
        .otp-meta {
          font-size: 13px;
          color: var(--text-secondary);
          margin-bottom: 20px;
        }
        
        .otp-display {
          font-size: 38px;
          font-weight: 700;
          letter-spacing: 4px;
          text-align: center;
          padding: 20px;
          background-color: #f8fafc;
          border-radius: 8px;
          margin-bottom: 20px;
          font-family: 'Courier New', monospace;
          position: relative;
        }
        
        .canva-card .otp-display {
          color: var(--canva-color);
        }
        
        .openai-card .otp-display {
          color: var(--openai-color);
        }
        
        .otp-actions {
          display: flex;
          gap: 10px;
        }
        
        .copy-btn {
          flex: 1;
          font-size: 14px;
          padding: 10px;
        }
        
        .canva-card .copy-btn {
          background-color: var(--canva-color);
        }
        
        .canva-card .copy-btn:hover {
          background-color: var(--canva-dark);
        }
        
        .openai-card .copy-btn {
          background-color: var(--openai-color);
        }
        
        .openai-card .copy-btn:hover {
          background-color: var(--openai-dark);
        }
        
        .refresh-btn {
          width: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .no-otp {
          text-align: center;
          padding: 30px 20px;
          color: var(--text-secondary);
          font-style: italic;
        }
        
        .test-section {
          background-color: var(--card-bg);
          border-radius: 12px;
          box-shadow: var(--shadow);
          padding: 25px;
        }
        
        .test-options {
          display: flex;
          gap: 10px;
          margin-top: 15px;
        }
        
        .test-btn {
          flex: 1;
          text-align: center;
        }
        
        .canva-test-btn {
          background-color: var(--canva-color);
        }
        
        .canva-test-btn:hover {
          background-color: var(--canva-dark);
        }
        
        .openai-test-btn {
          background-color: var(--openai-color);
        }
        
        .openai-test-btn:hover {
          background-color: var(--openai-dark);
        }
        
        .footer {
          margin-top: 50px;
          padding-top: 20px;
          border-top: 1px solid var(--border-color);
          text-align: center;
          font-size: 14px;
          color: var(--text-secondary);
        }
        
        .empty-state {
          position: relative;
          height: 220px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-direction: column;
          gap: 15px;
        }
        
        .empty-icon {
          font-size: 40px;
          opacity: 0.3;
        }
        
        .empty-text {
          color: var(--text-secondary);
          font-size: 16px;
        }
        
        @media (max-width: 768px) {
          .otp-grid {
            grid-template-columns: 1fr;
          }
          
          form {
            flex-direction: column;
          }
          
          .container {
            padding: 15px;
          }
          
          .otp-display {
            font-size: 30px;
          }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <header>
          <h1>OTP Extractor</h1>
          <div class="subtitle">For Canva Pro & ChatGPT/OpenAI verification codes</div>
        </header>
        
        <div class="login-section">
          <div class="section-title">Start Tracking OTPs</div>
          <form action="/register-email" method="POST">
            <input type="email" name="email" placeholder="Your email address" value="${currentEmail}" required>
            <button type="submit">Start Tracking</button>
          </form>
          ${req.query.message ? `<div class="message ${req.query.success ? 'success' : 'error'}">${req.query.message}</div>` : ''}
          
          <div class="status">
            <div class="status-dot ${isConnected ? 'connected' : 'disconnected'}"></div>
            <div class="status-text">
              ${isConnected ? 
                `Connected & monitoring for new OTPs. Last checked: ${lastCheckTime ? new Date(lastCheckTime).toLocaleString() : 'Never'}` : 
                'Disconnected. Enter your email to start monitoring.'}
            </div>
          </div>
        </div>
        
        <div class="otp-grid">
          <!-- Canva Pro OTP Card -->
          <div class="otp-card canva-card">
            <span class="service-name">Canva Pro</span>
            ${latestCanvaOTP ? `
              <div class="otp-meta">Updated at ${latestCanvaOTP.time}</div>
              <div class="otp-display">${latestCanvaOTP.code}</div>
              <div class="otp-actions">
                <button class="copy-btn" onclick="copyToClipboard('${latestCanvaOTP.code}', 'Canva Pro')">Copy Code</button>
                <form action="/check-now" method="POST">
                  <button type="submit" class="refresh-btn">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/></svg>
                  </button>
                </form>
              </div>
            ` : `
              <div class="empty-state">
                <div class="empty-icon">📬</div>
                <div class="empty-text">No Canva Pro OTP codes found yet</div>
              </div>
            `}
          </div>
          
          <!-- OpenAI/ChatGPT OTP Card -->
          <div class="otp-card openai-card">
            <span class="service-name">ChatGPT / OpenAI</span>
            ${latestOpenAIOTP ? `
              <div class="otp-meta">Updated at ${latestOpenAIOTP.time}</div>
              <div class="otp-display">${latestOpenAIOTP.code}</div>
              <div class="otp-actions">
                <button class="copy-btn" onclick="copyToClipboard('${latestOpenAIOTP.code}', 'ChatGPT')">Copy Code</button>
                <form action="/check-now" method="POST">
                  <button type="submit" class="refresh-btn">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/></svg>
                  </button>
                </form>
              </div>
            ` : `
              <div class="empty-state">
                <div class="empty-icon">📬</div>
                <div class="empty-text">No ChatGPT OTP codes found yet</div>
              </div>
            `}
          </div>
        </div>
        
        <div class="test-section">
          <div class="section-title">Test OTP Detection</div>
          <p style="margin-bottom: 15px; color: var(--text-secondary);">Generate test OTP codes to verify the system is working correctly.</p>
          
          <div class="test-options">
            <form action="/add-test-otp" method="POST">
              <input type="hidden" name="service" value="canva">
              <button type="submit" class="test-btn canva-test-btn">Generate Canva OTP</button>
            </form>
            
            <form action="/add-test-otp" method="POST">
              <input type="hidden" name="service" value="openai">
              <button type="submit" class="test-btn openai-test-btn">Generate ChatGPT OTP</button>
            </form>
          </div>
        </div>
        
        <div class="footer">
          <p>© ${currentYear} DevLab. All Rights Reserved.</p>
          <p style="font-size: 12px; margin-top: 5px;">This tool is designed to extract OTP codes from Canva Pro and ChatGPT/OpenAI emails.</p>
        </div>
      </div>
      
      <script>
        function copyToClipboard(text, service) {
          // Create a temporary input element
          const input = document.createElement('textarea');
          input.value = text;
          document.body.appendChild(input);
          
          // Select and copy the text
          input.select();
          document.execCommand('copy');
          
          // Remove the temporary element
          document.body.removeChild(input);
          
          // Show feedback
          alert(service + ' OTP code copied: ' + text);
        }
        
        // Auto-refresh the page every 15 seconds if connected
        ${isConnected ? 'setTimeout(() => { location.reload(); }, 15000);' : ''}
      </script>
    </body>
    </html>
  `;
  
  res.send(html);
});

// Register email endpoint - but email credentials are hardcoded
app.post('/register-email', (req, res) => {
  const email = req.body.email;
  
  if (!email) {
    return res.redirect('/?message=Email is required&success=false');
  }
  
  // Store current email for display purposes
  currentEmail = email;
  console.log(`Tracking OTPs for: ${email}`);
  
  // Start monitoring using hardcoded credentials
  startMonitoring().then(() => {
    return res.redirect('/?message=Started tracking OTPs for your email&success=true');
  }).catch(error => {
    console.error('Connection error:', error);
    return res.redirect(`/?message=Connection failed: ${error.message}&success=false`);
  });
});

// Check for new OTPs now
app.post('/check-now', async (req, res) => {
  if (!isConnected || !emailClient) {
    return res.redirect('/?message=Not connected to email&success=false');
  }
  
  try {
    await checkEmails();
    lastCheckTime = new Date();
    return res.redirect('/');
  } catch (error) {
    console.error('Check error:', error);
    return res.redirect(`/?message=Check failed: ${error.message}&success=false`);
  }
});

// Add a test OTP endpoint
app.post('/add-test-otp', (req, res) => {
  const { service } = req.body;
  // Generate a random 6-digit OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  
  if (service === 'canva' || service === 'openai') {
    // Add to our list
    extractedOTPs[service].unshift({
      code: otp,
      subject: `Test ${service === 'canva' ? 'Canva Pro' : 'ChatGPT'} OTP`,
      time: new Date().toLocaleTimeString()
    });
    
    // Keep only the last 10 OTPs for each service
    if (extractedOTPs[service].length > 10) {
      extractedOTPs[service].pop();
    }
    
    console.log(`Test ${service} OTP added: ${otp}`);
  }
  
  return res.redirect('/');
});

// Initialize email client and start monitoring
async function startMonitoring() {
  // Close existing connection if any
  if (emailClient) {
    try {
      await emailClient.close();
    } catch (error) {
      console.log('Error closing existing connection:', error);
    }
  }
  
  // Clear existing interval
  if (checkInterval) {
    clearInterval(checkInterval);
  }
  
  // Initialize new client with hardcoded credentials
  emailClient = new ImapFlow({
    host: EMAIL_CONFIG.imapHost,
    port: EMAIL_CONFIG.imapPort,
    secure: EMAIL_CONFIG.imapSecure,
    auth: {
      user: EMAIL_CONFIG.email,
      pass: EMAIL_CONFIG.password
    },
    logger: false,
    tls: {
      rejectUnauthorized: false
    }
  });
  
  // Connect to server
  await emailClient.connect();
  console.log('Connected to email server');
  isConnected = true;
  
  // Check emails immediately
  await checkEmails();
  lastCheckTime = new Date();
  
  // Set up polling interval (check every 15 seconds)
  checkInterval = setInterval(async () => {
    try {
      await checkEmails();
      lastCheckTime = new Date();
    } catch (error) {
      console.error('Error checking emails:', error);
      
      // Try to reconnect if there's an error
      try {
        await emailClient.close();
        await emailClient.connect();
        console.log('Reconnected to email server');
      } catch (reconnectError) {
        console.error('Reconnection failed:', reconnectError);
        isConnected = false;
        clearInterval(checkInterval);
      }
    }
  }, 15000); // Check every 15 seconds
}

// Check emails for OTP codes
async function checkEmails() {
  if (!emailClient || !isConnected) {
    throw new Error('Not connected to email server');
  }
  
  console.log('Checking emails for OTP codes...');
  
  // Make sure INBOX is open
  await emailClient.mailboxOpen('INBOX');
  
  // Check for Canva emails
  await checkCanvaEmails();
  
  // Check for ChatGPT/OpenAI emails
  await checkOpenAIEmails();
}

// Check for Canva OTP codes
async function checkCanvaEmails() {
  // Search for Canva emails
  const searchCriteria = {
    from: 'canva'
  };
  
  const messages = await emailClient.search(searchCriteria, { unseen: true });
  console.log(`Found ${messages.length} unread Canva emails`);
  
  // Process each message
  for (const seq of messages) {
    const message = await emailClient.fetchOne(seq, { source: true });
    const parsed = await simpleParser(message.source);
    
    const subject = parsed.subject || '';
    const textBody = parsed.text || '';
    
    console.log(`Processing Canva email: ${subject}`);
    
    // Extract OTP code
    const otpMatch = textBody.match(/\b(\d{6})\b/);
    if (otpMatch) {
      const otpCode = otpMatch[1];
      
      // Check if we already have this OTP
      const isDuplicate = extractedOTPs.canva.some(otp => otp.code === otpCode);
      
      if (!isDuplicate) {
        // Add to our list
        extractedOTPs.canva.unshift({
          code: otpCode,
          subject: subject,
          time: new Date().toLocaleTimeString()
        });
        
        // Keep only the last 10 OTPs
        if (extractedOTPs.canva.length > 10) {
          extractedOTPs.canva.pop();
        }
        
        console.log(`Canva OTP extracted: ${otpCode}`);
      } else {
        console.log(`Duplicate Canva OTP ignored: ${otpCode}`);
      }
    } else {
      console.log('No OTP found in this Canva email');
    }
  }
}

// Check for ChatGPT/OpenAI OTP codes
async function checkOpenAIEmails() {
  // Search for OpenAI/ChatGPT emails
  const searchCriteria = {
    or: [
      { from: 'openai' },
      { from: 'noreply@openai' },
      { subject: 'ChatGPT' }
    ]
  };
  
  const messages = await emailClient.search(searchCriteria, { unseen: true });
  console.log(`Found ${messages.length} unread OpenAI/ChatGPT emails`);
  
  // Process each message
  for (const seq of messages) {
    const message = await emailClient.fetchOne(seq, { source: true });
    const parsed = await simpleParser(message.source);
    
    const subject = parsed.subject || '';
    const textBody = parsed.text || '';
    
    console.log(`Processing OpenAI email: ${subject}`);
    
    // Extract OTP code
    const otpMatch = textBody.match(/\b(\d{6})\b/);
    if (otpMatch) {
      const otpCode = otpMatch[1];
      
      // Check if we already have this OTP
      const isDuplicate = extractedOTPs.openai.some(otp => otp.code === otpCode);
      
      if (!isDuplicate) {
        // Add to our list
        extractedOTPs.openai.unshift({
          code: otpCode,
          subject: subject,
          time: new Date().toLocaleTimeString()
        });
        
        // Keep only the last 10 OTPs
        if (extractedOTPs.openai.length > 10) {
          extractedOTPs.openai.pop();
        }
        
        console.log(`OpenAI OTP extracted: ${otpCode}`);
      } else {
        console.log(`Duplicate OpenAI OTP ignored: ${otpCode}`);
      }
    } else {
      console.log('No OTP found in this OpenAI email');
    }
  }
}

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`OTP extractor running on port ${PORT}`);
  console.log(`View the dashboard at http://localhost:${PORT}`);
});
