// server.ts - PRODUCTION-READY VERSION
// ────────────────────────────────────────────────────────────────────────

import 'dotenv/config';
import express, { Request, Response, NextFunction, Application, RequestHandler } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import fs from 'fs';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cors from 'cors';

import db from './src/db.js';
import { sendPasswordResetEmail } from './src/utils/email.js';
import { sendWelcomeEmail } from './src/utils/blogmail.js';

// Types
interface AuthUser {
  id: number;
  email: string;
  name: string;
  role: string;
}

// ESM __dirname fix
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app: Application = express();
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error('JWT_SECRET environment variable is required');

const PORT = Number(process.env.PORT ?? 3000);
const isProduction = process.env.NODE_ENV === 'production';

const COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(cors());
app.use(helmet());

// Ensure upload directory exists
const uploadDir = path.join(__dirname, 'public/uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer setup
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${uniqueSuffix}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed'));
    }
    cb(null, true);
  },
});

// Rate limiters
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10 });
const apiWriteLimiter = rateLimit({ windowMs: 5 * 60 * 1000, max: 30 });

// Auth Middleware
const authenticate: RequestHandler = (req, res, next) => {
  const token = req.cookies?.token;
  if (!token) {
    return res.status(401).json({ success: false, error: 'Unauthorized - No token' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthUser;
    (req as any).user = decoded;
    next();
  } catch (err) {
    res.clearCookie('token');
    return res.status(401).json({ success: false, error: 'Invalid or expired token' });
  }
};

const restrictTo = (...roles: string[]): RequestHandler => {
  return (req, res, next) => {
    if (! (req as any).user || !roles.includes((req as any).user.role)) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }
    next();
  };
};

// ────────────────────────────────────────────────────────────────
// ROUTES
// ────────────────────────────────────────────────────────────────

// Auth Routes
app.post('/api/auth/login', authLimiter, async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (typeof email !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ success: false, error: 'Invalid input' });
  }

  try {
    const user = db.prepare('SELECT * FROM users WHERE email = ?')
      .get(email.trim().toLowerCase()) as any;

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.cookie('token', token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'none' : 'lax',
      maxAge: COOKIE_MAX_AGE_MS,
      path: '/',
    });

    res.json({
      success: true,
      message: 'Login successful',
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

app.post('/api/auth/logout', (_req: Request, res: Response) => {
  res.clearCookie('token');
  res.json({ success: true });
});

app.get('/api/auth/me', (req: Request, res: Response) => {
  const token = req.cookies?.token;
  if (!token) {
    return res.status(401).json({ success: false, authenticated: false, message: 'No token' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthUser;
    res.json({
      success: true,
      authenticated: true,
      user: { id: decoded.id, email: decoded.email, name: decoded.name, role: decoded.role },
    });
  } catch (err) {
    res.status(401).json({ success: false, authenticated: false, message: 'Invalid token' });
  }
});

// Password Routes
app.post('/api/auth/forgot-password', authLimiter, async (req: Request, res: Response) => { /* ... */ });
app.post('/api/auth/reset-password', authLimiter, async (req: Request, res: Response) => { /* ... */ });
app.post('/api/auth/change-password', authenticate, async (req: Request, res: Response) => { /* ... */ });

// File Upload
app.post('/api/upload', authenticate, apiWriteLimiter, upload.single('image'), (req: Request, res: Response) => {
  if (!req.file) return res.status(400).json({ success: false, error: 'No file uploaded' });
  res.json({ success: true, url: `/uploads/${req.file.filename}` });
});

// Users Management (Owner Only)
app.get('/api/users', authenticate, restrictTo('owner'), (_req: Request, res: Response) => {
  const users = db.prepare('SELECT id, name, email, role FROM users').all();
  res.json({ success: true, users });
});

// Properties
app.get('/api/properties', (_req: Request, res: Response) => {
  const properties = db.prepare('SELECT * FROM properties ORDER BY created_at DESC').all();
  res.json(properties.map((p: any) => ({
    ...p,
    images: JSON.parse(p.images || '[]'),
    features: JSON.parse(p.features || '[]'),
    featured: !!p.featured,
  })));
});

app.get('/api/properties/:id', (req: Request, res: Response) => {
  const property = db.prepare('SELECT * FROM properties WHERE id = ?').get(req.params.id) as any;
  if (!property) return res.status(404).json({ error: 'Property not found' });

  res.json({
    ...property,
    images: JSON.parse(property.images || '[]'),
    features: JSON.parse(property.features || '[]'),
    featured: !!property.featured,
  });
});

app.post('/api/properties', authenticate, (req, res) => {
    const { title, price, address, city, state, zip, beds, baths, sqft, type, status, featured, imageUrl, images, videoUrl, virtualTourUrl, description, features, acreage, zoning } = req.body;
    const result = db.prepare(`
      INSERT INTO properties (title, price, address, city, state, zip, beds, baths, sqft, type, status, featured, imageUrl, images, videoUrl, virtualTourUrl, description, features, acreage, zoning, agent_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(title, price, address, city, state, zip, beds, baths, sqft, type, status, featured ? 1 : 0, imageUrl, JSON.stringify(images), videoUrl, virtualTourUrl, description, JSON.stringify(features || []), acreage || 0, zoning || '', (req as any).user.id);
    
    res.json({ id: result.lastInsertRowid });
  });

  app.put('/api/properties/:id', authenticate, (req, res) => {
    const { title, price, address, city, state, zip, beds, baths, sqft, type, status, featured, imageUrl, images, videoUrl, virtualTourUrl, description, features, acreage, zoning } = req.body;
    db.prepare(`
      UPDATE properties 
      SET title = ?, price = ?, address = ?, city = ?, state = ?, zip = ?, beds = ?, baths = ?, sqft = ?, type = ?, status = ?, featured = ?, imageUrl = ?, images = ?, videoUrl = ?, virtualTourUrl = ?, description = ?, features = ?, acreage = ?, zoning = ?
      WHERE id = ?
    `).run(title, price, address, city, state, zip, beds, baths, sqft, type, status, featured ? 1 : 0, imageUrl, JSON.stringify(images), videoUrl, virtualTourUrl, description, JSON.stringify(features || []), acreage || 0, zoning || '', req.params.id);
    
    res.json({ success: true })
  });

  app.delete('/api/properties/:id', authenticate, (req, res) => {
    db.prepare('DELETE FROM properties WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  });

 // Inquiries
  app.get('/api/inquiries', authenticate, (req, res) => {
    const inquiries = db.prepare(`
      SELECT i.*, p.title as property_title 
      FROM inquiries i 
      LEFT JOIN properties p ON i.property_id = p.id 
      ORDER BY i.created_at DESC
    `).all();
    res.json(inquiries);
  });

  app.post('/api/inquiries', (req, res) => {
    const { property_id, name, email, phone, message } = req.body;
    db.prepare(`
      INSERT INTO inquiries (property_id, name, email, phone, message)
      VALUES (?, ?, ?, ?, ?)
    `).run(property_id || null, name, email, phone, message);
    res.json({ success: true });
  });

  app.put('/api/inquiries/:id', authenticate, (req, res) => {
    const { status } = req.body;
    db.prepare('UPDATE inquiries SET status = ? WHERE id = ?').run(status, req.params.id);
    res.json({ success: true });
  });

  app.delete('/api/inquiries/:id', authenticate, (req, res) => {
    db.prepare('DELETE FROM inquiries WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  });

    // Favorites
  app.get('/api/favorites', authenticate, (req, res) => {
    const userId = (req as any).user.id;
    const favorites = db.prepare(`
      SELECT p.* 
      FROM properties p 
      JOIN favorites f ON p.id = f.property_id 
      WHERE f.user_id = ?
    `).all(userId);
    
    res.json(favorites.map((p: any) => ({
      ...p,
      images: JSON.parse(p.images),
      features: JSON.parse(p.features || '[]'),
      featured: !!p.featured,
      acreage: p.acreage || 0,
      zoning: p.zoning || ''
    })));
  });

  app.get('/api/favorites/ids', authenticate, (req, res) => {
    const userId = (req as any).user.id;
    const favorites = db.prepare('SELECT property_id FROM favorites WHERE user_id = ?').all(userId) as any[];
    res.json(favorites.map(f => f.property_id));
  });

  app.post('/api/favorites/:propertyId', authenticate, (req, res) => {
    const userId = (req as any).user.id;
    const propertyId = req.params.propertyId;
    try {
      db.prepare('INSERT INTO favorites (user_id, property_id) VALUES (?, ?)').run(userId, propertyId);
      res.json({ success: true });
    } catch (err) {
      // If already favorited, just return success
      res.json({ success: true });
    }
  });

  app.delete('/api/favorites/:propertyId', authenticate, (req, res) => {
    const userId = (req as any).user.id;
    const propertyId = req.params.propertyId;
    db.prepare('DELETE FROM favorites WHERE user_id = ? AND property_id = ?').run(userId, propertyId);
    res.json({ success: true });
  });

  // Blog Posts
  app.get('/api/posts', (req, res) => {
    const posts = db.prepare('SELECT p.*, u.email as author_email FROM posts p LEFT JOIN users u ON p.author_id = u.id ORDER BY created_at DESC').all();
    res.json(posts);
  });

  app.get('/api/posts/:slug', (req, res) => {
    const post = db.prepare('SELECT p.*, u.email as author_email FROM posts p LEFT JOIN users u ON p.author_id = u.id WHERE p.slug = ?').get(req.params.slug);
    if (!post) return res.status(404).json({ error: 'Post not found' });
    res.json(post);
  });

  app.post('/api/posts', authenticate, (req, res) => {
    const { title, slug, excerpt, content, imageUrl } = req.body;
    const result = db.prepare(`
      INSERT INTO posts (title, slug, excerpt, content, imageUrl, author_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(title, slug, excerpt, content, imageUrl, (req as any).user.id);
    res.json({ id: result.lastInsertRowid });
  });

  app.put('/api/posts/:id', authenticate, (req, res) => {
    const { title, slug, excerpt, content, imageUrl } = req.body;
    db.prepare(`
      UPDATE posts SET title = ?, slug = ?, excerpt = ?, content = ?, imageUrl = ? WHERE id = ?
    `).run(title, slug, excerpt, content, imageUrl, req.params.id);
    res.json({ success: true });
  });

  app.delete('/api/posts/:id', authenticate, (req, res) => {
    db.prepare('DELETE FROM posts WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  });

// ── Newsletter subscription ────────────────────────────────────────────

app.post('/api/subscribe', async (req, res) => {
  const { email } = req.body;

  // ─────────────────────────────────────────
  // 1. Validate email
  // ─────────────────────────────────────────
  const isValidEmail =
    typeof email === 'string' &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  if (!isValidEmail) {
    return res.status(400).json({
      success: false,
      error: 'Please enter a valid email address',
    });
  }

  const trimmedEmail = email.trim().toLowerCase();

  try {
    // ─────────────────────────────────────────
    // 2. Check duplicate subscription
    // ─────────────────────────────────────────
    const existing = db
      .prepare('SELECT 1 FROM subscribers WHERE email = ?')
      .get(trimmedEmail);

    if (existing) {
      return res.status(409).json({
        success: false,
        error: 'This email is already subscribed',
      });
    }

    // ─────────────────────────────────────────
    // 3. Save subscriber to DB
    // ─────────────────────────────────────────
    db.prepare(`
      INSERT INTO subscribers (email, source, subscribed_at)
      VALUES (?, ?, datetime('now'))
    `).run(trimmedEmail, 'blog_post');

    console.log('📩 New subscriber saved:', trimmedEmail);

    // ─────────────────────────────────────────
    // 4. SMTP Debug Logs
    // ─────────────────────────────────────────
    console.log('[SUBSCRIBE] SMTP check starting...');
    console.log('[SUBSCRIBE] SMTP_HOST:', process.env.SMTP_HOST || '(missing)');
    console.log('[SUBSCRIBE] SMTP_USER:', process.env.SMTP_USER || '(missing)');
    console.log('[SUBSCRIBE] SMTP_PASS:', process.env.SMTP_PASS ? 'present' : '(missing)');

    const smtpReady =
      !!process.env.SMTP_HOST &&
      !!process.env.SMTP_USER &&
      !!process.env.SMTP_PASS;

    let emailSent = false;

    // ─────────────────────────────────────────
    // 5. Send welcome email
    // ─────────────────────────────────────────
    if (smtpReady) {
      console.log('[SUBSCRIBE] SMTP vars present → attempting email send');

      try {
        console.log('[EMAIL] Calling sendWelcomeEmail for:', trimmedEmail);

        await sendWelcomeEmail(trimmedEmail);

        emailSent = true;

        console.log('[EMAIL] sendWelcomeEmail completed successfully');
      } catch (emailErr: any) {
        console.error('[EMAIL-ERROR] sendWelcomeEmail failed:');
        console.error('Message:', emailErr?.message);
        console.error('Stack:', emailErr?.stack);
        console.error('Full error:', JSON.stringify(emailErr, null, 2));
      }
    } else {
      console.warn('[SUBSCRIBE] SMTP not configured — skipping email');
    }

    // ─────────────────────────────────────────
    // 6. Success response
    // ─────────────────────────────────────────
    return res.status(200).json({
      success: true,
      message: 'Thank you! You are now subscribed.',
      emailSent,
    });
  } catch (err) {
    // ─────────────────────────────────────────
    // 7. Server error
    // ─────────────────────────────────────────
    console.error('❌ Subscribe error:', err);

    return res.status(500).json({
      success: false,
      error: 'Failed to subscribe',
    });
  }
});

  // ── Dashboard Stats ───────────────────────────────────────────────────

  // Dashboard Stats
  app.get('/api/stats', authenticate, (req, res) => {
    const totalListings = db.prepare('SELECT count(*) as count FROM properties').get() as any;
    const activeListings = db.prepare("SELECT count(*) as count FROM properties WHERE status = 'Available'").get() as any;
    const soldListings = db.prepare("SELECT count(*) as count FROM properties WHERE status = 'Sold'").get() as any;
    const totalInquiries = db.prepare('SELECT count(*) as count FROM inquiries').get() as any;
    const featuredProperties = db.prepare('SELECT count(*) as count FROM properties WHERE featured = 1').get() as any;
    const recentActivity = db.prepare('SELECT * FROM inquiries ORDER BY created_at DESC LIMIT 5').all();

    res.json({
      totalListings: totalListings.count,
      activeListings: activeListings.count,
      soldListings: soldListings.count,
      totalInquiries: totalInquiries.count,
      featuredProperties: featuredProperties.count,
      recentActivity
    });
  });

// ... (other routes like POST/PUT/DELETE properties, inquiries, favorites, posts, subscribe, stats)

// Production Static Serving (Fixed)
if (isProduction) {
  const distPath = path.resolve(__dirname, '../dist');   // ← Important fix
  app.use(express.static(distPath));

  app.get('*', (req: Request, res: Response) => {
    if (req.path.startsWith('/api/')) {
      return res.status(404).json({ success: false, error: 'API endpoint not found' });
    }
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});


