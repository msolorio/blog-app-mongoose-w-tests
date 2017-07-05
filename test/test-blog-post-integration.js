const chai = require('chai');
const chaiHttp = require('chai-http');
const faker = require('faker');
const mongoose = require('mongoose');

const should = chai.should();

const { BlogPost } = require('../models');
const { app, runServer, closeServer } = require('../server');

const { TEST_DATABASE_URL } = require('../config');

chai.use(chaiHttp);

function generateContent() {
  let content = '';
  for (let i=0; i<20; i++) {
    content += faker.lorem.words();
  }
  return content;
}

// TODO: BUILD FUNCTION THAT RETURNS A RANDOM BLOGPOST WITH FAKER
function generateBlogPostData() {

  return {
    author: {
      firstName: faker.name.firstName(),
      lastName: faker.name.lastName(),
    },
    title: faker.lorem.words(),
    content: generateContent(),
    created: faker.date.past()
  };
}

function seedBlogPostData() {
  console.log('seeding blog post data');
  const seedData = [];
  for(let i=0; i<10; i++) {
    seedData.push(generateBlogPostData());
  }
  // inserts seed data and returns a promise
  return BlogPost.insertMany(seedData);
}

function tearDownDb() {
  console.log('tearing down DB');
  return mongoose.connection.dropDatabase();
}

console.log('running tests');

describe('Blog Post API resource', function() {

  before(function() {
    return runServer(TEST_DATABASE_URL);
  });

  beforeEach(function() {
    return seedBlogPostData();
  });

  afterEach(function() {
    return tearDownDb();
  });

  after(function() {
    return closeServer();
  });

  describe('GET endpoint', function() {

    it('should return all existing restaurants', function() {
      let res;

      // prove response has correct status
      // prove db seeded correctly
      return chai.request(app)
        .get('/posts')
        .then(function(_res) {
          res = _res;
          res.should.have.status(200);
          res.should.be.json;
          // prove db seeding works
          res.body.should.have.length.of.at.least(1);
          res.body.should.be.a('array');

          return BlogPost.count();
        })
        // prove number of posts returned from POST is equal to number of posts in DB
        .then(function(count) {
          console.log('res.body:', res.body);
          res.body.should.have.lengthOf(count);
        });
    });

    it('should return blog posts with correct fields', function() {
      let singleBlogPost;
      return chai.request(app)
        .get('/posts')
        .then(function(res) {
          res.body.forEach(function(post) {
            post.should.be.a('object');
            post.should.include.keys('id', 'author', 'content', 'title', 'created');
          });
          singleBlogPost = res.body[0];
          console.log('singleBlogPost:', singleBlogPost);
          return BlogPost.findById(singleBlogPost.id);
        })
        .then(function(singlePostFromDb) {
          console.log('singlePostFromDb:', singlePostFromDb);

          singlePostFromDb.id.should.equal(singleBlogPost.id);
          `${singlePostFromDb.author.firstName} ${singlePostFromDb.author.lastName}`.should.equal(singleBlogPost.author);
          singlePostFromDb.title.should.equal(singleBlogPost.title);
          singlePostFromDb.created.toISOString().should.equal(singleBlogPost.created);
          singlePostFromDb.content.should.equal(singleBlogPost.content);
        });
    });


      
  });

});