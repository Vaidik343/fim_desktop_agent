const fs = require('fs');
const crypto = require('crypto');

/**
 * Compute SHA256 hash of a file
 * @param {string} filePath 
 * @returns {Promise<string>} hash
 */
function computeFileHash(filePath) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(filePath)) return resolve(null);
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);

    stream.on('data', data => hash.update(data));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', err => reject(err));
  });
}

module.exports = { computeFileHash };
