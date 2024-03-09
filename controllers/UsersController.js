import crypto from 'crypto';
import dbClient from '../utils/db';

export default function postNew(req, res) {
  const { email, password } = req.body;

  if (email === undefined) {
    res.status(400).json({ error: 'Missing email' });
  }

  if (password === undefined) {
    res.status(400).json({ error: 'Missing password' });
  }

  const collection = dbClient.client.db(dbClient.database).collection('users');

  /**
   * const user = collection('users').find({ email: email }).toArray();
   * if (user.length !== 0) {
   * res.status(400).send('Already exist');
   * } else {
   */

  collection.findOne({ email }, (error, user) => {
    if (error) {
      res.status(500).error({ error: 'Internal server error' });
      return;
    }

    if (user) {
      res.status(400).json({ error: 'Already exist' });
    } else {
      const sha1Hash = crypto.createHash('sha1');

      sha1Hash.update(password);

      const hashedPassword = sha1Hash.digest('hex');

      collection.insertOne({ email, password: hashedPassword },
        (error, result) => {
          if (error) {
            console.error('Error inserting document: ', error);
          } else {
            res.status(201).json({ id: result.insertedId, email });
          }
        });
    }
  });
}
