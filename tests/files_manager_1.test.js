import chai from 'chai';
import chaiHttp from 'chai-http';
import dbClient from '../utils/db';

const expect = chai.expect;

chai.use(chaiHttp);

describe('POST /users', function() {
  beforeEach(async function() {
    const db = dbClient.client.db(dbClient.database);

    const userCollection = db.collection('users');
    await userCollection.deleteOne({ email: 'dummy_mail@email.com' });
  });

  it('Attempts to create a user without an email', function() {
    chai.request('http://localhost:5000')
      .post('/users')
      .send({ password: 'dUmMyPaSsWoRd123' })
      .end(function (err, res) {
        expect(res).to.have.status(400);
        expect(res.body).to.deep.equal({ error: 'Missing email' });
      });
  });

  it('Attempts to create a user without a password', function() {
    chai.request('http://localhost:5000')
      .post('/users')
      .send({ email: 'dummy_mail@email.com' })
      .end(function (err, res) {
        expect(res).to.have.status(400);
        expect(res.body).to.deep.equal({ error: 'Missing password' });
      });
  });

  it('Attempts to create a user with an email that already exists', function() {
    chai.request('http://localhost:5000')
      .post('/users')
      .send({ email: 'dummy_mail@email.com', password: 'dUmMyPaSsWoRd123' })
      .end(function (err, res) {
        expect(res.body).to.have.own.property('_id');
        expect(res.body).to.have.own.property('email');
      });

    chai.request('http://localhost:5000')
      .post('/users')
      .send({ email: 'dummy_mail@email.com', password: 'dUmMyPaSsWoRd123' })
      .end(function (err, res) {
        expect(res.body).to.deep.equal({ error: 'Already exist' });
      });
  });

  it('Verifies the password are stored after being hashed', function() {
    chai.request('http://localhost:5000')
      .post('/users')
      .send({ email: 'dummy_mail@email.com', password: 'dUmMyPaSsWoRd123' })
      .end(async function (err, res) {
        expect(res.body).to.have.own.property('id');
        expect(res.body).to.have.own.property('email');

        const db = dbClient.client.db(dbClient.database);
        const userCollection = db.collection('users');

        const user = await userCollection.findOne({ email: 'dummy_mail@email.com' });
        expect(user).to.not.be.null;
        expect(user.password).to.not.equal('dUmMyPaSsWoRd123');
      });
  });
});
