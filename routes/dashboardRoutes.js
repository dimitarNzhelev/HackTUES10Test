const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const { PutObjectCommand, GetObjectCommand, S3Client, DeleteObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { pool } = require('../config/dbConf');
const { deletePostById, getMyPosts, uploadPost, getPostById, generateFileName} = require('../controllers/dashboardController');
const dotenv = require('dotenv');
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

const storage = multer.memoryStorage()
const upload = multer({storage: storage})
const router = express.Router();

function checkNotAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
      return next();
    }
    res.redirect("/users/login");
  }

router.get('/', checkNotAuthenticated, (req, res) =>{
    res.render('dashboard', {user: req.user.name});
});


router.use(checkNotAuthenticated);
router.get('/upload', (req, res) => {
    res.render('uploadPost');
});

router.post('/upload', upload.single('photo'), async (req, res) => {

    await uploadPost(req);
    res.redirect('/dashboard/myposts');
});

router.get('/myposts', async (req, res) => {
    try {
        res.render("myPosts", {posts: await getMyPosts(req)});
    } catch (err) {
        console.log(err);
        res.status(500).send('Server error');
    }
});

router.delete('/myposts/:id', async (req, res) => {
    const id = req.params.id;
      console.log(id);
    if(await deletePostById(id)){
    res.status(200).send('Post deleted successfully');
    }else{
        res.status(404).send('Post not found');
        }
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
    if(req.file){
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
  }else{
    await pool.query('UPDATE posts SET caption = $1, description = $2 WHERE id = $3', [
      caption,
      description,
      id
    ]);
  }
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