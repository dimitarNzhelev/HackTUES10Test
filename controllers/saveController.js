const { pool } = require("../config/dbConf");
const { getPostById } = require("./postController");
const { addImageUrls } = require("./S3Service");

async function savePost(userid, postid) {
  try {
    const result = await pool.query(
      "INSERT INTO saved_posts(user_id, post_id) VALUES($1, $2)",
      [userid, postid]
    );
    return result;
  } catch (err) {
    throw err;
  }
}

async function unsavePost(userid, postid) {
  try {
    const result = await pool.query(
      "DELETE FROM saved_posts WHERE user_id = $1 AND post_id = $2",
      [userid, postid]
    );
    return result;
  } catch (err) {
    throw err;
  }
}

async function getSavedPostsByUserId(userid) {
  try {
    const result = await pool.query(
      "SELECT * FROM saved_posts WHERE user_id = $1",
      [userid]
    );
    let posts = [];
    for (let i = 0; i < result.rows.length; i++) {
      let post = await getPostById(result.rows[i].post_id);
      posts[i] = post;
    }
    posts = await addImageUrls(posts);
    return posts;
  } catch (err) {
    throw err;
  }
}

async function checkSavedStatus(userid, postid) {
  try {
    const result = await pool.query(
      "SELECT * FROM saved_posts WHERE user_id = $1 AND post_id = $2",
      [userid, postid]
    );
    if (result.rows.length > 0) {
      return true;
    } else {
      return false;
    }
  } catch (err) {
    throw err;
  }
}

module.exports = {
  savePost,
  unsavePost,
  getSavedPostsByUserId,
  checkSavedStatus,
};
