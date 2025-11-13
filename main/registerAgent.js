// fim_agent/src/registerAgent.js
const os = require('os');
const axios = require('axios');
const store = require('./config');
const logger = require('./logger');

async function registerAgent() {
  // If agent already registered, reuse ID
  const existingId = store.get('agentId');
  if (existingId) {
    logger.info(`✅ Using existing agent ID: ${existingId}`);
    return existingId;
  }

  // Collect system info
  const network = Object.values(os.networkInterfaces())
    .flat()
    .find((iface) => !iface.internal && iface.family === 'IPv4');

  const payload = {
    name: os.hostname(),
    os: `${os.type()} ${os.release()}`,
    ip: network?.address || '127.0.0.1',
  };

  const registerUrl = store.get('uploadUrl').replace('/upload', '/agents/register');
  logger.info(`🌐 Registering agent with backend: ${registerUrl}`);
  logger.info(`Payload: ${JSON.stringify(payload)}`);

  try {
    const response = await axios.post(registerUrl, payload, {
      headers: { 'Content-Type': 'application/json' },
    });

    const agentId = response.data.agentId;
    if (agentId) {
      store.set('agentId', agentId);
      logger.info(`✅ Agent registered successfully: ${agentId}`);
      return agentId;
    } else {
      throw new Error('Agent ID not returned from server');
    }
  } catch (err) {
    logger.error(`❌ Agent registration failed: ${err.message}`);
    return null;
  }
}

module.exports = registerAgent;
