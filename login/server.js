const exporess = require('express');
const app = exporess();

const PORT = process.env.PORT || 3000;


app.set('view engine', 'ejs');

app.get('/', (req, res) =>{
    res.render('index');
});

app.get('/users/register', (req, res) =>{
    res.render('register');
});

app.get('/users/login', (req, res) => {
    res.render('login');
  });
  
app.get('/users/dashboard', (req, res) =>{
    res.render('dashboard', {user: "test"});
});


app.listen(PORT, ()=>{
    console.log(`Server is running on port ${PORT}`);
});