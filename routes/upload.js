const express = require('express');
const multer = require('multer');
const { uploadPost } = require('../controllers/dashboardController');
const { checkNotAuthenticated } = require('../middleware/authentication');

const storage = multer.memoryStorage()
const upload = multer({storage: storage})

const router = express.Router();

router.use(checkNotAuthenticated);

router.get('/', (req, res) => {
    res.render('uploadPost');
});

router.post('/', upload.single('photo'), async (req, res) => {
    await uploadPost(req);
    res.redirect('/dashboard/myposts');
});

module.exports = router;
