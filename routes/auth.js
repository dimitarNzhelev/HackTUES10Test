const express = require('express');
const validator = require('validator');
const passport = require('passport');
const {validateUser, insertUserAndSendEmail} = require('../controllers/authController');
const router = express.Router();
const {pool} = require('../config/dbConf');


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
        insertUserAndSendEmail(req, res, name, email, password);
    }
})


router.get('/verify-email', async (req, res) => {
    const token = req.query.token;
    validateUser(req, res, token);
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

router.get('/:id', async (req, res) => {
    const id = req.params.id;
    try {
        const userResult = await pool.query(`SELECT * FROM users WHERE id = $1`, [id]);
        
        if (userResult.rows.length === 0) {
            res.status(404).send('User not found');
            return;
        }

        res.status(200).json(userResult.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'An error occurred while fetching the user' });
    }
});



function checkAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
      return res.redirect("/dashboard");
    }
    next();
  }
  
module.exports = router;

