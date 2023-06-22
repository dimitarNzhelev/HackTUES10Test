const express = require('express');
const app = express();
const { pool } = require('../DBConf');
const bcrypt = require('bcrypt');
const session = require('express-session');
const flash = require('express-flash');
const passport = require('passport');
const emailValidator = require('deep-email-validator');




const initializePassport = require('../passportConfig');

initializePassport(passport);

const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.use(express.urlencoded({extended: false}));
app.use(session({
    secret: 'secret',
    resave: false,
    saveUninitialized: false
}))
app.use(passport.initialize());
app.use(passport.session());
app.use(flash());

app.get('/', (req, res) =>{
    res.render('index');
});

app.get('/users/register', checkAuthenticated,(req, res) =>{
    res.render('register');
});

app.get('/users/login',checkAuthenticated, (req, res) => {
    res.render('login');
});
  
app.get('/users/dashboard', checkNotAuthenticated, (req, res) =>{
    res.render('dashboard', {user: req.user.name});
});
app.get("/users/logout", (req, res) => {
    req.logOut(function(err) {
        if(err)
        {
            return next(err);
        }
        res.render("index", { message: "You have logged out successfully" });
    });
   
  });

app.post('/users/register',async (req, res) => {
    let {name, email, password, password2} = req.body;
    console.log(name, email, password, password2);

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
    const {valid} = await isEmailValid(email);

    if(!valid){
        errors.push({msg: 'Invalid email'});
    }

    if(errors.length > 0){
        res.render('register', {errors: errors});
    }else{
        let hashedPassword = await bcrypt.hash(password, 10);
        console.log(hashedPassword);
    
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

app.post("/users/login",
    passport.authenticate("local", {
      successRedirect: "/users/dashboard",
      failureRedirect: "/users/login",
      failureFlash: true
    })
  );

  function checkAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
      return res.redirect("/users/dashboard");
    }
    next();
  }
  
  function checkNotAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
      return next();
    }
    res.redirect("/users/login");
  }

  async function isEmailValid(email) {
    return emailValidator.validate(email)
  }

app.listen(PORT, ()=>{
    console.log(`Server is running on port ${PORT}`);
});
