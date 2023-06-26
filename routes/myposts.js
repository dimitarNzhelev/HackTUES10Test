const express = require("express");
const router = express.Router();
const multer = require("multer");
const { getMyPosts, deletePostById } = require("../controllers/postController");
const { generateFileName } = require("../controllers/S3Service");
const { checkNotAuthenticated } = require("../middleware/authentication");
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });
const sharp = require("sharp");
const S3Service = require("../controllers/S3Service");
const { pool } = require("../config/dbConf");
const {
  S3Client,
  DeleteObjectCommand,
  PutObjectCommand,
} = require("@aws-sdk/client-s3");

const bucketName = process.env.BUCKET_NAME;
const bucketRegion = process.env.BUCKET_REGION;
const accessKey = process.env.ACCESS_KEY;
const secretAccessKey = process.env.SECRET_ACCESS_KEY;

const s3 = new S3Client({
  credentials: {
    accessKeyId: accessKey,
    secretAccessKey: secretAccessKey,
  },
  region: bucketRegion,
});
router.use(checkNotAuthenticated);

router.get("/", async (req, res) => {
  try {
    res.render("myPosts", { posts: await getMyPosts(req.user.id) });
  } catch (err) {
    console.log(err);
    res.status(500).send("Server error");
  }
});

router.delete("/:id", async (req, res) => {
  const id = req.params.id;
  if (await deletePostById(id)) {
    res.status(200).send("Post deleted successfully");
  } else {
    res.status(404).send("Post not found");
  }
});

router.get("/:id/update", async (req, res) => {
  const id = req.params.id;
  const post = await pool.query(`SELECT * FROM posts WHERE id = $1`, [id]);
  if (!post) {
    res.status(404).send("Post not found");
    return;
  }
  res.render("updatePost", { post: post.rows[0] });
});

router.get("/:id/share", async (req, res) => {
  const id = req.params.id;
  const post = await pool.query(`SELECT * FROM posts WHERE id = $1`, [id]);
  if (!post) {
    res.status(404).send("Post not found");
    return;
  }
  res.send((await S3Service.addImageUrls(post.rows))[0].imageUrl);
});

router.post("/:id/update", upload.single("photo"), async (req, res) => {
  const id = req.params.id;
  const { caption, description, visibility } = req.body;

  try {
    const post = await pool.query(`SELECT * FROM posts WHERE id = $1`, [id]);

    if (!post) {
      res.status(404).send("Post not found");
      return;
    }

    await pool.query("UPDATE posts SET visibility = $1 WHERE id = $2", [
      visibility,
      id,
    ]);

    if (req.file) {
      const prevImageKey = post.rows[0].imagename;
      const deleteParams = {
        Bucket: bucketName,
        Key: prevImageKey,
      };
      const deleteCommand = new DeleteObjectCommand(deleteParams);
      await s3.send(deleteCommand);

      const fileBuffer = await sharp(req.file.buffer)
        .resize({ width: 300, height: 300, fit: "contain" })
        .toBuffer();
      const newImageKey = await generateFileName();

      const uploadParams = {
        Bucket: bucketName,
        Key: newImageKey,
        Body: fileBuffer,
        ContentType: req.file.mimetype,
      };
      const uploadCommand = new PutObjectCommand(uploadParams);
      await s3.send(uploadCommand);

      await pool.query("UPDATE posts SET imagename = $1 WHERE id = $2", [
        newImageKey,
        id,
      ]);
    }

    if (caption) {
      await pool.query("UPDATE posts SET caption = $1 WHERE id = $2", [
        caption,
        id,
      ]);
    }

    if (description) {
      await pool.query("UPDATE posts SET description = $1 WHERE id = $2", [
        description,
        id,
      ]);
    }
    res.redirect("/dashboard/myposts");
  } catch (err) {
    console.log(err);
    res.redirect("/dashboard");
  }
});

module.exports = router;
