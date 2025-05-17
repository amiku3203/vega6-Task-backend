const express = require('express');
const router = express.Router();
const { Blog, Comment } = require('../model/Blog');
const authMiddleware = require('../middleware/auth');

 
router.post('/:blogId', authMiddleware, async (req, res) => {
  try {
    const { content, parentCommentId } = req.body;
    console.log("bki",req.user);
    // Validate
    if (!content) {
      return res.status(400).json({ success: false, message: 'Content is required' });
    }

    const blog = await Blog.findById(req.params.blogId);
    if (!blog) {
      return res.status(404).json({ success: false, message: 'Blog not found' });
    }

    const newComment = new Comment({
      blog: req.params.blogId,
      user: req.user.id, // or req.user.id depending on middleware
      content,
      parentComment: parentCommentId || null
    });

    const comment = await newComment.save();
    await comment.populate('user', ['email', 'profileImage']);

    res.status(201).json({
      success: true,
      comment
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});


 
router.get('/:blogId', async (req, res) => {
  try {
    // Check if blog exists
    const blog = await Blog.findById(req.params.blogId);
    if (!blog) {
      return res.status(404).json({ success: false, message: 'Blog not found' });
    }
    
    // Get top-level comments (no parent comment)
    const comments = await Comment.find({ 
      blog: req.params.blogId,
      parentComment: null
    })
      .sort({ createdAt: -1 })
      .populate('user', ['email', 'profileImage']);
    
    // For each top-level comment, get its replies
    const commentsWithReplies = await Promise.all(comments.map(async (comment) => {
      const replies = await Comment.find({
        parentComment: comment._id
      })
        .sort({ createdAt: 1 })
        .populate('user', ['email', 'profileImage']);
      
      return {
        ...comment.toObject(),
        replies
      };
    }));
    
    res.json({
      success: true,
      count: commentsWithReplies.length,
      comments: commentsWithReplies
    });
  } catch (error) {
    console.error(error);
    if (error.kind === 'ObjectId') {
      return res.status(404).json({ success: false, message: 'Resource not found' });
    }
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

// @route   DELETE api/comments/:id
// @desc    Delete a comment
// @access  Private
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.id);
    
    if (!comment) {
      return res.status(404).json({ success: false, message: 'Comment not found' });
    }
    
    // Check user owns the comment
    if (comment.user.toString() !== req.user.id) {
      return res.status(401).json({ success: false, message: 'User not authorized' });
    }
    
    await comment.remove();
    
    // Also remove all replies to this comment
    await Comment.deleteMany({ parentComment: req.params.id });
    
    res.json({
      success: true,
      message: 'Comment removed'
    });
  } catch (error) {
    console.error(error);
    if (error.kind === 'ObjectId') {
      return res.status(404).json({ success: false, message: 'Comment not found' });
    }
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

module.exports = router;