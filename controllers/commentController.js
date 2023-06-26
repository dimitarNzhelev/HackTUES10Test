const { pool } = require("../config/dbConf");

async function getCommnetsByPost(postId) {
  const result = await pool.query("SELECT * FROM comments WHERE post_id = $1", [
    postId,
  ]);
  return result.rows;
}

async function addCommentByPost(postId, userId, comment) {
  if (!comment) {
    return;
  }

  try {
    await pool.query(
      "INSERT INTO comments(post_id, user_id, comment_text) VALUES($1, $2, $3)",
      [postId, userId, comment]
    );
    return;
  } catch (err) {
    throw err;
  }
}

async function deleteCommentById(commentId, user_id) {
  const result = await pool.query(`SELECT * FROM comments WHERE id = $1`, [
    commentId,
  ]);
  if (result.rows.length === 0) {
    return;
  }
  // if(result.rows[0].user_id == user_id){ TOVA GO PROVERQVAM OSHTE V FRONTENDA
  const res =
    (await pool.query("DELETE FROM comments WHERE id = $1", [commentId])) &&
    //decrese comments count in posts table
    (await pool.query(
      "UPDATE posts SET totalcomments = totalcomments - 1 WHERE id = $1",
      [result.rows[0].post_id]
    ));
  if (res) {
    return true;
  } else {
    return false;
  }
  // }
}

async function updateCommentById(commentId, commentText) {
  const result = await pool.query(`SELECT * FROM comments WHERE id = $1`, [
    commentId,
  ]);

  if (result.rows.length === 0) {
    throw new Error(`No comment found with id: ${commentId}`);
  }

  const res = await pool.query(
    "UPDATE comments SET comment_text = $1 WHERE id = $2",
    [commentText, commentId]
  );

  if (res.rowCount > 0) {
    return true;
  } else {
    return false;
  }
}

async function createComment(postId, userId, commentText) {
  if (!commentText) {
    return;
  }

  try {
    const newComment = await pool.query(
      `INSERT INTO comments(post_id, user_id, comment_text) VALUES($1, $2, $3) RETURNING *`,
      [postId, userId, commentText]
    );

    await pool.query(
      `UPDATE posts SET totalcomments = (SELECT COUNT(*) FROM comments WHERE post_id = $1) WHERE id = $1`,
      [postId]
    );

    return newComment.rows[0];
  } catch (err) {
    console.log(err);
    return;
  }
}

module.exports = {
  getCommnetsByPost,
  addCommentByPost,
  deleteCommentById,
  createComment,
  updateCommentById,
};
