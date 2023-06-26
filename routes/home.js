const express = require("express");
const router = express.Router();
const { checkNotAuthenticated } = require("../middleware/authentication");

router.get("/", checkNotAuthenticated, (req, res) => {
  res.render("dashboard", { user: req.user.name });
});

module.exports = router;
