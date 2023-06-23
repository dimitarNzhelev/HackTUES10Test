const express = require('express');
const bcrypt = require('bcrypt');
const validator = require('validator');
const passport = require('passport');
const { pool } = require('../config/dbConf');

const router = express.Router();

router.get('/register', checkAuthenticated,(req, res) =>{
    res.render('register');
});

router.post('/register',async (req, res) => {
    let {name, email, password, password2} = req.body;

    let errors = [];

    if(!name ||!email ||!password ||!password2){
        errors.push({msg: 'Please fill all fields'});
    }

    if(password.length < 6){
        errors.push({msg: 'Password must be at least 6 characters'});
    }

    if(password!=password2){
        errors.push({msg: 'Passwords do not match'});
    }
    if (!validator.isEmail(email)) {
        errors.push({msg: 'Invalid email'});
    }

    if(errors.length > 0){
        res.render('register', {errors: errors});
    }else{
        let hashedPassword = await bcrypt.hash(password, 10);
    
    pool.query(
        `SELECT * FROM users WHERE email = $1`,
        [email],
        (err, result) => {
            if(err){
                console.log(err);
                return;
            }
    
            if(result.rows.length > 0){
                errors.push({msg: 'Email already registered'});
                res.render('register', {errors});
            }else{
                pool.query(
                    `INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING id, password`,
                    [name, email, hashedPassword],
                    (err, result) => {
                        if(err){
                            console.log(err);
                            return;
                        }
                        req.flash('success_msg', "Successfully registered. Please log in.");
                        res.redirect("/users/login");
                    }
                );
            }
        }
    );

    }
})

router.get('/login',checkAuthenticated, (req, res) => {
    res.render('login');
});

router.post("/login",
    passport.authenticate("local", {
      successRedirect: "/dashboard",
      failureRedirect: "/users/login",
      failureFlash: true
    })
);

router.get("/logout", (req, res) => {
    req.logOut(function(err) {
        if(err)
        {
            return next(err);
        }
        res.render("index", { message: "You have logged out successfully" });
    });
   
}); 

function checkAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
      return res.redirect("/users/dashboard");
    }
    next();
  }
  
module.exports = router;
