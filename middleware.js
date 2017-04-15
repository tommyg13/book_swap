const models = require('./models/model');
const server = require('./server');

/**
 * A simple authentication middleware for Express.
 *
 * This middleware will load users from session data, and handle all user
 * proxying for convenience.
 */
module.exports.simpleAuth = function(req, res, next) {
  if (req.session && req.session.user) {
    models.User.findOne({ email: req.session.user.email }, 'username email password', function(err, user) {
      if(err) {console.log(err)}
      if (user) {
        server.createUserSession(req, res, user);
      }
      next();
    });
  } else {
    req.session.destroy();
    next();
  }
};
