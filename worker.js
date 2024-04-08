import Queue from 'bull';
import imageThumbnail from 'image-thumbnail';
import { ObjectId } from 'mongodb';
import fs from 'fs';
import dbClient from './utils/db';

const queue = new Queue('fileQueue');

queue.process(async (job, done) => {
  if (job.data.fileId === undefined) {
    throw new Error('Missing fileId');
  }

  if (job.data.userId === undefined) {
    throw new Error('Missing userId');
  }

  const db = await dbClient.client.db(dbClient.database);
  const filesCollection = db.collection('files');
  const file = await filesCollection.findOne({
    _id: ObjectId(job.data.fileId), userId: ObjectId(job.data.userId),
  });

  if (file === null) {
    return done(new Error('File not found'));
  }

  let path = file.localPath;
  const fileName = path.substr(path.lastIndexOf('/') + 1);

  path = path.substr(0, path.lastIndexOf('/') + 1);

  try {
    const rdName = `${path}${fileName}`;
    const thumbnail500 = await imageThumbnail(rdName, { width: 500 });
    const thumbnail250 = await imageThumbnail(rdName, { width: 250 });
    const thumbnail100 = await imageThumbnail(rdName, { width: 100 });

    await fs.promises.writeFile(`${rdName}_500`, thumbnail500);
    await fs.promises.writeFile(`${rdName}_250`, thumbnail250);
    await fs.promises.writeFile(`${rdName}_100`, thumbnail100);

    return done();
  } catch (error) {
    console.error(error);
    return done(new Error(error));
  }
});

export default queue;
