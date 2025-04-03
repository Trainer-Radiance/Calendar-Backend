const express = require('express');
const { google } = require('googleapis');
const cors = require('cors');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const csrf = require('csurf');
require('dotenv').config();

const app = express();

// Middleware

// Security headers
app.use(helmet());

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limiting to API routes
app.use('/api/', apiLimiter);

// CORS configuration
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? process.env.CLIENT_URL || 'https://client-nine-bay-96.vercel.app'
    : 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token']
}));

app.use(express.json());

// Session configuration
const sessionConfig = {
  secret: process.env.SESSION_SECRET || 'your-secret-key',
  resave: true, // Changed to true to ensure session is saved on each request
  saveUninitialized: true, // Changed to true to ensure new sessions are saved
  cookie: {
    secure: false, // Set to false for development, even in production for now
    httpOnly: true,
    sameSite: 'lax', // Use lax for better compatibility
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days for longer sessions
  }
};

// Use MongoDB for session storage in production
if (process.env.NODE_ENV === 'production' && process.env.MONGODB_URI) {
  sessionConfig.store = MongoStore.create({
    mongoUrl: process.env.MONGODB_URI,
    ttl: 30 * 24 * 60 * 60 // 30 days
  });
  console.log('Using MongoDB for session storage');
}

app.use(session(sessionConfig));

// Session debugging middleware
app.use((req, res, next) => {
  console.log('Session ID:', req.sessionID);
  console.log('Session User:', req.session.user ? `${req.session.user.email} (has tokens: ${!!req.session.user.tokens})` : 'No user');
  next();
});

// CSRF protection (except for OAuth callback route)
// Commenting out for now as it requires more configuration
/*
const csrfProtection = csrf({ cookie: { secure: process.env.NODE_ENV === 'production' } });
app.use((req, res, next) => {
  // Skip CSRF for OAuth callback and login routes
  if (req.path === '/auth/callback' || req.path === '/auth/google') {
    return next();
  }
  csrfProtection(req, res, next);
});
*/

// Google OAuth2 Client
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

// Mock data for members (replace with database or API call in production)
const members = [
  { id: 1, name: 'Harsh ', email: 'harsh.mahida@radiancetechllc.com', calendarId: 'harsh.mahida@radiancetechllc.com' },
  { id: 2, name: 'Ayushi ', email: 'ayushi.rai@radiancetechllc.com', calendarId: 'ayushi.rai@radiancetechllc.com' },
  { id: 3, name: 'Shubham ', email: 'subham.patel@radiancetechllc.com', calendarId: 'subham.patel@radiancetechllc.com' },
  { id: 4, name: 'Chaitanya ', email: 'chaitanya@radiancetechllc.com', calendarId: 'chaitanya@radiancetechllc.com' },
  { id: 5, name: 'Avani ', email: 'avani.monani@radiancetechllc.com', calendarId: 'avani.monani@radiancetechllc.com' },
];

// Fetch list of members (protected with session)
app.get('/api/members', (req, res) => {
  // Check if user is authenticated via session
  if (!req.session.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  res.json(members);
});

// Add a new member (protected with session)
app.post('/api/members', (req, res) => {
  // Check if user is authenticated via session
  if (!req.session.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const { name, email, calendarId } = req.body;
  if (!name || !email || !calendarId) {
    return res.status(400).json({ error: 'Name, email, and calendarId are required' });
  }

  const newMember = {
    id: members.length + 1, // Auto-generate ID
    name,
    email,
    calendarId,
  };
  members.push(newMember);
  res.status(201).json(newMember);
});

// Delete a member
// comment this for the remove/adding the deletebutton/calendar view button
// app.delete('/api/members/:memberId', (req, res) => {
//   const memberId = parseInt(req.params.memberId);
//   const index = members.findIndex(m => m.id === memberId);
//   if (index === -1) {
//     return res.status(404).json({ error: 'Member not found' });
//   }

//   members.splice(index, 1);
//   res.status(204).send(); // No content
// });

// Routes

// CSRF token endpoint (commented out for now)
/*
app.get('/api/csrf-token', (req, res) => {
  // The CSRF middleware automatically sets the cookie
  res.json({ success: true });
});
*/

app.get('/auth/google', (req, res) => {
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: [
      'https://www.googleapis.com/auth/calendar.readonly',
      'https://www.googleapis.com/auth/userinfo.email'
    ],
  });
  res.redirect(url);
});

app.get('/auth/callback', async (req, res) => {
  try {
    console.log('Received OAuth callback with code');
    const { code } = req.query;

    console.log('Exchanging code for tokens...');
    const { tokens } = await oauth2Client.getToken(code);
    console.log('Received tokens:', JSON.stringify({
      access_token: tokens.access_token ? 'present' : 'missing',
      refresh_token: tokens.refresh_token ? 'present' : 'missing',
      expiry_date: tokens.expiry_date
    }));

    console.log('Verifying ID token...');
    const ticket = await oauth2Client.verifyIdToken({
      idToken: tokens.id_token,
      audience: process.env.GOOGLE_CLIENT_ID
    });

    const { email, name } = ticket.getPayload();
    console.log(`User authenticated: ${email}`);

    const user = { email, name, tokens };

    // Store user data in session
    req.session.user = user;

    // Save session explicitly
    req.session.save((err) => {
      if (err) {
        console.error('Error saving session:', err);
      } else {
        console.log('Session saved successfully with user data');
        console.log('Session ID after save:', req.sessionID);
      }

      // Redirect to the correct client URL based on environment
      const clientURL = process.env.NODE_ENV === 'production'
        ? process.env.CLIENT_URL || 'https://client-nine-bay-96.vercel.app'
        : 'http://localhost:3000';
      res.redirect(clientURL);
    });
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(500).json({ error: 'Authentication failed', message: error.message });
  }
});

// User info endpoint (session-based)
app.get('/api/me', (req, res) => {
  console.log('GET /api/me - Session ID:', req.sessionID);
  console.log('GET /api/me - Session user:', req.session.user ? `${req.session.user.email} (has tokens: ${!!req.session.user.tokens})` : 'No user');

  // Return user info without tokens for security
  if (req.session.user) {
    const { email, name } = req.session.user;
    res.json({
      user: {
        email,
        name,
        hasTokens: !!req.session.user.tokens
      }
    });
  } else {
    res.json({ user: null });
  }
});

// Logout endpoint (session-based)
app.post('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) return res.status(500).json({ error: 'Logout failed' });
    res.clearCookie('connect.sid');
    res.json({ success: true });
  });
});

// Fetch calendar availability for a specific member (protected with session)
app.get('/api/availability/:memberId', async (req, res) => {
  try {
    console.log(`Fetching availability for member ID: ${req.params.memberId}`);
    console.log('Session ID in availability endpoint:', req.sessionID);

    // Check if user is authenticated via session
    const sessionUser = req.session.user;
    console.log('Session user in availability endpoint:', sessionUser ? JSON.stringify(sessionUser, null, 2) : 'No user');

    if (!sessionUser) {
      console.error('No user found in session');
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Check if Google tokens are available
    if (!sessionUser.tokens) {
      console.error('No Google tokens available in session');
      return res.status(401).json({ error: 'No Google tokens available. Please re-authenticate.' });
    }

    console.log('Google tokens found:', JSON.stringify({
      access_token: sessionUser.tokens.access_token ? 'present' : 'missing',
      refresh_token: sessionUser.tokens.refresh_token ? 'present' : 'missing',
      expiry_date: sessionUser.tokens.expiry_date
    }));

    const memberId = parseInt(req.params.memberId);
    console.log(`Looking for member with ID: ${memberId}`);
    const member = members.find(m => m.id === memberId);
    if (!member) {
      console.error(`Member not found with ID: ${memberId}`);
      return res.status(404).json({ error: 'Member not found' });
    }

    console.log(`Found member: ${member.name}, setting OAuth credentials`);
    oauth2Client.setCredentials(sessionUser.tokens);
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    const { timezone, start, end } = req.query;
    console.log(`Fetching calendar with params: timezone=${timezone}, start=${start}, end=${end}`);

    try {
      const { data } = await calendar.events.list({
        calendarId: member.calendarId,
        timeMin: start,
        timeMax: end,
        maxResults: 100,
        singleEvents: true,
        orderBy: 'startTime',
        timeZone: timezone
      });

      console.log(`Successfully fetched ${data.items?.length || 0} events`);

      // For debugging, log the first event if available
      if (data.items && data.items.length > 0) {
        console.log('First event:', JSON.stringify(data.items[0], null, 2));
      }

      res.json(data.items || []);
    } catch (googleError) {
      console.error('Google Calendar API error:', googleError);

      // Check if token expired
      if (googleError.code === 401 || googleError.message?.includes('invalid_grant')) {
        console.log('Token appears to be expired or invalid, clearing session');
        req.session.user.tokens = null;
        return res.status(401).json({ error: 'Google token expired. Please re-authenticate.' });
      }

      // For development, return empty array instead of error
      if (process.env.NODE_ENV !== 'production') {
        console.log('Development mode: returning empty array on Google API error');
        return res.json([]);
      }

      throw googleError; // Re-throw for the outer catch block
    }
  } catch (error) {
    console.error('Calendar API error:', error);
    res.status(500).json({ error: 'Failed to fetch availability', message: error.message });
  }
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Global error handler:', err);

  // Handle CSRF token errors
  if (err.code === 'EBADCSRFTOKEN') {
    return res.status(403).json({
      error: 'Invalid CSRF token',
      message: 'Form submission failed due to invalid security token. Please refresh the page and try again.'
    });
  }

  // Handle other errors
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  res.status(statusCode).json({
    error: message,
    stack: process.env.NODE_ENV === 'production' ? '🥞' : err.stack
  });
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV}`);
});
