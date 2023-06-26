const express = require('express');
const router = express.Router();
const multer = require('multer');
const { getMyPosts, deletePostById } = require('../controllers/postController');
const {generateFileName} = require("../controllers/S3Service");
const { checkNotAuthenticated } = require('../middleware/authentication');
const storage = multer.memoryStorage()
const upload = multer({storage: storage})
const sharp = require('sharp');
const S3Service = require('../controllers/S3Service');
const {pool} = require('../config/dbConf');
const {S3Client, DeleteObjectCommand, PutObjectCommand} = require('@aws-sdk/client-s3');



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
router.use(checkNotAuthenticated);

router.get('/', async (req, res) => {
    try {
        res.render("myPosts", {posts: await getMyPosts(req.user.id)});
    } catch (err) { 
        console.log(err);
        res.status(500).send('Server error');
    }
});

router.delete('/:id', async (req, res) => {
    const id = req.params.id;
    if(await deletePostById(id)){
    res.status(200).send('Post deleted successfully');
    }else{
        res.status(404).send('Post not found');
        }
  });

router.get('/:id/update', async (req, res) => {
    const id = req.params.id;
    const post = await pool.query(`SELECT * FROM posts WHERE id = $1`, [id]);
    if (!post) {
      res.status(404).send('Post not found');
      return;
    }
    res.render('updatePost', {post: post.rows[0]});
});

router.get('/:id/share', async (req, res) => {
    const id = req.params.id;
    const post = await pool.query(`SELECT * FROM posts WHERE id = $1`, [id]);
    if (!post) {
      res.status(404).send('Post not found');
      return;
    }

    if(post.rows[0].visibility == 'unlisted'){
      res.send((await (S3Service.addImageUrls(post.rows)))[0].imageUrl);
    }else {
      res.status(403).send('Post is not unlisted');
    }
  });

router.post('/:id/update', upload.single('photo'), async (req, res) => {
  const id = req.params.id;
  const { caption, description } = req.body;
  console.log(caption, description);

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
    const newImageKey = await generateFileName();
    console.log(typeof bucketName, bucketName);
    console.log(typeof newImageKey, newImageKey);

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

module.exports = router;
