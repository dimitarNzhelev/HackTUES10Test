const dotenv = require('dotenv');
const { PutObjectCommand, GetObjectCommand, S3Client, DeleteObjectCommand } = require("@aws-sdk/client-s3");
const sharp = require('sharp');
const crypto = require('crypto');
const { pool } = require('../config/dbConf');

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



const generateFileName = (bytes = 32) => crypto.randomBytes(bytes).toString('hex')

async function getUserById(id){
    const result = await pool.query(
        `SELECT * FROM users WHERE id = $1`,
        [id]
    );

    return result.rows[0];
}

async function toggleLike(postId, userId) {
    const client = await pool.connect();
  
    try {
      await client.query('BEGIN');
  
      // Check if the post is currently liked by the user
      const likedResult = await client.query(
        'SELECT liked FROM likes WHERE post_id = $1 AND user_id = $2',
        [postId, userId]
      );
  
      if (likedResult.rows.length === 0) {
        // Insert a like if it doesn't exist
        await client.query(
          'INSERT INTO likes (post_id, user_id, liked) VALUES ($1, $2, true)',
          [postId, userId]
        );
      } else {
        const currentLikedState = likedResult.rows[0].liked;
  
        if (currentLikedState) {
          // Remove the like if it is currently liked
          await client.query(
            'DELETE FROM likes WHERE post_id = $1 AND user_id = $2',
            [postId, userId]
          );
        } else {
          // Insert a like if it is currently unliked
          await client.query(
            'INSERT INTO likes (post_id, user_id, liked) VALUES ($1, $2, true)',
            [postId, userId]
          );
        }
      }
  
      // Update the total likes count in the posts table
      await client.query(
        'UPDATE posts SET totallikes = (SELECT COUNT(*) FROM likes WHERE post_id = $1 AND liked = true) WHERE id = $1',
        [postId]
      );
  
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
}

async function uploadPost(req){
    if(req.file){
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

    }
}

async function getMyPosts(req){
    const result = await pool.query(
        `SELECT * FROM posts WHERE user_id = $1`,
        [req.user.id]
    );

    for(const post of result.rows){
        post.imageUrl = "https://d2skheuztgfb2.cloudfront.net/" + post.imagename
    }

    return result.rows;
}

async function deletePostById(id){
    const result = await pool.query(`SELECT * FROM posts WHERE id = $1`, [id]);
    if(result.rows.length === 0){
            return;
        }
    const params = {
      Bucket: bucketName,
      Key: result.rows[0].imagename
    };
  
    const command = new DeleteObjectCommand(params);
    await s3.send(command);
    await pool.query('DELETE FROM posts WHERE id = $1', [id]);

    return true;
}

async function getPostById(id) {
    const result = await pool.query('SELECT * FROM posts WHERE id = $1', [id]);
    return result.rows.length > 0 ? result.rows[0] : null;
}

async function getLikeStatus(postId, userId) {
    const result = await pool.query(
      'SELECT liked FROM likes WHERE post_id = $1 AND user_id = $2',
      [postId, userId]
    );
  
    if (result.rows.length === 0) {
      return false;
    }
  
    return true;
}

async function getCommnetsByPost(postId){
    const result = await pool.query(
        `SELECT * FROM comments WHERE post_id = $1`,
        [postId]
    );

    return result.rows;
}

async function addCommentByPost(postId, userId, comment){
    if(!comment){
        return;
    }

    try{
        await pool.query(
            `INSERT INTO comments(post_id, user_id, comment_text) VALUES($1, $2, $3)`,
            [postId, userId, comment]
        );
        return;
    }catch(err){
        console.log(err);
        return;
    }
}

async function deleteCommentById(commentId, user_id){
    const result = await pool.query(`SELECT * FROM comments WHERE id = $1`, [commentId]);
    if(result.rows.length === 0){
            return;
        }
    // if(result.rows[0].user_id == user_id){ TOVA GO PROVERQVAM OSHTE V FRONTENDA
        const res = await pool.query('DELETE FROM comments WHERE id = $1', [commentId]) && 
        //decrese comments count in posts table
        await pool.query('UPDATE posts SET totalcomments = totalcomments - 1 WHERE id = $1', [result.rows[0].post_id]);
        if(res){
            return true;
        }else{
            return false;
        }
    // }
}

async function updateCommentById(commentId, commentText) {
    const result = await pool.query(`SELECT * FROM comments WHERE id = $1`, [commentId]);
    
    if(result.rows.length === 0) {
        throw new Error(`No comment found with id: ${commentId}`);
    }

    const res = await pool.query('UPDATE comments SET comment_text = $1 WHERE id = $2', [commentText, commentId]);

    if(res.rowCount > 0){
        return true;
    } else {
        return false;
    }
}

async function createComment(postId, userId, commentText) {
    if(!commentText){
        return;
    }

    try{
        const newComment = await pool.query(
            `INSERT INTO comments(post_id, user_id, comment_text) VALUES($1, $2, $3) RETURNING *`,
            [postId, userId, commentText]
        );

        await pool.query(
            `UPDATE posts SET totalcomments = (SELECT COUNT(*) FROM comments WHERE post_id = $1) WHERE id = $1`,
            [postId]
        );

        return newComment.rows[0];
    }catch(err){
        console.log(err);
        return;
    }
}



module.exports = 
{
    getMyPosts,
    uploadPost,
    deletePostById,
    getPostById,
    generateFileName,
    toggleLike,
    getLikeStatus,
    getCommnetsByPost,
    addCommentByPost,
    deleteCommentById,
    getUserById,
    updateCommentById,
    createComment
};