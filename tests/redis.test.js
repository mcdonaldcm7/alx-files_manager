const assert = require('assert');
const redisClient = require('../utils/redis').default;

describe("redisClient", function() {
  it("Checks if the redisClient is connected to the redis server", function() {
    assert.equal(redisClient.isAlive(), true);
  });

  it("Checks the set and get attribute of redisClient", async function() {
    let val = await redisClient.get('test-key');
    assert.equal(val, null);
    
    const value = Math.floor(Math.random() * 50);
    await redisClient.set('test-key', value, 10);

    val = await redisClient.get('test-key');
    assert.equal(val, value);

    setTimeout(async () => {
      val = await redisClient.get('test-key');
      assert.equal(assert.equal(val, null));
    }, 1000 * 10);
  });

  it("Checks the delete attribute of redisClient", async function() {
    const value = Math.floor(Math.random() * 50);
    await redisClient.set('test-key', value, 60);

    let val = await redisClient.get('test-key');
    assert.equal(val, value);
    await redisClient.del('test-key');
    
    val = await redisClient.get('test-key');
    assert.equal(val, null);
  });
});
