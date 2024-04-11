const assert = require('assert');
const dbClient = require('../utils/db').default;

describe("dbClient", function() {
  it("Checks if dbClient is connected to the MongoDB database", function() {
    assert.equal(dbClient.isAlive(), true);
  });

  it("Checks if the nbUsers function returns the correct value", async function() {
    const db = dbClient.client.db(dbClient.database);
    const userCollection = db.collection('users');
    const numUsers = await userCollection.countDocuments();
    const nbUsers = await dbClient.nbUsers();

    assert.equal(numUsers, nbUsers);
  });

  it("Checks if the nbFiles function returns the correct value", async function() {
    const db = dbClient.client.db(dbClient.database);
    const fileCollection = db.collection('files');
    const numFiles = await fileCollection.countDocuments();
    const nbFiles = await dbClient.nbFiles();

    assert.equal(numFiles, nbFiles);
  });
});
