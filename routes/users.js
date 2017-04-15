"use strict";
const express = require("express");
const bcrypt = require("bcryptjs");
const models = require("../models/model");
const server = require("../server");
const nodemailer = require('nodemailer');
const sgTransport = require('nodemailer-sendgrid-transport');
const async = require('async');
const crypto = require('crypto');
const router = express.Router();

require("dotenv").config();
const pass=process.env.PASS;

/* Get register page */
router.get("/register",(req,res)=>{
   res.render("register",{title:"Register",csrfToken: req.csrfToken()}); 
});

/* Crete new user account */
router.post('/register', function(req, res) {
  let salt = bcrypt.genSaltSync(10);
  let hash = bcrypt.hashSync(req.body.password, salt);
  let hash1 = bcrypt.hashSync(req.body.password2, salt);
  let user = new models.User({
    username:   req.body.username,
    email:      req.body.email,
    first_name: req.body.first_name,
    last_name:  req.body.last_name,
    city:       req.body.city,
    password:   hash,
    password2:  hash1
  });
	req.checkBody('email', 'Email is required').notEmpty();
	req.checkBody('email', 'Email is not valid').isEmail();
	req.checkBody('username', 'Username is required').notEmpty();
	req.checkBody('first_name', 'First Name is required').notEmpty();
	req.checkBody('last_name', 'Last Name is required').notEmpty();
	req.checkBody('city', 'Field is required').notEmpty();
	req.checkBody('password', 'Password is required').notEmpty();
	req.checkBody('password', 'Password must be at least 6 characters').isLength({min:6});
  req.checkBody('password2', 'Passwords do not match').equals(req.body.password);
      var errors = req.validationErrors();
if(errors){
  
    req.session.destroy();
    req.session.reset();
      res.render('register', { errors: errors,csrfToken: req.csrfToken() });
    }     
    else {
       user.save(function(err,user) {
      let errors = req.validationErrors();
      let error ="";

    if (err) {
      let UserErr=err.message.slice(0,70);
      let EmailErr=err.message.slice(0,68);
      if(UserErr==="E11000 duplicate key error index: trade_book.users.$username_1 dup key"){
        error = 'That Username is already taken, please try another.';
      } else if(EmailErr=="E11000 duplicate key error index: trade_book.users.$email_1 dup key:"){
         error = 'That Email is already taken, please try another.';
      }
      res.render('register',{title:"Register",errors:errors, error:error,csrfToken: req.csrfToken()});
    }
    else{
      req.flash('success_msg', 'You are successfully registered and can now logged in');
       res.redirect('/login');
        server.createUserSession(req, res, user);
    }
       });
     
    }
});


/* Get login page */
router.get("/login",(req,res)=>{
  
   res.render("login",{title:"Login",csrfToken: req.csrfToken()});
});

/**
 Log a user into their account.
 Once a user is logged in, they will be sent to the dashboard page.
 */
router.post("/login",(req,res)=>{
   models.User.findOne({email: req.body.email}, "username email password",(err,user)=>{
      if(!user){
          res.render("login",{title:"Login","error":"User does not exist ",csrfToken: req.csrfToken()});
      }else {
      if (bcrypt.compareSync(req.body.password, user.password)) {
        server.createUserSession(req, res, user);
        res.redirect('/profile');
        
      }else {
        res.render('login', {title:"Login", "error": "Incorrect email or password.",csrfToken: req.csrfToken()});
      }
      }
   });
});

/* Get forgot password page */
router.get("/forgot",(req,res)=>{
   res.render("forgot",{title:"Forgot password",csrfToken: req.csrfToken()});
   
});

/* Handle forgot password */
router.post("/forgot",(req,res,next)=>{
async.waterfall([
    function(done) {
      crypto.randomBytes(20, function(err, buf) {
        let token = buf.toString('hex');
        done(err, token);
      });
    },
    function(token, done) {
      models.User.findOne({ email: req.body.email }, function(err, user) {
        if (!user) {
          req.flash('error', 'No account with that email address exists.');
          return res.redirect('/forgot');
        }

        user.resetPasswordToken = token;
        user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
        user.save(function(err) {
          done(err, token, user);
        });
      });
    },
    function(token, user, done) {
     var options = {
    auth: {
        api_user: 'tommyg13',
        api_key: pass
    }
}
let mailer = nodemailer.createTransport(sgTransport(options));
      let email = {
        to: user.email,
        from: 'thomasgk13@gmail.com',
        subject: 'Node.js Password Reset',
        text: 'You are receiving this because you (or someone else) have requested the reset of the password for your account.\n\n' +
          'Please click on the following link, or paste this into your browser to complete the process:\n\n' +
          'https://' + req.headers.host + '/reset/' + token + '\n\n' +
          'If you did not request this, please ignore this email and your password will remain unchanged.\n'
      };
     mailer.sendMail(email, function(err) {
        req.flash('success_msg', 'An e-mail has been sent to ' + user.email + ' with further instructions.Check also in spam folder');
        done(err, 'done');
      });
    }
      
      ], function(err){
             if (err) return next(err);
    res.redirect('/forgot');

      }
      );
});

/* render reset page*/
router.get('/reset/:token', function(req, res) {
  models.User.findOne({ resetPasswordToken: req.params.token, resetPasswordExpires: { $gt: Date.now() } }, function(err, user) {
    
    if (!user) {
      req.flash('error', 'Password reset token is invalid or has expired.');
      return res.redirect('/forgot');
    }
    res.render('reset',{title:"Password Reset",csrfToken: req.csrfToken()});
  });
});

/* handle reset */
router.post('/reset/:token', function(req, res) {
  
  async.waterfall([
    function(done) {
      models.User.findOne({ resetPasswordToken: req.params.token, resetPasswordExpires: { $gt: Date.now() } }, function(err, user) {
      
        if (!user) {
          req.flash('error', 'Password reset token is invalid or has expired.');
          return res.redirect('back');
        }
        if(user.email !== req.body.email){

            req.flash('error', 'Email is wrong');
            return res.redirect('back');
}
  if(req.body.password !==req.body.confirm){
     req.flash('error', 'Passwords do not match');
            return res.redirect('back');
  }
  
    if(req.body.password.length <6 ){
     req.flash('error', 'Password must be at least 6 characters');
            return res.redirect('back');
  }
    
    let salt = bcrypt.genSaltSync(10);
      let hash = bcrypt.hashSync(req.body.password, salt);
      req.body.password= hash;
        user.password = req.body.password;
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;
     
        user.save(function(err) {
            done(err, user);
        });
      });
    },
    function(user, done) {
     var options = {
    auth: {
        api_user: 'tommyg13',
        api_key: pass
    }
} 
      let email = {
        to: user.email,
        from: 'thomasgk13@gmail.com',
        subject: 'Your password has been changed',
        text: 'Hello,\n\n' +
          'This is a confirmation that the password for your account ' + user.email + ' has just been changed.\n'
      };
      let mailer = nodemailer.createTransport(sgTransport(options));
      
      mailer.sendMail(email, function(err) {
        if(err) console.log(err);
        req.flash('success_msg', 'Success! Your password has been changed.');
        res.redirect('/login');
      });
    }
  ], function(err) {
    res.redirect('/');
  });
});

/**
 * Log a user out of their account, then redirect them to the login page.
 */
router.get('/logout', function(req, res) {
  
  if (req.session) {
    req.session.destroy();
    req.session.reset();
  }
  req.flash('success_msg', 'You are logged out');
  res.redirect('/login');
});

/**
 Ensure a user is logged in before allowing them to continue their request.
 If a user isn't logged in, they'll be redirected back to the login page.
 */
function requireLogin (req, res, next) {
  if (req.session.user===undefined && req.user===undefined) {
    res.set('Cache-Control', 'no-cache, private, no-store, must-revalidate, max-stale=0, post-check=0, pre-check=0');
     req.session.destroy();
    res.redirect('/login');
  } else {
    next();
  }
}

/**
 * render user profile settings.
 */
 
router.get("/settings",requireLogin,function(req, res) {
   res.render("settings",{title:"settings",csrfToken: req.csrfToken()});
});

/**
 *  Update user Profile settings
 */
router.post("/settings",function(req, res) {

  let query={username: req.user.username};
  let error="";
  let success="";
  models.User.find(query)
   .then((doc)=>{
     if(req.body.New_username.length===0 || req.body.New_city.length===0){
       console.log("true")
       error="Fields cannot be empty";
     }
     else {
    doc[0].username=req.body.New_username;
    doc[0].city=req.body.New_city;
    doc[0].save();
    success="Your settings have been successfully updated";
     }
			res.render('settings',{title:"settings",success,error,csrfToken: req.csrfToken()});
			
});
});

/**
 *  Update user Password
 */
router.post("/password-change",function(req, res) {

  let query={username: req.user.username};
let salt = bcrypt.genSaltSync(10);
      let hash = bcrypt.hashSync(req.body.New_password, salt);
      req.body.New_password= hash;

  models.User.find(query)
   .then((doc)=>{

     if(req.body.New_password.length<6 || req.body.New_password1.length<6){

       req.flash('error', 'Password must be at least 6 characters');
     }
    if (!bcrypt.compareSync( req.body.Old_password,doc[0].password)) {
        req.flash('error', 'Your old password is incorrect');
    }
    
    if(!bcrypt.compareSync(req.body.New_password1, req.body.New_password)){
      req.flash('error', 'Passwords do not match');
    }
    else {
    doc[0].password=req.body.New_password;
    doc[0].save();
		 req.flash('success_msg', 'Your password has been successfully changed');
    }			
  res.redirect("/settings");
  async.waterfall([
    function(done) {
      crypto.randomBytes(20, function(err, buf) {
        var token = buf.toString('hex');
        done(err, token);
      });
    },
        function(token, done) {
      models.User.findOne({ email: req.user.email }, function(err, user) {
        if (err) {
          console.log(err);
        }

        user.resetPasswordToken = token;
        user.resetPasswordExpires = Date.now() + 3600000; // 1 hour

        user.save(function(err) {
          done(err, token, user);
        });
      });
    },
     function(token, user, done) {
     var options = {
    auth: {
        api_user: 'tommyg13',
        api_key: pass
    }
}
var mailer = nodemailer.createTransport(sgTransport(options));
      var email = {
        to: user.email,
        from: 'thomasgk13@gmail.com',
        subject: 'Node.js Password Change',
        text: 'You are receiving this because you (or someone else) have changed the password for your account.\n\n' +
          'If you did not request this, please click on the following link, or paste this into your browser to reset the password:\n\n' +
          'https://' + req.headers.host + '/reset/' + token + '\n\n' +
          'If you made the made the change, please ignore this email and your new password will remain unchanged.\n'
      };
     mailer.sendMail(email, function(err) {
        req.flash('success_msg', 'An e-mail has been sent to ' + user.email + ' with further instructions.');
        done(err, 'done');
      });
    }
  ]);
});
});

module.exports = router;