const app = require('./app');
const port = process.env.PORT || 6000;


app.listen(port, () => {
    console.log('server is up and running from server.js ', port);
  });

