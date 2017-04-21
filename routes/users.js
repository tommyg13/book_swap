"use strict";
const express = require("express");
const bcrypt = require("bcryptjs");
const models = require("../models/model");
const bookModel = require("../models/books");
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
  // hash the passwords
  let salt = bcrypt.genSaltSync(10);
  let hash = bcrypt.hashSync(req.body.password, salt);
  let hash1 = bcrypt.hashSync(req.body.password2, salt);
  
  //create new model
  let user = new models.User({
    username:   req.body.username,
    email:      req.body.email,
    first_name: req.body.first_name,
    last_name:  req.body.last_name,
    city:       req.body.city,
    requests:   [],
    requested:  [],
    messages:   [],
    password:   hash,
    password2:  hash1
  });
  
  // set requirements
	req.checkBody('email', 'Email is required').notEmpty();
	req.checkBody('email', 'Email is not valid').isEmail();
	req.checkBody('username', 'Username is required').notEmpty();
	req.checkBody('first_name', 'First Name is required').notEmpty();
	req.checkBody('last_name', 'Last Name is required').notEmpty();
	req.checkBody('city', 'Field is required').notEmpty();
	req.checkBody('password', 'Password is required').notEmpty();
	req.checkBody('password', 'Password must be at least 6 characters').isLength({min:6});
  req.checkBody('password2', 'Passwords do not match').equals(req.body.password);
  
  // handle the errors
      var errors = req.validationErrors();
if(errors){
  
    req.session.destroy();
    req.session.reset();
      res.render('register', { errors: errors,csrfToken: req.csrfToken() });
    }
    
  // if not errors save user on db  
    else {
       user.save(function(err,user) {
      let errors = req.validationErrors();
      let error ="";
    // handle duplicates on username and email
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
    
    // redirect user on login pag
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
     
     // render the login page if user not exists
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

/**
 * Render all the books
 */ 
router.get("/allbooks",requireLogin,(req,res)=>{
  let books=[];
     //find all the books and render them on the view
    bookModel.Book.find()
			.then((doc)=>{
        doc.map((bk)=>{
          if(req.user.email!==bk.user){
          books.push(bk);
          }
});
  let query={email:req.user.email};
  let tradeRequests=[];
  let numberOfRequests=0;
  let requested=[];
  let numberOfRequested=0;
  let messages=[];
  let totalMessages=0;
  let total=0;
     models.User.find(query)
      .then((doc)=>{
         // pass the requests to the view
        tradeRequests=doc[0].requests,
        numberOfRequests=tradeRequests.length,
        requested=doc[0].requested,
        numberOfRequested=requested.length,
        total=numberOfRequested+numberOfRequests;
        messages=doc[0].messages;
        totalMessages=messages.length;
  res.render("allBooks",{title:"Home",books,total,totalMessages,csrfToken: req.csrfToken()});
      });
			});
 });

/** 
 * send request for a book
 */
router.post("/allbooks",requireLogin,(req,res)=>{
  let id=req.body.handle;
  let query={_id:id};
  var title="";
  let owner="";
  //find the owner of the book 
  bookModel.Book.findById(query,(err,data)=>{
    if(err)console.log(err);
    else {
      title=data.title;
      owner=data.user;
      id=data._id;
    }
    let requestedUser={email:req.user.email};
    let reqs={
      book:title,
      id:id
    };
  //push title of book on request array of user
  models.User.update(requestedUser,{$push: {requests:reqs}},(err,data1)=>{
        if(err)console.log(err);
       });
    let user={email:owner};
    let reqs1={
      book:title,
      id:id
    };
  //push title of book on requested array of user
  models.User.update(user,{$push: {requested:reqs1}},(err,data2)=>{
        if(err)console.log(err);
        else {
          data.hasRequested=false;
          data.save();
        }
       });
});

  req.flash("success_msg","Your request has been sent");
  res.redirect("/allbooks");
});

router.get("/books",(req,res)=>{
  let books=[];
  bookModel.Book.find()
  .then(book=>{
    book.map(bk=>{
      books.push(bk);
    });
    res.render("public",{title:"Home",books});
  });
});

/**
 * Render page with messages
 */ 
router.get("/profile/messages",requireLogin,(req,res)=>{
  let query={email:req.user.email};
  let tradeRequests=[];
  let numberOfRequests=0;
  let requested=[];
  let numberOfRequested=0;
  let messages=[];
  let total=0;
  let totalMessages=0;
     models.User.find(query)
      .then((doc)=>{
         // pass the requests to the view
        tradeRequests=doc[0].requests,
        numberOfRequests=tradeRequests.length,
        requested=doc[0].requested,
        numberOfRequested=requested.length,
        total=numberOfRequested+numberOfRequests;
        messages=doc[0].messages;
        totalMessages=messages.length;
  res.render("messages",{title:"messages",total,messages,totalMessages,csrfToken: req.csrfToken()});
      });
});

/**
 * delete all the messages
 */ 
router.post("/profile/messages",(req,res)=>{
   models.User.find({email:req.user.email})
   .then(user=>{
     let messages=user[0].messages;
     messages.splice(0,messages.length);
     user[0].save();
   });
   res.redirect("/profile/messages");
});

/* Get forgot password page */
router.get("/forgot",(req,res)=>{
   res.render("forgot",{title:"Forgot password",csrfToken: req.csrfToken()});
   
});

/* Handle forgot password */
router.post("/forgot",(req,res,next)=>{
async.waterfall([
    function(done) {
      
      // create token for the email
      crypto.randomBytes(20, function(err, buf) {
        let token = buf.toString('hex');
        done(err, token);
      });
    },
    function(token, done) {
      models.User.findOne({ email: req.body.email }, function(err, user) {
        
        // redirect to the forgot page if no user found
        if (!user) {
          req.flash('error', 'No account with that email address exists.');
          return res.redirect('/forgot');
        }
      
      // save token with expiration date
        user.resetPasswordToken = token;
        user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
        user.save(function(err) {
          done(err, token, user);
        });
      });
    },
    function(token, user, done) {
     
     // email options
     var options = {
    auth: {
        api_user: 'tommyg13',
        api_key: pass
    }
}
let mailer = nodemailer.createTransport(sgTransport(options));
      
      // create the email for reseting password
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
        // handle the errors
             if (err) return next(err);
    res.redirect('/forgot');

      }
      );
});

/* render reset page*/
router.get('/reset/:token', function(req, res) {
  models.User.findOne({ resetPasswordToken: req.params.token, resetPasswordExpires: { $gt: Date.now() } }, function(err, user) {
    
    // render message if token is invalid or has expired
    if (!user) {
      req.flash('error', 'Password reset token is invalid or has expired.');
      return res.redirect('/forgot');
    }
    
    // if token is correct proceed to reset page
    res.render('reset',{title:"Password Reset",csrfToken: req.csrfToken()});
  });
});

/* handle reset */
router.post('/reset/:token', function(req, res) {
  
  async.waterfall([
    function(done) {
      models.User.findOne({ resetPasswordToken: req.params.token, resetPasswordExpires: { $gt: Date.now() } }, function(err, user) {
      
      // render message if token is invalid or has expired
        if (!user) {
          req.flash('error', 'Password reset token is invalid or has expired.');
          return res.redirect('back');
        }
        
        // throw error if emails not match
        if(user.email !== req.body.email){
          req.flash('error', 'Email is wrong');
            return res.redirect('back');
  }
        // check if the passwords are equal
        if(req.body.password !==req.body.confirm){
          req.flash('error', 'Passwords do not match');
            return res.redirect('back');
  }
        // check passwords length
        if(req.body.password.length <6 ){
          req.flash('error', 'Password must be at least 6 characters');
            return res.redirect('back');
  }
    
        // has the password
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
     
           // username and password for the email
           var options = {
            auth: {
              api_user: 'tommyg13',
              api_key: pass
        }
  }; 
      // send confirmation email
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
        
        // check if user is logged in and destroy session 
        if (req.session) {
          req.session.destroy();
          req.session.reset();
      }
      
          // redirect to login page after logout
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
 * render user profile settings
 */
 
router.get("/settings",requireLogin,function(req, res) {
    let query={email:req.user.email};
  let tradeRequests=[];
  let numberOfRequests=0;
  let requested=[];
  let numberOfRequested=0;
  let total=0;
  let totalMessages=0;
  let messages=[];
     models.User.find(query)
      .then((doc)=>{
         // pass the requests to the view
         tradeRequests=(doc[0].requests),
        numberOfRequests=tradeRequests.length,
        requested=(doc[0].requested),
        numberOfRequested=requested.length,
        total=numberOfRequested+numberOfRequests;
        messages=doc[0].messages;
        totalMessages=messages.length;
   res.render("settings",{title:"settings",total,totalMessages,csrfToken: req.csrfToken()});
      });
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
        
        // check the length of the fields
         if(req.body.New_username.length===0 || req.body.New_city.length===0){
          error="Fields cannot be empty";
    }
     else {
       
       // save new username and new city
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
  
  // hash the password
  let salt = bcrypt.genSaltSync(10);
  let hash = bcrypt.hashSync(req.body.New_password, salt);
  req.body.New_password= hash;

  models.User.find(query)
   .then((doc)=>{
      
      // check password length
     if(req.body.New_password.length<6 || req.body.New_password1.length<6){
       req.flash('error', 'Password must be at least 6 characters');
     }
     
     // check if the old password is correct
     if (!bcrypt.compareSync( req.body.Old_password,doc[0].password)) {
        req.flash('error', 'Your old password is incorrect');
    }
    
    // check if new password and password confirm are equal
    if(!bcrypt.compareSync(req.body.New_password1, req.body.New_password)){
      req.flash('error', 'Passwords do not match');
    }
    
    // if not errors update password
    else {
    doc[0].password=req.body.New_password;
    doc[0].save();
		 req.flash('success_msg', 'Your password has been successfully changed');
    }			
    res.redirect("/settings");
    async.waterfall([
      function(done) {
        
        // create token 
        crypto.randomBytes(20, function(err, buf) {
        var token = buf.toString('hex');
        done(err, token);
      });
    },
        function(token, done) {
          models.User.findOne({ email: req.user.email }, function(err, user) {
          if (err) {console.log(err);}
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