import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { ObjectId } from 'mongodb';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';

export function getConnect(req, res) {
  const authHeader = req.headers.authorization;

  // InCase of dynamic method of authentication
  // const authType = authHeader.split(' ')[0];

  const base64Encoded = authHeader.split(' ')[1];

  // const email = atob(base64Encoded).split(':')[0];
  // const password = atob(base64Encoded).split(':')[1];

  const base64Decoded = Buffer.from(base64Encoded, 'base64').toString('utf-8');
  const email = base64Decoded.split(':')[0];
  const password = base64Decoded.split(':')[1];

  const sha1Hash = crypto.createHash('sha1');

  sha1Hash.update(password);

  const hashedPassword = sha1Hash.digest('hex');
  const collection = dbClient.client.db(dbClient.database).collection('users');

  collection.find({ email }).toArray()
    .then((result) => {
      if (!result) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      for (const user of result) {
        if (user.password === hashedPassword) {
          const key = `auth_${uuidv4()}`;

          redisClient.set(key, user._id, (60 * 60 * 24));
          res.status(200).json({ token: key.substr(5) });
          return;
        }
      }
      res.status(401).json({ error: 'Unauthorized' });
    })
    .catch(() => {
      res.status(401).json({ error: 'Unauthorized' });
    });
}

export function getDisconnect(req, res) {
  const token = req.headers['x-token'];

  redisClient.get(`auth_${token}`)
    .then((userId) => {
      const collection = dbClient.client.db(dbClient.database).collection('users');
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      collection.findOne({ _id: ObjectId(userId) })
        .then((result) => {
          if (!result) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
          }
          redisClient.del(`auth_${token}`)
            .then(() => {
              res.status(204).end();
            });
        })
        .catch(() => {
          res.status(401).json({ error: 'Unauthorized' });
        });
    });
}
