const chokidar = require('chokidar');
const fs = require('fs');
const axios = require('axios');
const cron = require('node-cron');
const { computeFileHash } = require('./utils/checksum');
const store = require('./config');
const { insertEvent, getBaselineHash, updateBaseline, removeBaseline } = require('./database');
const logger = require('./logger');

function initWatcher() {
  const watchPaths = store.get('watchPaths');
  const agentId = store.get('agentId');
  const alertUrl = store.get('alertUrl');
  const fileApi = store.get('uploadUrl').replace('/upload', '/files');

  if (!agentId) {
    logger.error('❌ No agentId found, watcher cannot start');
    return;
  }

  const watcher = chokidar.watch(watchPaths, { persistent: true, ignoreInitial: false });

  async function handleFileEvent(eventType, filePath) {
    try {
      const exists = fs.existsSync(filePath);

      // Handle deletion
      if (eventType === 'unlink' || !exists) {
        removeBaseline(filePath);
        logger.info(`🗑️ REMOVED: ${filePath}`);
        await axios.post(alertUrl, { agentId, filePath, changeType: 'REMOVED' });
        return;
      }

      // Compute new hash and file metadata
      const stats = fs.statSync(filePath);
      const newHash = await computeFileHash(filePath);
      const modifiedAt = stats.mtime;

      // Compare with baseline
      getBaselineHash(filePath, async (err, row) => {
        if (err) return logger.error(`DB error: ${err.message}`);

        if (!row) {
          // new file
          logger.info(`🆕 NEW: ${filePath}`);
          updateBaseline(filePath, newHash, stats.size, modifiedAt);

          await axios.post(fileApi, { agentId, path: filePath, hash: newHash, size: stats.size, modifiedAt });
          await axios.post(alertUrl, { agentId, filePath, changeType: 'ADDED', newHash });
        } else if (row.hash !== newHash) {
          // file modified
          logger.info(`✏️ MODIFIED: ${filePath}`);
          updateBaseline(filePath, newHash, stats.size, modifiedAt);

          await axios.post(fileApi, { agentId, path: filePath, hash: newHash, size: stats.size, modifiedAt });
          await axios.post(alertUrl, {
            agentId,
            filePath,
            changeType: 'MODIFIED',
            oldHash: row.hash,
            newHash
          });
        } else {
          // no change
          logger.info(`✅ No change: ${filePath}`);
        }

        insertEvent(filePath, eventType.toLowerCase());
      });
    } catch (err) {
      logger.error(`❌ Error handling ${eventType}: ${err.message}`);
    }
  }

  watcher
    .on('add', filePath => handleFileEvent('add', filePath))
    .on('change', filePath => handleFileEvent('change', filePath))
    .on('unlink', filePath => handleFileEvent('unlink', filePath))
    .on('error', err => logger.error(`⚠️ Watcher error: ${err.message}`));

  cron.schedule(`*/${store.get('scanIntervalMinutes')} * * * *`, async () => {
    logger.info('🔁 Periodic hash validation started');
    const files = [];

    watchPaths.forEach(dir => {
      if (fs.existsSync(dir)) {
        fs.readdirSync(dir).forEach(f => files.push(`${dir}/${f}`));
      }
    });

    for (const f of files) {
      if (!fs.existsSync(f)) continue;
      await handleFileEvent('periodic', f);
    }
    logger.info('✅ Periodic scan finished');
  });

  logger.info(`👀 Watching paths: ${watchPaths.join(', ')}`);
}

module.exports = initWatcher;
