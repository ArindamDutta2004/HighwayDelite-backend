import express from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User';
import { sendOTPEmail } from '../utils/email';
import { generateOTP, isOTPExpired } from '../utils/otp';
import rateLimit from 'express-rate-limit';

const router = express.Router();

/* ----------------------- helpers ----------------------- */
const EMAIL_RE = /^\S+@\S+\.\S+$/;
const normalizeEmail = (s: string) => s.trim().toLowerCase();

const requireJwtSecret = () => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET missing');
  }
  return process.env.JWT_SECRET;
};

// optional: minimum age check (set to 13 yrs)
const isTooYoung = (iso?: string) => {
  if (!iso) return false;
  const dob = new Date(iso);
  if (Number.isNaN(dob.getTime())) return true; // invalid date = bad input
  const now = new Date();
  const thirteenYearsMs = 13 * 365.25 * 24 * 60 * 60 * 1000;
  return now.getTime() - dob.getTime() < thirteenYearsMs;
};

// throttle OTP send/resend
const sendOtpLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
});

/* ----------------------- SIGNUP ----------------------- */
router.post('/signup', async (req, res) => {
  try {
    let { email, name, dateOfBirth } = req.body as {
      email?: string;
      name?: string;
      dateOfBirth?: string;
    };

    if (!email || !EMAIL_RE.test(email)) {
      return res.status(400).json({ message: 'Valid email is required' });
    }
    email = normalizeEmail(email);

    if (!name?.trim()) {
      return res.status(400).json({ message: 'Name is required' });
    }
    if (!dateOfBirth) {
      return res.status(400).json({ message: 'Date of birth is required' });
    }
    if (isTooYoung(dateOfBirth)) {
      return res.status(400).json({ message: 'You must be at least 13 years old' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'Email already exists. Please sign in.' });
    }

    const otp = generateOTP();
    const otpExpires = new Date(Date.now() + 5 * 60 * 1000);

    const user = new User({
      email,
      name: name.trim(),
      dateOfBirth: new Date(dateOfBirth),
      isGoogleUser: false,
      otp,
      otpExpires,
      isVerified: false,
    });

    await user.save();
    await sendOTPEmail(email, otp);

    return res.json({ message: 'OTP sent to your email for signup verification' });
  } catch (err) {
    console.error('Signup error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

/* ------------------- EMAIL AUTH ------------------- */
router.post('/email-auth', sendOtpLimiter, async (req, res) => {
  try {
    let { email, name, dateOfBirth } = req.body as {
      email?: string;
      name?: string;
      dateOfBirth?: string;
    };

    if (!email || !EMAIL_RE.test(email)) {
      return res.status(400).json({ message: 'Valid email is required' });
    }
    email = normalizeEmail(email);

    if (dateOfBirth && isTooYoung(dateOfBirth)) {
      return res.status(400).json({ message: 'You must be at least 13 years old' });
    }

    const otp = generateOTP();
    const otpExpires = new Date(Date.now() + 5 * 60 * 1000);

    let user = await User.findOne({ email });

    if (!user) {
      user = new User({
        email,
        name: name?.trim(),
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
        isGoogleUser: false,
        otp,
        otpExpires,
        isVerified: false,
      });
    } else {
      if (user.isGoogleUser) {
        return res.status(400).json({
          message: 'This email is registered with Google. Please use Google login.',
        });
      }
      user.otp = otp;
      user.otpExpires = otpExpires;
      if (name) user.name = name.trim();
      if (dateOfBirth) user.dateOfBirth = new Date(dateOfBirth);
    }

    await user.save();
    await sendOTPEmail(email, otp);

    return res.json({ message: 'OTP sent to your email' });
  } catch (err) {
    console.error('Email auth error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

/* ------------------- VERIFY OTP ------------------- */
router.post('/verify-otp', async (req, res) => {
  try {
    let { email, otp } = req.body as { email?: string; otp?: string };

    if (!email || !EMAIL_RE.test(email) || !otp) {
      return res.status(400).json({ message: 'Email and OTP are required' });
    }
    email = normalizeEmail(email);

    if (otp.length !== 6) {
      return res.status(400).json({ message: 'OTP must be 6 digits' });
    }

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: 'User not found' });

    if (!user.otp || user.otp !== otp) {
      return res.status(400).json({ message: 'Invalid OTP' });
    }
    if (!user.otpExpires || isOTPExpired(user.otpExpires)) {
      return res.status(400).json({ message: 'OTP has expired' });
    }

    user.isVerified = true;
    user.otp = undefined;
    user.otpExpires = undefined;
    await user.save();

    const token = jwt.sign(
      { userId: user._id, email: user.email },
      requireJwtSecret(),
      { expiresIn: '1h' }
    );

    return res.json({
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        dateOfBirth: user.dateOfBirth,
        isGoogleUser: user.isGoogleUser,
      },
    });
  } catch (err) {
    console.error('OTP verification error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

/* ------------------- GOOGLE AUTH ------------------- */
router.post('/google', async (req, res) => {
  try {
    const { email, googleId, displayName } = req.body as {
      email?: string;
      googleId?: string;
      displayName?: string;
    };

    if (!email || !googleId || !EMAIL_RE.test(email)) {
      return res.status(400).json({ message: 'Google authentication data required' });
    }
    const normEmail = normalizeEmail(email);

    let user = await User.findOne({ email: normEmail });

    if (!user) {
      user = new User({
        email: normEmail,
        googleId,
        name: displayName,
        isGoogleUser: true,
        isVerified: true,
      });
      await user.save();
    } else if (!user.isGoogleUser) {
      return res.status(400).json({
        message: 'This email is registered with email/OTP. Please use email login.',
      });
    }

    const token = jwt.sign(
      { userId: user._id, email: user.email },
      requireJwtSecret(),
      { expiresIn: '1h' }
    );

    return res.json({
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        dateOfBirth: user.dateOfBirth,
        isGoogleUser: user.isGoogleUser,
      },
    });
  } catch (err) {
    console.error('Google auth error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

export default router;
