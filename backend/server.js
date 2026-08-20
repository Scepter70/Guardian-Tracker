require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const { createServer } = require('http');
const { Server } = require('socket.io');

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  }
});

// Middleware
app.use(cors());
app.use(express.json());

// Environment variables
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/guardian';
const JWT_SECRET = process.env.JWT_SECRET || 'guardian_secret_key_change_in_production';

// Connect to MongoDB
mongoose
  .connect(MONGODB_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch((err) => console.error('❌ MongoDB connection error:', err));

// ====================== SCHEMAS ======================

const UserSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true },
    name: { type: String, required: true }
  },
  { timestamps: true }
);

const User = mongoose.model('User', UserSchema);

const DeviceSchema = new mongoose.Schema(
  {
    deviceId: { type: String, required: true, unique: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true },
    isStolen: { type: Boolean, default: false },
    lastLocation: {
      lat: Number,
      lng: Number,
      accuracy: Number,
      timestamp: Date
    },
    locations: [
      {
        lat: Number,
        lng: Number,
        accuracy: Number,
        timestamp: { type: Date, default: Date.now }
      }
    ]
  },
  { timestamps: true }
);

const Device = mongoose.model('Device', DeviceSchema);

// ====================== AUTH MIDDLEWARE ======================

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
}

// ====================== AUTH ROUTES ======================

// Register
app.post('/api/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ message: 'Email, password and name are required' });
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(400).json({ message: 'Email already registered' });
    }

    const hashed = await bcrypt.hash(password, 10);
    const user = new User({
      email: email.toLowerCase(),
      password: hashed,
      name
    });
    await user.save();

    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({
      token,
      user: { id: user._id, email: user.email, name: user.name }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error during registration' });
  }
});

// Login
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(400).json({ message: 'Invalid email or password' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid email or password' });
    }

    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '7d' });
    res.json({
      token,
      user: { id: user._id, email: user.email, name: user.name }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error during login' });
  }
});

// ====================== DEVICE ROUTES ======================

// Register a new device
app.post('/api/devices', authMiddleware, async (req, res) => {
  try {
    const { deviceId, name } = req.body;

    if (!deviceId || !name) {
      return res.status(400).json({ message: 'deviceId and name are required' });
    }

    const existing = await Device.findOne({ deviceId });
    if (existing) {
      return res.status(400).json({ message: 'Device already registered' });
    }

    const device = new Device({
      deviceId,
      userId: req.userId,
      name,
      isStolen: false,
      locations: []
    });

    await device.save();
    res.status(201).json(device);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error registering device' });
  }
});

// Get all devices of the logged-in user
app.get('/api/devices', authMiddleware, async (req, res) => {
  try {
    const devices = await Device.find({ userId: req.userId }).sort({ updatedAt: -1 });
    res.json(devices);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error fetching devices' });
  }
});

// Update location of a device
app.post('/api/devices/:deviceId/location', authMiddleware, async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { lat, lng, accuracy } = req.body;

    if (lat === undefined || lng === undefined) {
      return res.status(400).json({ message: 'lat and lng are required' });
    }

    const device = await Device.findOne({ deviceId, userId: req.userId });
    if (!device) {
      return res.status(404).json({ message: 'Device not found' });
    }

    const location = {
      lat,
      lng,
      accuracy: accuracy || null,
      timestamp: new Date()
    };

    device.lastLocation = location;
    device.locations.push(location);

    // Keep only last 100 locations
    if (device.locations.length > 100) {
      device.locations = device.locations.slice(-100);
    }

    await device.save();

    // Emit real-time update
    io.to(device.userId.toString()).emit('locationUpdate', {
      deviceId: device.deviceId,
      location
    });

    res.json({ message: 'Location updated', location });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error updating location' });
  }
});

// Mark device as stolen / recovered
app.put('/api/devices/:deviceId/stolen', authMiddleware, async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { isStolen } = req.body;

    const device = await Device.findOne({ deviceId, userId: req.userId });
    if (!device) {
      return res.status(404).json({ message: 'Device not found' });
    }

    device.isStolen = Boolean(isStolen);
    await device.save();

    io.to(device.userId.toString()).emit('deviceStatusUpdate', {
      deviceId: device.deviceId,
      isStolen: device.isStolen
    });

    res.json({ message: `Device marked as ${device.isStolen ? 'stolen' : 'recovered'}`, device });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error updating device status' });
  }
});

// Delete a device
app.delete('/api/devices/:deviceId', authMiddleware, async (req, res) => {
  try {
    const { deviceId } = req.params;
    const device = await Device.findOneAndDelete({ deviceId, userId: req.userId });

    if (!device) {
      return res.status(404).json({ message: 'Device not found' });
    }

    res.json({ message: 'Device deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error deleting device' });
  }
});

// ====================== SOCKET.IO ======================

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('join', (userId) => {
    if (userId) {
      socket.join(userId.toString());
      console.log(`User ${userId} joined room`);
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// ====================== HEALTH CHECK ======================

app.get('/', (req, res) => {
  res.json({
    message: 'Guardian Tracker API is running',
    version: '1.0.0',
    status: 'ok'
  });
});

// ====================== START SERVER ======================

server.listen(PORT, () => {
  console.log(`🚀 Guardian Tracker server running on port ${PORT}`);
});
