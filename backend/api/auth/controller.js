/**
 * TerraNav AI — Authentication Controller
 * Member 3: Backend Integration & Microservices
 */

const authService = require('./service');
const { sendSuccess } = require('../_lib/errors');

async function register(req, res, next) {
  try {
    const { username, email, password } = req.body;
    const result = await authService.register({ username, email, password });
    return sendSuccess(res, result, 'User registered successfully', 201);
  } catch (err) {
    return next(err);
  }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    const result = await authService.login({ email, password });
    return sendSuccess(res, result, 'Login successful', 200);
  } catch (err) {
    return next(err);
  }
}

async function getMe(req, res, next) {
  try {
    const user = await authService.getProfile(req.user.id);
    return sendSuccess(res, { user }, 'User profile retrieved', 200);
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  register,
  login,
  getMe
};
