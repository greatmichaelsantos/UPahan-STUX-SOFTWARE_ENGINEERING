const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  family: 4,  // force IPv4 — avoids IPv6 SMTP timeouts on Railway
});

module.exports = transporter;
