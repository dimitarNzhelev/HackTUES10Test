const express = require('express');
const bcrypt = require('bcrypt');
const validator = require('validator');
const passport = require('passport');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const { pool } = require('../config/dbConf');
const dotenv = require('dotenv');

const router = express.Router();
dotenv.config();

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL,
      pass: process.env.APP_PASSWORD
    }
  });


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
        
    const emailToken = crypto.randomBytes(64).toString('hex');
    
    pool.query(
        `INSERT INTO users (name, email, password, emailToken, isVerified) VALUES ($1, $2, $3, $4, $5) RETURNING id, password`,
        [name, email, hashedPassword, emailToken, false],
        (err, result) => {
            if(err){
                console.log(err);
                return;
            }
            const mailOptions = {
                from: process.env.EMAIL,
                to: email,
                subject: 'Verify Email',
                text: `Please click on the following link, or paste this into your browser to complete the process: \n\n http://${req.headers.host}/users/verify-email?token=${emailToken}\n\n`
            };

            transporter.sendMail(mailOptions, (err, response) => {
                if(err){
                    console.log(err);
                } else {
                    req.flash('success_msg', "Please check your email to verify your account.");
                    res.redirect("/users/login");
                }
            });
        }
    );

    }
})


router.get('/verify-email', async (req, res) => {
    const token = req.query.token;
    pool.query(
        `UPDATE users SET isVerified = $1 WHERE emailToken = $2 RETURNING id, password`,
        [true, token],
        (err, result) => {
            if(err){
                console.log(err);
                return;
            }
            req.flash('success_msg', "Successfully verified. Please log in.");
            res.redirect("/users/login");
        }
    );
});

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

