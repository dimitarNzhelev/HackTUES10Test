const express = require('express');
const { Pool } = require('pg');
const bodyParser = require('body-parser');

const pool = new Pool({
  user: 'admin',
  host: 'localhost',
  database: 'HackTues10Test',
  password: '1234',
  port: 5432,
});

let app = express();
app.use(express.json());

app.get('/books', async (req, res) => {
  const result = await pool.query('SELECT * FROM books');
  res.json(result.rows);
});

app.get('/books/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  const result = await pool.query('SELECT * FROM books WHERE id = $1', [id]);
  if (result.rows.length === 0) return res.sendStatus(404);
  res.json(result.rows[0]);
});

app.post('/books', async (req, res) => {
  const { title, author } = req.body;
  const result = await pool.query('INSERT INTO books(title, author) VALUES($1, $2) RETURNING *', [title, author]);
  res.status(201).json(result.rows[0]);
});

app.put('/books/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  const { title, author } = req.body;
  const result = await pool.query('UPDATE books SET title = $1, author = $2 WHERE id = $3 RETURNING *', [title, author, id]);
  if (result.rows.length === 0) return res.sendStatus(404);
  res.json(result.rows[0]);
});

app.delete('/books/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  const result = await pool.query('DELETE FROM books WHERE id = $1', [id]);
  if (result.rowCount === 0) return res.sendStatus(404);
  res.sendStatus(204);
});

app.listen(3000, () => console.log('Server running on port 3000'));
