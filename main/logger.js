const { createLogger, transports, format } = require('winston');

const logger = createLogger({
  level: 'info',
  format: format.combine(format.timestamp(), format.simple()),
  transports: [
    new transports.Console(),
    new transports.File({ filename: 'agent.log' })
  ]
});

module.exports = logger;
