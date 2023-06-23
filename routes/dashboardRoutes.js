const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const crypto = require('crypto');
const { PutObjectCommand, GetObjectCommand, S3Client } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { pool } = require('../config/dbConf');
const generateFileName = (bytes = 32) => crypto.randomBytes(bytes).toString('hex')
const storage = multer.memoryStorage()
const upload = multer({storage: storage})
const dotenv = require('dotenv');

dotenv.config();

const router = express.Router();

const bucketName = process.env.BUCKET_NAME
const bucketRegion = process.env.BUCKET_REGION
const accessKey = process.env.ACCESS_KEY
const secretAccessKey = process.env.SECRET_ACCESS_KEY

const s3 = new S3Client({
    credentials: {
        accessKeyId: accessKey,
        secretAccessKey: secretAccessKey
    },
    region: bucketRegion
});

function checkNotAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
      return next();
    }
    res.redirect("/users/login");
  }

router.use(checkNotAuthenticated);


router.get('/', (req, res) =>{
    res.render('dashboard', {user: req.user.name});
});

router.get('/upload', (req, res) => {
    res.render('uploadPost');
});

router.post('/upload', upload.single('photo'), async (req, res) => {

    const fileBuffer = await sharp(req.file.buffer).resize({width: 400, height: 400, fit: "contain"}).toBuffer();
    const fileName = generateFileName();
    const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: fileName,
        Body: fileBuffer,
        ContentType: req.file.mimetype
    });

    await s3.send(command);
    const result = await pool.query('INSERT INTO posts(caption, description, imagename, user_id) VALUES($1, $2, $3, $4) RETURNING *', [req.body.caption, req.body.description, fileName, req.user.id]);
    console.log(result);
    res.redirect('/upload');
});


router.get('/myposts', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT * FROM posts WHERE user_id = $1`,
            [req.user.id]
        );

        let posts = [];
        for(const post of result.rows){
            const getObjectParams = {
                Bucket: bucketName,
                Key: post.imagename
            }
            const command = new GetObjectCommand(getObjectParams);
            const url = await getSignedUrl(s3, command, {expiresIn: 3600});
            post.imageUrl = url;
            posts.push(post);
            console.log(url);
        }
        res.render("myPosts", {posts: posts});
    } catch (err) {
        console.log(err);
        res.status(500).send('Server error');
    }
});

module.exports = router;
