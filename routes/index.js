const express = require("express");
const bookModel = require("../models/books");
const models = require("../models/model");
const router = express.Router();


/* Get home page */
router.get("/",(req,res)=>{
     if (req.session.user===undefined  && req.user===undefined) {
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
  if (req.session.user===undefined) {
     res.set('Cache-Control', 'no-cache, private, no-store, must-revalidate, max-stale=0, post-check=0, pre-check=0');
     req.session.destroy();
     res.redirect('/login');
  } else {
     next();
  }
}

/*Render the profile page. */
router.get('/profile', requireLogin, function(req, res) {
    let books=[];
  let auth= [];
  let tradeRequests=[];
  let numberOfRequests=0;
  let requested=[];
  let numberOfRequested=0;
  let total=0;
  let totalMessages=0;
  let messages=[];
  let query={};
    query={email:req.user.email};
     models.User.find(query)
      .then((doc)=>{
          
         // pass the requests to the view
         doc[0].requests.map(x=>{
        tradeRequests.push(x);
        numberOfRequests=tradeRequests.length;
         });
        doc[0].requested.map(x=>{
        requested.push(x);
        numberOfRequested=requested.length;
        });
        total=numberOfRequested+numberOfRequests;
        messages=doc[0].messages;
        totalMessages=messages.length;
    let search={user:req.user.email};
    
    bookModel.Book.find(search)
	.then((doc)=>{
    doc.map((bk)=>{
        books.push(bk);
    });
    res.render("profile",{title:"Profile",books,auth,totalMessages,tradeRequests,numberOfRequests,total,requested,numberOfRequested,csrfToken: req.csrfToken()});
          });
	});
});

/**
 * Add new book
 */
router.post("/profile",requireLogin,(req,res)=>{
    let item={
        title:req.body.imageName,
        url:req.body.imageURL,
        user:req.user.email
};
    let error="";
    let helper=false;
    bookModel.Book.find()
    .then(books=>{
        // not allow user to have multiple books with same title
        books.map(book=>{
           if(item.title===book.title && book.user===req.user.email){
            error="you have already added this book";
            helper=true;
           }
        });
    // save if title not exist
   if(helper===false){
    let data = new bookModel.Book(item);
    data.save();
 }
    /**
    * delete bokk and remove any requests before deleting the book
    */ 
 let del=req.body.del;
if(del!=="" || del!==undefined){
   let query={_id:del};
    bookModel.Book.find(query).then(book=>{
    let params={book:book[0].title,id:book[0]._id};
    models.User.find()
    // remove request from requester array before deleting the book
    .then(users=>{
        users.map(user=>{
    models.User.update({_id:user._id},{$pull:{requests:params}},(err)=>{
        if(err)console.log(err);
    });
    // remove request from the owner
    models.User.update({_id:user._id},{$pull:{requested:params}},(err)=>{
        if(err)console.log(err);
    });
        });
    });
    });
    // delete the book
    bookModel.Book.findByIdAndRemove(query).exec();
}
    req.flash("error",error);
    res.redirect("/profile"); 
    });
});

/**
 * reject your trade and remove requests
 */ 
router.post("/handleReq",(req,res)=>{
    let reject=req.body.reject;
    // remove current user's pending requests
    if(reject!=="" || reject!==undefined){
    let id={_id:reject};
      bookModel.Book.find(id).then(book=>{
          let owner=book[0].user;
          let title=book[0].title;
          //make book available again after rejection
          book[0].hasRequested=true;
          book[0].save();
    models.User.find({email:owner}).then(user=>{
    let value={book:title,id:book[0]._id};

    let userId=user[0]._id;
    //remove the request from the array of owner
     models.User.update({_id:userId},{$pull: {requested:value}},(err)=>{
        if(err)console.log(err);
       });
    let query={email:req.user.email};
     models.User.find(query).then(user1=>{
        let userId1=user1[0]._id;
    // remove the request from the array of the requester
        models.User.update({_id:userId1},{$pull: {requests:value}},(err)=>{
        if(err)console.log(err);
       });   
     });
    });
      });
}
    /**
     * reject a trade from other user, remove the requsts and send message
     */ 
    let reject1=req.body.reject1;
    // remove current user's pending requests
    if(reject1!=="" || reject1!==undefined){
      let id={_id:reject1};
           bookModel.Book.find(id).then(book=>{
          //make book available again after rejection
          book[0].hasRequested=true;
          book[0].save();
         models.User.find()
         .then(users=>{
              let value={};
              let senderId;
              let bookOwner;
              let params={};
            users.map(user=>{
                //find who sent the request
               user.requests.map(request=>{
                  if(request.book===book[0].title && request.id.toString()===id._id){
                     value={book:book[0].title,id:book[0]._id};
                     senderId={_id:user._id};
                  }
               });
               // find the owner of the book
              user.requested.map(requested=>{
                if(requested.book===book[0].title && requested.id.toString()===id._id){
                   params={book:book[0].title,id:book[0]._id};
                  bookOwner={_id:user._id};
                } 
              });
            });
        //remove  the request from the user that send the request after rejection
        models.User.find(senderId).then(sender=>{
        models.User.update({_id:sender},{$pull: {requests:value}},(err)=>{
        if(err)console.log(err);
       });
       //send message to the user who requested that this request has benn rejected
       let message="Your request about " + value.book + " has been rejected!";
        models.User.update({_id:sender},{$push: {messages:message}},(err)=>{
        if(err)console.log(err);
       });
        });
        // remove the request from the user's requested array
        models.User.find(bookOwner).then(requester=>{
        models.User.update({_id:requester},{$pull: {requested:params}},(err)=>{
        if(err)console.log(err);
       });
        });        
    });
    });
    }
    
    /**
     * accept the trade,remove book from the db, remove the requests and send verification message
     */
    let handleTrades=req.body.handleTrades;
    if(handleTrades!=="" || handleTrades!==undefined){
        let id={_id:handleTrades};
    bookModel.Book.find(id)
    .then(book=>{
        let params={book:book[0].title,id:book[0]._id};
        let owner=book[0].user;
        models.User.find({email:owner})
        .then(users=>{
        let ownerId={_id:users[0]._id};
        let ownerUsername=users[0].username;
        let ownerEmail=users[0].email;
        //remove the request from the owner
        models.User.update(ownerId,{$pull: {requested:params}},(err)=>{
        if(err)console.log(err);
       });
        
        models.User.find()
        .then(users=>{
        let userId={};
        users.map(user=>{
        user.requests.map(reqs=>{
           if(params.id.toString()===reqs.id.toString()){
           userId={_id:user._id};
           }
        });
        });
        //remove the request from the user who sent the request
        models.User.update({_id:userId},{$pull: {requests:params}},(err)=>{
        if(err)console.log(err);
        });
        let message=ownerUsername + " has accepted your request about " + book[0].title + " Contact him at "+ ownerEmail + " to arrange the trade.";
        models.User.update({_id:userId},{$push: {messages:message}},(err)=>{
        if(err)console.log(err);
        });        
        });
    });
    });
     bookModel.Book.findByIdAndRemove(id).exec();
    }
    res.redirect("/profile");   
});

module.exports = router;