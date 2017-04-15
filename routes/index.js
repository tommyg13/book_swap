const express = require("express");
const router = express.Router();


/* Get home page */
router.get("/",(req,res)=>{
     if (req.session.user===undefined) {
    res.render("index",{title:"Home"});
     }
     else {
    res.redirect("/profile");
     }
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

/*Render the profile page. */
router.get('/profile', requireLogin, function(req, res) {
    res.render("profile",{title:"Profile"});
});



module.exports = router;