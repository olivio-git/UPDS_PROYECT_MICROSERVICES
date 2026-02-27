const express = require('express');
const { createBullBoard } = require('@bull-board/api');
const { BullAdapter } = require('@bull-board/api/bullAdapter');
const { ExpressAdapter } = require('@bull-board/express');
 
const Queue = require('bull');

const app = express();
const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/');

console.log('Connecting to Redis:', {
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT,
  hasPassword: !!process.env.REDIS_PASSWORD
});

const sessionQueue = new Queue('session-scheduler', {
  redis: {
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT,
    password: process.env.REDIS_PASSWORD
  }
});

sessionQueue.on('ready', () => {
  console.log('Connected to Redis successfully');
});

sessionQueue.on('error', (error) => {
  console.error('Redis connection error:', error);
});

createBullBoard({
  queues: [new BullAdapter(sessionQueue)],
  serverAdapter,
});

app.use('/', serverAdapter.getRouter());

const PORT = 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Bull Dashboard running on http://localhost:${PORT}`);
});