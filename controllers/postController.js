const { pool } = require('../config/dbConf');
const  {generateFileName} = require('./S3Service.js');
const S3Service = require('./S3Service.js');
const {PutObjectCommand, S3Client} = require('@aws-sdk/client-s3');
const sharp = require('sharp');
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



async function getMyPosts(userId){
    const result = await pool.query('SELECT * FROM posts WHERE user_id = $1', [userId]);
    return S3Service.addImageUrls(result.rows);
}

async function uploadPost(req) {
    if(req.file){
        const fileBuffer = await sharp(req.file.buffer).resize({width: 400, height: 400, fit: "contain"}).toBuffer();
        const fileName = await generateFileName();
        const command = new PutObjectCommand({
            Bucket: bucketName,
            Key: fileName,
            Body: fileBuffer,
            ContentType: req.file.mimetype
        });
    
        await s3.send(command);
        await pool.query('INSERT INTO posts(caption, description, imagename, user_id, visibility) VALUES($1, $2, $3, $4, $5) RETURNING *', [req.body.caption, req.body.description, fileName, req.user.id, req.body.visibility]);
    
        }
}

async function deletePostById(id) {
    return S3Service.deletePostById(id);
}

async function getPostById(id) {
    const result = await pool.query('SELECT * FROM posts WHERE id = $1', [id]);
    return result.rows.length > 0 ? result.rows[0] : null;
}

async function toggleLike(postId, userId) {
    const client = await pool.connect();
  
    try {
        await client.query('BEGIN');
        const likedResult = await client.query('SELECT liked FROM likes WHERE post_id = $1 AND user_id = $2', [postId, userId]);
  
        if (likedResult.rows.length === 0) {
            await client.query('INSERT INTO likes (post_id, user_id, liked) VALUES ($1, $2, true)', [postId, userId]);
        } else {
            const currentLikedState = likedResult.rows[0].liked;
  
            if (currentLikedState) {
                await client.query('DELETE FROM likes WHERE post_id = $1 AND user_id = $2', [postId, userId]);
            } else {
                await client.query('INSERT INTO likes (post_id, user_id, liked) VALUES ($1, $2, true)', [postId, userId]);
            }
        }
  
        await client.query('UPDATE posts SET totallikes = (SELECT COUNT(*) FROM likes WHERE post_id = $1 AND liked = true) WHERE id = $1', [postId]);
        await client.query('COMMIT');
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

async function getLikeStatus(postId, userId) {
    const result = await pool.query('SELECT liked FROM likes WHERE post_id = $1 AND user_id = $2', [postId, userId]);

    if (result.rows.length === 0) {
        return false;
      }
    
      return true;
}

async function getTotalLikes(postId){
    const result = await pool.query(
        `SELECT totallikes FROM posts WHERE id = $1`,
        [postId]
    );

    return result.rows[0].totallikes;
}

module.exports = {
    getMyPosts,
    uploadPost,
    deletePostById,
    getPostById,
    toggleLike,
    getLikeStatus,
    getTotalLikes
};
