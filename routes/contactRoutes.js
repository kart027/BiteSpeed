const express = require('express');
const router = express.Router();
const { identifyContact } = require('../controllers/contactController');

router.post('/identify', identifyContact);

module.exports = router;