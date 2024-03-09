import express from 'express';
import routes from './routes/index';

const port = process.env.PORT || 5000;
const app = express();

app.use('/', routes);

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
  console.log('...');
});
