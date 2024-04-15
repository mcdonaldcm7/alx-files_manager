import chai from 'chai';
import chaiHttp from 'chai-http';
import dbClient from '../utils/db';

const expect = chai.expect;

chai.use(chaiHttp);

describe('GET /status', function() {
  it('GET /status returns the status of Redis and Mongo', function(done) {
    chai.request('http://localhost:5000')
      .get('/status')
      .end(function (err, res) {
        expect(err).to.be.null;
        expect(res).to.have.status(200);
        expect(res.body).to.deep.equal({ redis: true, db: true });
        done();
      });
  });
});

describe('GET /stats', function () {
  it('GET /stats returns the number of users and files in DB', async function() {
    const users = await dbClient.nbUsers();
    const files = await dbClient.nbFiles();

    chai.request('http://localhost:5000')
      .get('/stats')
      .end(function (err, res) {
        expect(err).to.be.null;
        expect(res).to.have.status(200);
        expect(res.body).to.deep.equal({ users, files });
      });
  });
});
