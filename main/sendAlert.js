// sendAlert.js
const axios = require('axios');
const store = require('./config');
const logger = require('./logger');

module.exports = async function sendAlert({ filePath, changeType, oldHash = null, newHash = null }) {
  const agentId = store.get('agentId');
  if (!agentId) {
    logger.error('⚠️ Agent ID not set. Cannot send alert.');
    return;
  }

  const payload = { agentId, filePath, changeType, oldHash, newHash };

  try {
    const serverUrl = store.get('alertUrl'); // always use alertUrl
    await axios.post(serverUrl, payload);
    logger.info(`☁️ Alert sent: ${changeType} - ${filePath}`);
  } catch (err) {
    if (err.response) {
      logger.error(`Failed to send alert: ${err.response.status} ${err.response.data?.error || err.response.statusText}`);
    } else {
      logger.error(`Failed to send alert: ${err.message}`);
    }
  }
};
