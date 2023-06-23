const express = require('express');
const app = express();
const session = require('express-session');
const flash = require('express-flash');
const passport = require('passport');
const initializePassport = require('./config/passportConfig');
const dotenv = require('dotenv');

dotenv.config();

const authRoutes = require("./routes/authRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes"); 

initializePassport(passport);

const PORT = process.env.PORT || 4000;

app.set('view engine', 'ejs');
app.use(express.urlencoded({extended: false}));
app.use(session({
    secret: 'secret',
    resave: false,
    saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());
app.use(flash());

app.get('/', (req, res) =>{
    res.render('index');
});

app.use("/users", authRoutes);

app.use("/dashboard", dashboardRoutes);

app.listen(PORT, ()=>{
    console.log(`Server is running on port ${PORT}`);
});
