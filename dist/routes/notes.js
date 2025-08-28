"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const Note_1 = __importDefault(require("../models/Note"));
const auth_1 = require("../middleware/auth");
const router = express_1.default.Router();
// Get all notes for user
router.get('/', auth_1.authenticateToken, async (req, res) => {
    try {
        const notes = await Note_1.default.find({ userId: req.userId }).sort({ createdAt: -1 });
        res.json(notes);
    }
    catch (error) {
        console.error('Get notes error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});
// Create note
router.post('/', auth_1.authenticateToken, async (req, res) => {
    try {
        const { title, content } = req.body;
        if (!title || !content) {
            return res.status(400).json({ message: 'Title and content are required' });
        }
        const note = new Note_1.default({
            userId: req.userId,
            title,
            content
        });
        await note.save();
        res.status(201).json(note);
    }
    catch (error) {
        console.error('Create note error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});
// Update note
router.put('/:id', auth_1.authenticateToken, async (req, res) => {
    try {
        const { title, content } = req.body;
        if (!title || !content) {
            return res.status(400).json({ message: 'Title and content are required' });
        }
        const note = await Note_1.default.findOneAndUpdate({ _id: req.params.id, userId: req.userId }, { title, content, updatedAt: new Date() }, { new: true });
        if (!note) {
            return res.status(404).json({ message: 'Note not found' });
        }
        res.json(note);
    }
    catch (error) {
        console.error('Update note error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});
// Delete note
router.delete('/:id', auth_1.authenticateToken, async (req, res) => {
    try {
        const note = await Note_1.default.findOneAndDelete({
            _id: req.params.id,
            userId: req.userId
        });
        if (!note) {
            return res.status(404).json({ message: 'Note not found' });
        }
        res.json({ message: 'Note deleted successfully' });
    }
    catch (error) {
        console.error('Delete note error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});
exports.default = router;
