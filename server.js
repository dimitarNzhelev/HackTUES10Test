const express = require('express');
const app = express();
const { pool } = require('./config/dbConf');
const session = require('express-session');
const flash = require('express-flash');
const passport = require('passport');
const initializePassport = require('./config/passportConfig');
const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3'); 
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const dotenv = require('dotenv');

dotenv.config();

const authRoutes = require("./routes/authRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes"); 

const bucketName = process.env.BUCKET_NAME;
const bucketRegion = process.env.BUCKET_REGION;
const accessKey = process.env.ACCESS_KEY;
const secretAccessKey = process.env.SECRET_ACCESS_KEY;

const s3 = new S3Client({
    credentials: {
        accessKeyId: accessKey,
        secretAccessKey: secretAccessKey
    },
    region: bucketRegion
});

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
