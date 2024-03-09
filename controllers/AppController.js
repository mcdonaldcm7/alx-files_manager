import redisClient from '../utils/redis';
import dbClient from '../utils/db';

export function getStatus(req, res) {
  res.status(200).json({ redis: redisClient.isAlive(), db: dbClient.isAlive() });
}

export function getStats(req, res) {
  dbClient.nbUsers()
    .then((usersResult) => {
      dbClient.nbFiles()
        .then((filesResult) => {
          res.status(200).json({ users: usersResult, files: filesResult });
	})
        .catch((error) => {
          res.status(500).json({ error: 'Error getting files count' });
	});
    })
    .catch((error) => {
      res.status(500).json({ error: 'Error getting users count' });
    });
}
