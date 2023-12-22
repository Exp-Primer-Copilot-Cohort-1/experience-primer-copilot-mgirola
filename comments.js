// Create web server
const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const cors = require('cors');
const { randomBytes } = require('crypto');

const app = express();
app.use(bodyParser.json());
app.use(cors());

// Data
const commentsByPostId = {};

// Routes
app.get('/posts/:id/comments', (req, res) => {
  res.send(commentsByPostId[req.params.id] || []);
});

// Create new comment
app.post('/posts/:id/comments', async (req, res) => {
  const commentId = randomBytes(4).toString('hex');
  const { content } = req.body;

  // Get comments for post
  const comments = commentsByPostId[req.params.id] || [];

  // Add new comment to array
  comments.push({ id: commentId, content, status: 'pending' });

  // Update comments for post
  commentsByPostId[req.params.id] = comments;

  // Emit event to event bus
  await axios.post('http://event-bus-srv:4005/events', {
    type: 'CommentCreated',
    data: { id: commentId, content, postId: req.params.id, status: 'pending' },
  });

  // Send response
  res.status(201).send(comments);
});

// Receive events from event bus
app.post('/events', async (req, res) => {
  console.log('Received event:', req.body.type);

  // Get event type and data
  const { type, data } = req.body;

  // Check if event is comment moderated
  if (type === 'CommentModerated') {
    // Get comment for post
    const { id, postId, status, content } = data;

    // Get comments for post
    const comments = commentsByPostId[postId];

    // Find comment to update
    const comment = comments.find((comment) => comment.id === id);

    // Update comment status
    comment.status = status;

    // Emit event to event bus
    await axios.post('http://event-bus-srv:4005/events', {
      type: 'CommentUpdated',
      data: { id, postId, status, content },
    });
  }

  // Send response
  res.send({});
});

// Start web server
app.listen(4001, () => {