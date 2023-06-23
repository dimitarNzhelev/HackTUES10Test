const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const crypto = require('crypto');
const { PutObjectCommand, GetObjectCommand, S3Client, DeleteObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { pool } = require('../config/dbConf');
const generateFileName = (bytes = 32) => crypto.randomBytes(bytes).toString('hex')
const storage = multer.memoryStorage()
const upload = multer({storage: storage})
const dotenv = require('dotenv');

const router = express.Router();

dotenv.config();

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
    await pool.query('INSERT INTO posts(caption, description, imagename, user_id) VALUES($1, $2, $3, $4) RETURNING *', [req.body.caption, req.body.description, fileName, req.user.id]);
    res.redirect('/dashboard/upload');
});


router.get('/myposts', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT * FROM posts WHERE user_id = $1`,
            [req.user.id]
        );

        for(const post of result.rows){
            post.imageUrl = "https://d2skheuztgfb2.cloudfront.net/" + post.imagename
        }
        res.render("myPosts", {posts: result.rows});
    } catch (err) {
        console.log(err);
        res.status(500).send('Server error');
    }
});

router.delete('/myposts/:id', async (req, res) => {
    const id = req.params.id;
    const post = await pool.query(`SELECT * FROM posts WHERE id = $1`, [id]);
    if (!post) {
      res.status(404).send('Post not found');
      return;
    }
      
    const params = {
      Bucket: bucketName,
      Key: post.rows[0].imagename
    };
  
    const command = new DeleteObjectCommand(params);
    await s3.send(command);
    await pool.query('DELETE FROM posts WHERE id = $1', [id]);
    res.status(200).send('Post deleted successfully');
  });

router.get('/myposts/:id/update', async (req, res) => {
    const id = req.params.id;
    const post = await pool.query(`SELECT * FROM posts WHERE id = $1`, [id]);
    if (!post) {
      res.status(404).send('Post not found');
      return;
    }
    res.render('updatePost', {post: post.rows[0]});
});

router.post('/myposts/:id/update', upload.single('photo'), async (req, res) => {
    const id = req.params.id;
    const { caption, description } = req.body;
  
    try {
      const post = await pool.query(`SELECT * FROM posts WHERE id = $1`, [id]);
  
      if (!post) {
        res.status(404).send('Post not found');
        return;
      }
  
      const prevImageKey = post.rows[0].imagename;
      const deleteParams = {
        Bucket: bucketName,
        Key: prevImageKey
      };
      const deleteCommand = new DeleteObjectCommand(deleteParams);
      await s3.send(deleteCommand);
  
      const fileBuffer = await sharp(req.file.buffer)
        .resize({ width: 300, height: 300, fit: "contain" })
        .toBuffer();
      const newImageKey = generateFileName();
      const uploadParams = {
        Bucket: bucketName,
        Key: newImageKey,
        Body: fileBuffer,
        ContentType: req.file.mimetype
      };
      const uploadCommand = new PutObjectCommand(uploadParams);
      await s3.send(uploadCommand);
  
      await pool.query('UPDATE posts SET caption = $1, description = $2, imagename = $3 WHERE id = $4', [
        caption,
        description,
        newImageKey,
        id
      ]);

      res.redirect("/dashboard/myposts");
    } catch (err) {
      console.log(err);
      res.redirect("/dashboard");
    }
  });
  
  

router.get('/posts', async (req, res) => {
    const posts = (await pool.query("SELECT * FROM posts")).rows;
    for(const post of posts){
        const getObjectParams = {
            Bucket: bucketName,
            Key: post.imagename
        }
        const command = new GetObjectCommand(getObjectParams);
        const url = await getSignedUrl(s3, command, {expiresIn: 3600});
        post.imageUrl = url;
        console.log(url);
    }
    res.render("posts", {posts: posts});
})

module.exports = router;
