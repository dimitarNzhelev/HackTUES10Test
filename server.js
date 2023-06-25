const express = require('express');
const app = express();
const session = require('express-session');
const flash = require('express-flash');
const passport = require('passport');
const initializePassport = require('./config/passportConfig');
const cors = require('cors');
const homeRouter = require('./routes/home');
const uploadRouter = require('./routes/upload');
const mypostsRouter = require('./routes/myposts');
const likeRouter = require('./routes/like');
const postsRouter = require('./routes/posts');
const commentsRouter = require('./routes/comments');
const authRoutes = require("./routes/auth");

initializePassport(passport);

const PORT = process.env.PORT || 4000;

app.set('view engine', 'ejs');
app.use(express.urlencoded({extended: false}));
app.use(session({
    secret: 'secret',
    resave: false,
    saveUninitialized: true,
    cookie: {
        secure: false,
        maxAge: 24 * 60 * 60 * 1000
            }
}));

app.use(passport.initialize());
app.use(passport.session());
app.use(flash());

var corsOptions = {
    origin: 'spahsbashtati.com',
    optionsSuccessStatus: 200 
  }
  
  app.use(cors(corsOptions));


app.get('/', (req, res) =>{
    res.render('index');
});

app.use("/auth", authRoutes);

app.use('/dashboard', homeRouter);
app.use('/dashboard/upload', uploadRouter);
app.use('/dashboard/myposts', mypostsRouter);
app.use('/dashboard/posts/like', likeRouter);
app.use('/dashboard/posts', postsRouter);
app.use('/dashboard/posts/:id/comments', commentsRouter);

app.listen(8080, () => {
  console.log('Server started on port 3000');
});

