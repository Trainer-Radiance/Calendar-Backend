const express = require('express');
const { google } = require('googleapis');
const cors = require('cors');
const session = require('express-session');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://client-psi-green.vercel.app/', 'http://localhost:3000'] 
    : 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());

// Session store (use proper store for production)
const MemoryStore = session.MemoryStore;
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: new MemoryStore(),
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000,
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
  }
}));

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

// Fetch list of members
app.get('/api/members', (req, res) => {
  res.json(members);
});

// Add a new member
app.post('/api/members', (req, res) => {
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

app.get('/auth/google/callback', async (req, res) => {
  try {
    const { code } = req.query;
    const { tokens } = await oauth2Client.getToken(code);
    const ticket = await oauth2Client.verifyIdToken({
      idToken: tokens.id_token,
      audience: process.env.GOOGLE_CLIENT_ID
    });

    const { email, name } = ticket.getPayload();
    req.session.user = { email, name, tokens };
    res.redirect('http://localhost:3000');
  } catch (error) {
    res.status(500).json({ error: 'Authentication failed' });
  }
});

app.get('/api/me', (req, res) => {
  res.json({ user: req.session.user || null });
});

app.post('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) return res.status(500).json({ error: 'Logout failed' });
    res.clearCookie('connect.sid');
    res.json({ success: true });
  });
});

// Fetch calendar availability for a specific member
app.get('/api/availability/:memberId', async (req, res) => {
  try {
    const user = req.session.user;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const memberId = parseInt(req.params.memberId);
    const member = members.find(m => m.id === memberId);
    if (!member) return res.status(404).json({ error: 'Member not found' });

    oauth2Client.setCredentials(user.tokens);
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    const { timezone, start, end } = req.query;

    const { data } = await calendar.events.list({
      calendarId: member.calendarId,
      timeMin: start,
      timeMax: end,
      maxResults: 100,
      singleEvents: true,
      orderBy: 'startTime',
      timeZone: timezone
    });

    res.json(data.items || []);
  } catch (error) {
    console.error('Calendar API error:', error);
    res.status(500).json({ error: 'Failed to fetch availability' });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
