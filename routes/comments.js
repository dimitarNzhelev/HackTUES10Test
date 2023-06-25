const express = require('express');
const router = express.Router();
const { deleteCommentById, updateCommentById, createComment } = require('../controllers/commentController');
const { checkNotAuthenticated } = require('../middleware/authentication');

router.use(checkNotAuthenticated);

router.get('/', async (req, res) => {
    const postId = parseInt(req.params.id);
    try {
      const comments = (await pool.query('SELECT * FROM comments WHERE post_id = $1', [postId])).rows;
      res.status(200).json({ comments });
    } catch (error) {
      console.error('Error getting comments:', error);
      res.status(500).json({ message: 'Error getting comments.' });
    }
  });

router.post('/', express.json(), async (req, res) => {
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

router.delete('/:commentId', async (req, res) => {
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

router.put('/:commentId',express.json(), async (req, res) => {
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

module.exports = router;
