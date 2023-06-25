const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const { PutObjectCommand, GetObjectCommand, S3Client, DeleteObjectCommand } = require("@aws-sdk/client-s3");
const { pool } = require('../config/dbConf');
const { deletePostById, getMyPosts, uploadPost, getPostById, generateFileName, toggleLike, getLikeStatus, getUserById, getCommnetsByPost, deleteCommentById, updateCommentById, createComment, getTotalLikes} = require('../controllers/dashboardController');
const dotenv = require('dotenv');
const { getSignedUrl } = require("@aws-sdk/cloudfront-signer");

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
      post.imageUrl = getSignedUrl({
        url: "https://d2skheuztgfb2.cloudfront.net/" + post.imagename,
        dateLessThan: new Date(Date.now() + 60 * 60 * 1000 * 24),
        privateKey: process.env.CDN_PRIVATE_KEY,
        keyPairId: process.env.CDN_KEY_PAIR_ID
    })
    }
    res.render("posts", {posts: posts});
})

router.post('/myposts/:id/like', async (req, res) => {
  const postId = parseInt(req.params.id);
  const userId = req.user.id;
  try {
    await toggleLike(postId, userId);
    res.status(200).json({ message: 'Toggle like successful.' });
  } catch (error) {
    console.error('Error toggling like:', error);
    res.status(500).json({ message: 'Error toggling like.' });
  }
});

router.get('/posts/:id/likeStatus', async (req, res) => {
  const postId = parseInt(req.params.id);
  const userId = req.user.id;
  try {
    const likeStatus = await getLikeStatus(postId, userId);
    res.status(200).json({ likeStatus });
  } catch (error) {
    console.error('Error getting like status:', error);
    res.status(500).json({ message: 'Error getting like status.' });
  }
});

router.get('/posts/:id/comments', async (req, res) => {
  const postId = parseInt(req.params.id);
  try {
    const comments = (await pool.query('SELECT * FROM comments WHERE post_id = $1', [postId])).rows;
    res.status(200).json({ comments });
  } catch (error) {
    console.error('Error getting comments:', error);
    res.status(500).json({ message: 'Error getting comments.' });
  }
});

router.get('/posts/:id', async (req, res) => {
  const postId = req.params.id;
  const postData = await getPostById(postId);
  const userId = postData.user_id;
  const userData = await getUserById(userId); 
  postData.imageUrl = getSignedUrl({
    url: "https://d2skheuztgfb2.cloudfront.net/" + postData.imagename,
    dateLessThan: new Date(Date.now() + 60 * 60 * 1000 * 24),
    privateKey: process.env.CDN_PRIVATE_KEY,
    keyPairId: process.env.CDN_KEY_PAIR_ID
})
  const comments = await getCommnetsByPost(postId); 
  for(let i = 0; i < comments.length; i++) {
    let user = await getUserById(comments[i].user_id);
    comments[i].username = user.name;
}

  res.render('post', { post: postData, user: userData, comments: comments });
});

router.delete('/posts/:id/comments/:commentId', async (req, res) => {
  const commentId = req.params.commentId;
  try {
    const result = await deleteCommentById(commentId);
    if(result){
      res.status(200).json({ message: 'Comment deleted successfully.' });
    } else {
      res.status(404).json({ message: 'Comment not found.' });
    }
  } catch (error) {
    console.error('Error deleting comment:', error);
    res.status(500).json({ message: 'Error deleting comment.' });
  }
});

router.put('/posts/:id/comments/:commentId',express.json(), async (req, res) => {
  const commentId = req.params.commentId;
  const commentText = req.body.commentText;
  if(commentText.length > 0){
  try {
    const result = await updateCommentById(commentId, commentText);
    if(result){
      res.status(200).json({ message: 'Comment updated successfully.' , success: true});
    } else {
      res.status(404).json({ message: 'Comment not found.', success: false });
    }
  } catch (error) {
    console.error('Error updating comment:', error);
    res.status(500).json({ message: 'Error updating comment.',  success: false });
  }
  }else {
    return;
  }
});

router.post('/posts/:id/comments', express.json(), async (req, res) => {
  const postId = req.body.postId;
  const userId = req.body.userId
  const commentText = req.body.commentText;
  try {
    const comment = await createComment(postId, userId, commentText);
    console.log(comment.id)
    res.status(200).json({ commentId: comment.id, success: true });
  } catch (error) {
    console.error('Error creating comment:', error);
    res.status(500).json({ message: 'Error creating comment.' });
  }
});


router.get('/posts/:id/totalLikes', async (req, res) => {
  const postId = parseInt(req.params.id);
  try {
    const totalLikes = await getTotalLikes(postId);
    res.status(200).json({ totalLikes });
  } catch (error) {
    console.error('Error getting total likes:', error);
    res.status(500).json({ message: 'Error getting total likes.' });
  }
});

module.exports = router;