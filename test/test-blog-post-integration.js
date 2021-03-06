const chai = require('chai');
const chaiHttp = require('chai-http');
const faker = require('faker');
const mongoose = require('mongoose');
const moment = require('moment');

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

function generateBlogPostData() {

  return {
    author: {
      firstName: faker.name.firstName(),
      lastName: faker.name.lastName(),
    },
    title: faker.lorem.words(),
    content: generateContent(),
    created: new Date().toISOString()
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
        .then(function(count) {
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
          return BlogPost.findById(singleBlogPost.id);
        })
        .then(function(singlePostFromDb) {
          singlePostFromDb.id.should.equal(singleBlogPost.id);
          `${singlePostFromDb.author.firstName} ${singlePostFromDb.author.lastName}`.should.equal(singleBlogPost.author);
          singlePostFromDb.title.should.equal(singleBlogPost.title);
          singlePostFromDb.created.toISOString().should.equal(singleBlogPost.created);
          singlePostFromDb.content.should.equal(singleBlogPost.content);
        });
    });
  });

  describe('POST endpoint', function() {

    it('should add a new blog post', function() {

      const newBlogPost = generateBlogPostData();
      return chai.request(app)
        .post('/posts')
        .send(newBlogPost)
        .then(function(res) {
          res.should.have.status(201);
          res.should.be.json;
          res.body.should.be.a('object');
          res.body.should.include.keys(
            'id', 'author', 'title', 'content', 'created'
          );
          // if response has id we know object was created in DB
          res.body.id.should.not.be.null;
          res.body.author.should.equal(`${newBlogPost.author.firstName} ${newBlogPost.author.lastName}`);
          res.body.title.should.equal(newBlogPost.title);
          res.body.content.should.equal(newBlogPost.content);

          // takes date as a string and converts to a moment date
          const date1 = moment(res.body.created);
          const date2 = moment(newBlogPost.created);

          date1.isSame(date2, 'second').should.be.true;

          return BlogPost.findById(res.body.id);
        })
        .then(function(blogPostInDb) {
          blogPostInDb.author.firstName.should.equal(newBlogPost.author.firstName);
          blogPostInDb.author.lastName.should.equal(newBlogPost.author.lastName);
          blogPostInDb.title.should.equal(newBlogPost.title);
          blogPostInDb.content.should.equal(newBlogPost.content);
        });
    });
  });

  describe('PUT endpoint', function() {

    it('should update fields sent over', function() {

      const updateData = {
        title: 'Nice Title',
        content: 'here is some content. here is some more content. and it just keeps going. and it\'s done'
      };

      let res;

      return BlogPost
        .findOne()
        .exec()
        .then(function(blogPost) {
          updateData.id = blogPost.id;

          return chai.request(app)
            .put(`/posts/${blogPost.id}`)
            .send(updateData);
        })
        .then(function(_res) {
          res = _res;
          res.should.have.status(200);
          res.should.be.json;
          res.body.should.be.a('object');
          res.body.should.include.keys(
            'id', 'author', 'title', 'content', 'created'
          );
          res.body.title.should.equal(updateData.title);
          res.body.content.should.equal(updateData.content);

          return BlogPost.findById(updateData.id).exec();
        })
        .then(function(blogPost) {
          blogPost.title.should.equal(updateData.title);
          blogPost.content.should.equal(updateData.content);
          `${blogPost.author.firstName} ${blogPost.author.lastName}`.should.equal(res.body.author);
        });
    });

    describe('DELETE endpoint', function() {
      it('delete a blog post by id', function() {

        let blogPost;

        return BlogPost
          .findOne()
          .exec()
          .then(function(_blogPost) {
            blogPost = _blogPost;
            return chai.request(app)
              .delete(`/posts/${blogPost.id}`);
          })
          .then(function(res) {
            res.should.have.status(204);
            return BlogPost.findById(blogPost.id).exec();
          })
          .then(function(_blogPost) {
            should.not.exist(_blogPost);
          });
      });
    });

    it('throw error when passing incorrect id', function() {

      return chai.request(app)
        .delete(`/posts/1111111`)
        .then(function(res) {
          res.should.have.status(500);
        })
        .catch(function(res) {
          res.should.have.status(500);
        });
    })

  });

});