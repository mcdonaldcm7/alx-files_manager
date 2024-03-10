import crypto from 'crypto';
import { ObjectId } from 'mongodb';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';

export function postNew(req, res) {
  const { email, password } = req.body;

  if (email === undefined) {
    res.status(400).json({ error: 'Missing email' });
    return;
  }

  if (password === undefined) {
    res.status(400).json({ error: 'Missing password' });
    return;
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
      res.status(500).json({ error: 'Internal server error' });
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
            res.status(400).json({ error: 'Error inserting document' });
          } else {
            res.status(201).json({ id: result.insertedId, email });
          }
        });
    }
  });
}

export function getMe(req, res) {
  const token = req.headers['x-token'];

  redisClient.get(`auth_${token}`)
    .then((userId) => {
      const collection = dbClient.client.db(dbClient.database).collection('users');
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      collection.findOne({ _id: ObjectId(userId) })
        .then((user) => {
          if (!user) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
          }
          res.status(200).json({ email: user.email, _id: user._id });
        })
        .catch(() => {
          res.status(401).json({ error: 'Unauthorized' });
        });
    });
}
