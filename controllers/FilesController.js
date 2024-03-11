import { ObjectId } from 'mongodb';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import redisClient from '../utils/redis';
import dbClient from '../utils/db';

export default function postUpload(req, res) {
  const token = req.headers['x-token'];

  redisClient.get(`auth_${token}`)
    .then((userId) => {
      const collection = dbClient.client.db(dbClient.database).collection('users');
      collection.findOne({ _id: ObjectId(userId) })
        .then((user) => {
          if (!user) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
          }

          const { name, type, data } = req.body;
          let { parentId, isPublic } = req.body;

          if (name === undefined) {
            res.status(400).json({ error: 'Missing name' });
          } else if (type === undefined) {
            res.status(400).json({ error: 'Missing type' });
          } else if (data === undefined) {
            if (type !== 'folder') {
              res.status(400).json({ error: 'Missing data' });
              return;
            }
          }

          if (parentId !== undefined) {
            collection.findOne({ _id: ObjectId(parentId) })
              .then((result) => {
                if (result === null) {
                  res.status(400).json({ error: 'Parent not found' });
                } else if (result.type !== 'folder') {
                  res.status(400).json({ error: 'Parent is not a folder' });
                }
              });
          }

          parentId = (parentId === undefined) ? 0 : parentId;
          isPublic = !(isPublic === undefined || !isPublic);

          const file = {
            userId, name, type, isPublic, parentId,
          };
          if (type === 'file' || type === 'image') {
            file.data = data;
          }

          collection.insertOne(file, (error, result) => {
            if (error) {
              res.status(400).json({ error: 'Error uploading file' });
            } else if (type === 'folder') {
              res.status(201).json({
                id: result.insertedId, userId, name, type, isPublic, parentId,
              });
            } else {
              let filePath = null;
              if (process.env.FOLDER_PATH === undefined) {
                filePath = '/tmp/files_manager';
              } else {
                filePath = process.env.FOLDER_PATH;
              }

              const content = Buffer.from(data, 'base64').toString('utf-8');
              const fileName = uuidv4();

              fs.exists(filePath, async (exists) => {
                if (!exists) {
                  await fs.mkdir(filePath, (error) => {
                    if (error) {
                      res.status(400).json({ error: `Error creating directory, ${error}` });
                    }
                  });
                }

                fs.writeFile(`${filePath}/${fileName}`, content, (err) => {
                  if (err) {
                    res.status(404).json({ error: 'Error creating file' });
                  }
                });

                const filesCollection = dbClient.client.db(dbClient.database).collection('files');
                filesCollection.insertOne({
                  userId, name, type, isPublic, parentId, localPath: `${filePath}/${fileName}`,
                })
                  .then((fileInserted) => {
                    res.status(201).json({
                      id: fileInserted.insertedId, userId, name, type, isPublic, parentId,
                    });
                  });
              });
            }
          });
        })
        .catch(() => {
          res.status(401).json({ error: 'Unauthorized' });
        });
    });
}
