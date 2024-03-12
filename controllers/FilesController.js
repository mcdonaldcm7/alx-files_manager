import { ObjectId } from 'mongodb';
import { v4 as uuidv4 } from 'uuid';
import { promisify } from 'util';
import fs from 'fs';
import redisClient from '../utils/redis';
import dbClient from '../utils/db';

export default async function postUpload(req, res) {
  const token = req.headers['x-token'];

  if (token === undefined) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const userId = await redisClient.get(`auth_${token}`);
  if (userId === null) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const collection = dbClient.client.db(dbClient.database).collection('users');
  const user = await collection.findOne({ _id: ObjectId(userId) });
  if (user === null) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { name, type, data } = req.body;
  let { parentId, isPublic } = req.body;

  if (name === undefined) {
    return res.status(400).json({ error: 'Missing name' });
  }

  if (type === undefined || !['folder', 'file', 'image'].includes(type)) {
    return res.status(400).json({ error: 'Missing type' });
  }

  if (data === undefined && type !== 'folder') {
    return res.status(400).json({ error: 'Missing data' });
  }

  if (parentId !== undefined) {
    const parentFolder = await collection.findOne({ _id: ObjectId(parentId) });
    if (parentFolder === null) {
      return res.status(400).json({ error: 'Parent not found' });
    }

    if (parentFolder.type !== 'folder') {
      return res.status(400).json({ error: 'Parent is not a folder' });
    }
  }

  parentId = (parentId === undefined) ? 0 : parentId;
  isPublic = !(isPublic === undefined || !isPublic);

  const file = {
    userId: ObjectId(userId), name, type, isPublic, parentId,
  };

  if (type === 'file' || type === 'image') {
    file.data = data;
  }

  if (type === 'folder') {
    const result = await collection.insertOne(file);
    return res.status(201).json({
      id: result.insertedId, userId, name, type, isPublic, parentId,
    });
  }

  const filePath = process.env.FOLDER_PATH || '/tmp/files_manager';

  const content = Buffer.from(data, 'base64').toString('utf-8');
  const fileName = uuidv4();
  const access = promisify(fs.access);

  try {
    await access(filePath, fs.constants.F_OK);
  } catch (error) {
    try {
      await fs.promises.mkdir(filePath, { recursive: true });
    } catch (error) {
      return res.status(500).json({ error });
    }
  }

  await fs.writeFile(`${filePath}/${fileName}`, content, (err) => (err === null));

  const filesCollection = dbClient.client.db(dbClient.database).collection('files');
  const localPath = `${filePath}/${fileName}`;
  const fileInsertResult = await filesCollection.insertOne({
    userId: ObjectId(userId), name, type, isPublic, parentId, localPath,
  });

  return res.status(201).json({
    id: fileInsertResult.insertedId, userId, name, type, isPublic, parentId,
  });
}
