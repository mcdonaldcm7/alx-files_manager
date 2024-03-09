import { MongoClient } from 'mongodb';

class DBClient {
  constructor() {
    const host = process.env.DB_HOST || 'localhost';
    const port = process.env.DB_PORT || 27017;
    this.database = process.env.DB_DATABASE || 'files_manager';

    const url = `mongodb://${host}:${port}`;

    this.client = new MongoClient(url);
    this.connect();
  }

  async connect() {
    try {
      await this.client.connect();
    } catch (error) {
      console.error(error);
    }
  }

  isAlive() {
    return this.client.isConnected();
  }

  async nbUsers() {
    this.client.db(this.database).collection('users').countDocuments();
  }

  async nbFiles() {
    this.client.db(this.database).collection('files').countDocuments();
  }
}

const dbClient = new DBClient();

export default dbClient;
