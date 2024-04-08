import { ObjectId } from 'mongodb';
import { v4 as uuidv4 } from 'uuid';
import { promisify } from 'util';
import fs from 'fs';
import mime from 'mime-types';
import redisClient from '../utils/redis';
import dbClient from '../utils/db';
import queue from '../worker';

export async function postUpload(req, res) {
  const token = req.headers['x-token'];

  if (token === undefined) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const userId = await redisClient.get(`auth_${token}`);
  if (userId === null) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const userCollection = dbClient.client.db(dbClient.database).collection('users');
  const user = await userCollection.findOne({ _id: ObjectId(userId) });
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

  const filesCollection = await dbClient.client.db(dbClient.database).collection('files');

  if (parentId !== undefined) {
    const parentFolder = await filesCollection.findOne({ _id: ObjectId(parentId) });
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
    userId: ObjectId(userId), name, type, parentId,
  };

  if (type === 'file' || type === 'image') {
    file.data = data;
  }

  if (type === 'folder') {
    const result = await filesCollection.insertOne(file);
    return res.status(201).json({
      id: result.insertedId, userId, name, type, isPublic, parentId,
    });
  }

  const filePath = process.env.FOLDER_PATH || '/tmp/files_manager';

  const content = Buffer.from(data, 'base64');
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

  const localPath = `${filePath}/${fileName}`;
  const fFile = {
    userId: ObjectId(userId), name, type, isPublic, parentId: ObjectId(parentId),
  };

  if (type === 'file' || type === 'image') {
    fFile.localPath = localPath;
  }

  const fileInsertResult = await filesCollection.insertOne(fFile);

  if (type === 'image') {
    queue.add({ userId, fileId: fileInsertResult.insertedId });
  }

  return res.status(201).json({
    id: fileInsertResult.insertedId, userId, name, type, isPublic, parentId,
  });
}

export async function getShow(req, res) {
  const fileId = req.params.id;
  const token = req.headers['x-token'];

  if (token === undefined) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const userId = await redisClient.get(`auth_${token}`);
  if (userId === null) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const filesCollection = await dbClient.client.db(dbClient.database).collection('files');
  const file = await filesCollection.findOne({ _id: ObjectId(fileId), userId: ObjectId(userId) });
  if (file === null) {
    return res.status(404).json({ error: 'Not found' });
  }
  return res.status(200).json(file);
}

export async function getIndex(req, res) {
  const token = req.headers['x-token'];

  if (token === undefined) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const userId = await redisClient.get(`auth_${token}`);
  if (userId === null) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const page = req.query.page || 0;
  const pageSize = 20;
  const skip = page * pageSize;
  const query = { userId: ObjectId(userId) };
  if (req.query.parentId !== undefined) {
    query.parentId = ObjectId(req.query.parentId);
  }

  const pipeline = [
    { $match: query },
    { $skip: skip },
    { $limit: pageSize },
  ];

  const filesCollection = dbClient.client.db(dbClient.database).collection('files');
  const userFiles = await filesCollection.aggregate(pipeline).toArray();

  const finalForm = [];
  for (const files of userFiles) {
    finalForm.push({
      id: String(files._id),
      userId: String(files.userId),
      name: files.name,
      type: files.type,
      isPublic: files.isPublic,
      parentId: (typeof files.parentId === 'object') ? String(files.parentId) : files.parentId,
    });
  }

  return res.json(finalForm);
}

export async function putPublish(req, res) {
  const token = req.headers['x-token'];
  const fileId = req.params.id;

  if (token === undefined) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (fileId === undefined) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const userId = await redisClient.get(`auth_${token}`);
  if (userId === null) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const fileCollection = dbClient.client.db(dbClient.database).collection('files');

  const updateResult = await fileCollection.updateOne({
    _id: ObjectId(fileId), userId: ObjectId(userId),
  }, { $set: { isPublic: true } });

  if (updateResult.modifiedCount !== 1 && updateResult.matchedCount !== 1) {
    return res.status(404).json({ error: 'Not found' });
  }

  const file = await fileCollection.findOne({
    _id: ObjectId(fileId), userId: ObjectId(userId),
  });

  return res.status(200).json({
    id: String(fileId),
    userId: String(file.userId),
    name: file.name,
    type: file.type,
    isPublic: file.isPublic,
    parentId: (typeof file.parentId === 'object') ? String(file.parentId) : file.parentId,
  });
}

export async function putUnpublish(req, res) {
  const token = req.headers['x-token'];
  const fileId = req.params.id;

  if (token === undefined) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (fileId === undefined) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const userId = await redisClient.get(`auth_${token}`);
  if (userId === null) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const fileCollection = dbClient.client.db(dbClient.database).collection('files');

  const updateResult = await fileCollection.updateOne({
    _id: ObjectId(fileId), userId: ObjectId(userId),
  }, { $set: { isPublic: false } });

  if (updateResult.modifiedCount !== 1 && updateResult.matchedCount !== 1) {
    return res.status(404).json({ error: 'Not found' });
  }

  const file = await fileCollection.findOne({
    _id: ObjectId(fileId), userId: ObjectId(userId),
  });

  return res.status(200).json({
    id: String(fileId),
    userId: String(file.userId),
    name: file.name,
    type: file.type,
    isPublic: file.isPublic,
    parentId: (typeof file.parentId === 'object') ? String(file.parentId) : file.parentId,
  });
}

export async function getFile(req, res) {
  const fileId = req.params.id;
  const { size } = req.query;

  const filesCollection = dbClient.client.db(dbClient.database).collection('files');
  const file = await filesCollection.findOne({ _id: ObjectId(fileId) });
  if (file === null) {
    return res.status(404).json({ error: 'Not found' });
  }

  if (!file.isPublic) {
    const token = req.headers['x-token'];

    if (token === undefined) {
      return res.status(404).json({ error: 'Not found' });
    }

    const userId = await redisClient.get(`auth_${token}`);

    if (userId === null || !(file.userId.equals(ObjectId(userId)))) {
      return res.status(404).json({ error: 'Not found' });
    }
  }

  if (file.type === 'folder') {
    return res.status(400).json({ error: 'A folder doesn\'t have content' });
  }

  const access = promisify(fs.access);

  try {
    await access(file.localPath, fs.constants.F_OK);
    if (size !== undefined) {
      await access(`${file.localPath}_${size}`, fs.sonstants.F_OK);
    }
  } catch (err) {
    if (err) {
      return res.status(404).json({ error: 'Not found' });
    }
  }

  const mimeType = mime.lookup(file.name) || 'application/octet-stream';
  res.setHeader('Content-Type', mimeType);
  if (size !== undefined) {
    return res.sendFile(`${file.localPath}_${size}`);
  }
  return res.sendFile(`${file.localPath}`);
}
