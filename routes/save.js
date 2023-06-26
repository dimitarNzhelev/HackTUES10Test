const express = require("express");
const router = express.Router();
const { checkNotAuthenticated } = require("../middleware/authentication");
router.use(checkNotAuthenticated);
const {
  savePost,
  unsavePost,
  getSavedPostsByUserId,
  checkSavedStatus,
} = require("../controllers/saveController");
const bodyParser = require("body-parser");

router.get("/:id/status", async (req, res) => {
  const postId = parseInt(req.params.id);
  const userId = req.userId;
  try {
    const savedStatus = await checkSavedStatus(postId, userId);
    res.status(200).json({ savedStatus });
  } catch (error) {
    console.error("Error getting saved status:", error);
    res.status(500).json({ message: "Error getting saved status." });
  }
});

router.post("/:id", bodyParser.json(), async (req, res) => {
  const { userid, postid } = req.body;
  try {
    if (await checkSavedStatus(userid, postid)) {
      await unsavePost(userid, postid);
      res.status(200).json({ message: "Post unsaved successfully." });
    } else {
      await savePost(userid, postid);
      res.status(200).json({ message: "Post saved successfully." });
    }
  } catch (error) {
    console.error("Error saving post:", error);
    res.status(500).json({ message: "Error saving post." });
  }
});

router.get("/", async (req, res) => {
  const userid = req.user.id;
  try {
    const savedPosts = await getSavedPostsByUserId(userid);

    res.render("posts", { posts: savedPosts });
  } catch (error) {
    console.error("Error getting saved posts:", error);
    res.status(500).json({ message: "Error getting saved posts." });
  }
});
module.exports = router;
