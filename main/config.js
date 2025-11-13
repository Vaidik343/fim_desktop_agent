const Store = require('electron-store').default;

const store = new Store({
  defaults: {
    uploadUrl: 'http://localhost:7000/api/upload',  // file upload endpoint
    alertUrl: 'http://localhost:7000/api/alerts',   // alert endpoint
    watchPaths: ['C:/test-folder'],
    scanIntervalMinutes: 10,
    agentId: null
  }    
});

module.exports = store;
