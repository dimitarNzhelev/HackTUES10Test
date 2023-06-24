const express = require('express');
const app = express();
const session = require('express-session');
const flash = require('express-flash');
const passport = require('passport');
const initializePassport = require('./config/passportConfig');
const cors = require('cors');


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
// app.use(cors()); //enable it for all routes

var corsOptions = {
    origin: 'asddasdadada.com',
    optionsSuccessStatus: 200 
  }
  
  app.use(cors(corsOptions));


app.get('/', (req, res) =>{
    res.render('index');
});

app.use("/users", authRoutes);

app.use("/dashboard", dashboardRoutes);

app.listen(PORT, ()=>{
    console.log(`Server is running on port ${PORT}`);
});
