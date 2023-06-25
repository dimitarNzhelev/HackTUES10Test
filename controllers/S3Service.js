const { PutObjectCommand, GetObjectCommand, S3Client, DeleteObjectCommand } = require("@aws-sdk/client-s3");
const { CloudFrontClient, CreateInvalidationCommand } = require("@aws-sdk/client-cloudfront");
const sharp = require('sharp');
const crypto = require('crypto');
const dotenv = require('dotenv');
const {pool} = require('../config/dbConf');
const { getSignedUrl } = require("@aws-sdk/cloudfront-signer");

dotenv.config();

const bucketName = process.env.BUCKET_NAME
const bucketRegion = process.env.BUCKET_REGION
const accessKey = process.env.ACCESS_KEY
const secretAccessKey = process.env.SECRET_ACCESS_KEY
const cloudFontDistId = process.env.CLOUDFRONT_DIST_ID


const s3 = new S3Client({
    credentials: {
        accessKeyId: accessKey,
        secretAccessKey: secretAccessKey
    },
    region: bucketRegion
});


const cloudfront = new CloudFrontClient({
  credentials: {
    accessKeyId: accessKey,
    secretAccessKey: secretAccessKey,
  },
  region: bucketRegion
});

async function generateFileName(bytes = 32) {
    return crypto.randomBytes(bytes).toString('hex')
}

async function addImageUrls(posts) {
    for(const post of posts){
        post.imageUrl = getSignedUrl({
            url: "https://d2skheuztgfb2.cloudfront.net/" + post.imagename,
            dateLessThan: new Date(Date.now() + 60 * 60 * 1000 * 24),
            privateKey: process.env.CDN_PRIVATE_KEY,
            keyPairId: process.env.CDN_KEY_PAIR_ID
        });
        console.log(post.imageUrl)
    }

    return posts;
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

    const invalidationParams = {
            DistributionId: cloudFontDistId,
            InvalidationBatch: {
                CallerReference: result.rows[0].imagename,
                Paths: {
                    Quantity: 1,
                    Items: [
                        "/" + result.rows[0].imagename
                    ]
                }
        }
    }

    const invalidationCommand = new CreateInvalidationCommand(invalidationParams);
    await cloudfront.send(invalidationCommand);

    await pool.query('DELETE FROM likes WHERE post_id = $1', [id])
    await pool.query('DELETE FROM comments WHERE post_id = $1', [id])
    await pool.query('DELETE FROM posts WHERE id = $1', [id]);

    return true;
}

module.exports = {
    generateFileName,
    addImageUrls,
    deletePostById,
};
