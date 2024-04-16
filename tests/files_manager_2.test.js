import chai from 'chai';
import chaiHttp from 'chai-http';
import redisClient from '../utils/redis';

const expect = chai.expect;

chai.use(chaiHttp);

describe('GET /connect, GET /disconnect, GET /users/me', function() {
  before(function() {
    chai.request('http://localhost:5000')
      .post('/users')
      .send({ email: 'dummy_mail@email.com', password: 'dUmMyPaSsWoRd123' });
  });
  
  let token = null;

  it('Sign-in with a valid authorization on GET /connect', function() {
    chai.request('http://localhost:5000')
      .get('/connect')
      .set('Authorization', `Basic ZHVtbXlfbWFpbEBlbWFpbC5jb206ZFVtTXlQYVNzV29SZDEyMw==`)
      .end(async function(err, res) {
        expect(err).to.be.null;
        expect(res).to.have.status(200);
        expect(res.body).to.have.own.property('token');
        token = res.body.token;

        const value = await redisClient.exists(`auth_${res.body.token}`);
        expect(value).to.be.equal(true);
        // Add checks for TTL
      });
  });

  it('Attempts to make a sign-in request to GET /connect with invalid Base64 content', function() {
    let invalidCredentials = btoa('dummy_mail@email.com:WrongPassword123');

    chai.request('http://localhost:5000')
      .get('/connect')
      .set('Authorization', invalidCredentials)
      .end(function(err, res) {
        expect(err).to.be.null;
        expect(res).to.have.status(401);
        expect(res.body).to.deep.equal({ error: 'Unauthorized' });
      });

    invalidCredentials = btoa('dummy_mail_invalid@email.com:dUmMyPaSsWoRd123');
    chai.request('http://localhost:5000')
      .get('/connect')
      .set('Authorization', invalidCredentials)
      .end(function(err, res) {
        expect(err).to.be.null;
        expect(res).to.have.status(401);
        expect(res.body).to.deep.equal({ error: 'Unauthorized' });
      });
    
    invalidCredentials = btoa('dummy_mail@email.com:WrongPassword123');
    chai.request('http://localhost:5000')
      .get('/connect')
      .set('Authorization', invalidCredentials)
      .end(function(err, res) {
        expect(err).to.be.null;
        expect(res).to.have.status(401);
        expect(res.body).to.deep.equal({ error: 'Unauthorized' });
      });
  });

  it('Fetch user profile from GET /users/me using a valid authentication token', function() {
    chai.request('http://localhost:5000')
      .get('/users/me')
      .set('X-Token', token)
      .end(function(err, res) {
        expect(err).to.be.null;
        expect(res).to.have.status(200);
        expect(res.body).to.have.own.property('id');
        expect(res.body).to.have.own.property('email');
        expect(res.body.email).to.equal('dummy_mail@email.com');
      });

    chai.request('http://localhost:5000')
      .get('/users/me')
      .end(function(err, res) {
        expect(err).to.be.null;
        expect(res).to.have.status(401);
        expect(res.body).to.deep.equal({ error: 'Unauthorized' });
      });

    chai.request('http://localhost:5000')
      .get('/users/me')
      .set('X-Token', 'Invalid-Token!')
      .end(function(err, res) {
        expect(err).to.be.null;
        expect(res).to.have.status(401);
        expect(res.body).to.deep.equal({ error: 'Unauthorized' });
      });
  });

  it('GET /disconnect should sign-out the user based on the token', function() {
    chai.request('http://localhost:5000')
      .get('/disconnect')
      .set('X-Token', token)
      .end(function(err, res) {
        expect(err).to.be.null;
      });

    chai.request('http://localhost:5000')
      .get('/users/me')
      .set('X-Token', token)
      .end(function(err, res) {
        expect(err).to.be.null;
        expect(res).to.have.status(401);
        expect(res.body).to.deep.equal({ error: 'Unauthorized' });
      });
  });
});
