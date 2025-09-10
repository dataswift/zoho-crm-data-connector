const express = require('express');
const { handleConnect } = require('./controllers/connect-controller');
const { getErrorPageInfo, generateSuccessPageHTML, generateErrorPageHTML } = require('./views/pages');
require('dotenv').config();

const app = express();
const port = process.env.CONNECTOR_PORT || 8080;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.get('/connect', handleConnect);

app.get('/success', (req, res) => {
  const { request_id, callback_url, callback_label } = req.query;
  
  const htmlContent = generateSuccessPageHTML({
    request_id: request_id || 'Unknown',
    callback_url: callback_url || '',
    callback_label: callback_label || 'Return to Application',
    timestamp: new Date().toISOString()
  });
  
  res.status(200).send(htmlContent);
});

app.get('/error', (req, res) => {
  const { type, message, request_id, details, callback_url, callback_label } = req.query;
  
  const errorInfo = getErrorPageInfo(type, message, request_id, details);
  errorInfo.callback_url = callback_url || '';
  errorInfo.callback_label = callback_label || 'Return to Application';
  
  const htmlContent = generateErrorPageHTML(errorInfo);
  
  res.status(errorInfo.statusCode).send(htmlContent);
});

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// Start server
app.listen(port, () => {
  console.log(`🚀 Zoho CRM Data Connector Server running on port ${port}`);
  console.log(`📋 Endpoints:`);
  console.log(`   GET /connect - Main data connector endpoint`);
  console.log(`   GET /success - Success page display`);
  console.log(`   GET /error - Error page display`);
  console.log(`   GET /health - Health check`);
});

module.exports = app;