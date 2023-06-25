const express = require('express');
const router = express.Router();
const multer = require('multer');
const { getMyPosts, deletePostById } = require('../controllers/dashboardController');
const { checkNotAuthenticated } = require('../middleware/authentication');
const storage = multer.memoryStorage()
const upload = multer({storage: storage})


router.use(checkNotAuthenticated);

router.get('/', async (req, res) => {
    try {
        res.render("myPosts", {posts: await getMyPosts(req)});
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


router.post('/:id/update', upload.single('photo'), async (req, res) => {
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

module.exports = router;
