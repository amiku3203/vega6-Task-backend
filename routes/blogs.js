// routes/blogs.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { Blog } = require('../model/Blog');
const authMiddleware = require('../middleware/auth');
 
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/blogs/');
  },
  filename: (req, file, cb) => {
    const uniqueName = `blog-${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5000000 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);
    
    if (extname && mimetype) {
      return cb(null, true);
    } else {
      cb(new Error('Images only! Please upload a JPEG or PNG file.'));
    }
  }
});

 
router.post('/', authMiddleware, upload.single('image'), async (req, res) => {
  try {
    const { title, description } = req.body;
    
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Blog image is required' });
    }
    
    const newBlog = new Blog({
      user: req.user.id,
      title,
      description,
      image: `/uploads/blogs/${req.file.filename}`
    });
    
    const blog = await newBlog.save();
    
    res.status(201).json({
      success: true,
      blog
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

 
router.get('/all', async (req, res) => {
  try {
    const blogs = await Blog.find()
      .sort({ createdAt: -1 })
      .populate('user', ['email', 'profileImage']);
    
    res.json({
      success: true,
      count: blogs.length,
      blogs
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});
router.get('/', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    const blogs = await Blog.find({ user: userId })
      .sort({ createdAt: -1 })
      .populate('user', ['email', 'profileImage']);

    res.json({
      success: true,
      count: blogs.length,
      blogs
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});
 
router.get('/:id', async (req, res) => {
  try {
    const blog = await Blog.findById(req.params.id)
      .populate('user', ['email', 'profileImage']);
    
    if (!blog) {
      return res.status(404).json({ success: false, message: 'Blog not found' });
    }
    
    res.json({
      success: true,
      blog
    });
  } catch (error) {
    console.error(error);
    if (error.kind === 'ObjectId') {
      return res.status(404).json({ success: false, message: 'Blog not found' });
    }
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

 
router.put('/:id', authMiddleware, upload.single('image'), async (req, res) => {
  try {
    const { title, description } = req.body;
    
    // Build blog object
    const blogFields = {
      title,
      description,
      updatedAt: Date.now()
    };
    
    // Add image if uploaded
    if (req.file) {
      blogFields.image = `/uploads/blogs/${req.file.filename}`;
    }
    
    // Find the blog
    let blog = await Blog.findById(req.params.id);
    
    if (!blog) {
      return res.status(404).json({ success: false, message: 'Blog not found' });
    }
    
    // Check user owns the blog
    if (blog.user.toString() !== req.user.id) {
      return res.status(401).json({ success: false, message: 'User not authorized' });
    }
    
    // Update
    blog = await Blog.findByIdAndUpdate(
      req.params.id,
      { $set: blogFields },
      { new: true }
    );
    
    res.json({
      success: true,
      blog
    });
  } catch (error) {
    console.error(error);
    if (error.kind === 'ObjectId') {
      return res.status(404).json({ success: false, message: 'Blog not found' });
    }
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

 
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const blog = await Blog.findById(req.params.id);
    
    if (!blog) {
      return res.status(404).json({ success: false, message: 'Blog not found' });
    }
    
    // Check user owns the blog
    if (blog.user.toString() !== req.user.id) {
      return res.status(401).json({ success: false, message: 'User not authorized' });
    }
    
    await blog.deleteOne();
    
    res.json({
      success: true,
      message: 'Blog removed'
    });
  } catch (error) {
    console.error(error);
    if (error.kind === 'ObjectId') {
      return res.status(404).json({ success: false, message: 'Blog not found' });
    }
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

module.exports = router;