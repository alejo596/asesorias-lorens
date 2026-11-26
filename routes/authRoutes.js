const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authenticate = require('../middleware/authenticate');
const loginRateLimit = require('../middleware/loginRateLimit');

// El limitador se ejecuta antes del controlador para frenar fuerza bruta.
router.post('/login', loginRateLimit, authController.login);
router.get('/profile', authenticate, authController.getProfile);

module.exports = router;

