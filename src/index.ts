import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { createComment, createEvent, getAvailableEvent, getComments, getCommentsNum, getDate, getEvent, getEvents, getMinimumTicketPrice, getTicketsNum, mainRoute, updateEvent, updateTicket } from './routes.js';
import { consumeMessages } from './counsume-messages.js';

dotenv.config();
const app = express();
const port = process.env.PORT;

// Connect to MongoDB
const dbURI = `mongodb+srv://${process.env.DBUSER}:${process.env.DBPASS}@pws.jqme9mr.mongodb.net/Final_Project`;
await mongoose.connect(dbURI);

// Start consuming messages
consumeMessages();

// CORS middleware
app.use(cors({
  origin: ['https://osama-sayah.github.io','https://final-project-gateway.onrender.com'],
  credentials: true
}));


// Routes
app.get('/api/event/tickets/price/:eventId', getMinimumTicketPrice);
app.get('/api/event/tickets/amount/:eventId', getTicketsNum);
app.post('/api/event/date', getDate);
app.put('/api/event/tickets/:eventId', updateTicket);
app.get('/api/event/comments/amount/:eventId', getCommentsNum);
app.get('/api/event/comments/:eventId', getComments);
app.post('/api/event/comments/:eventId', createComment);
app.get('/api/event/available', getAvailableEvent);
app.get('/api/event/:eventId', getEvent);
app.put('/api/event/:eventId', updateEvent);
app.get('/api/event', getEvents);
app.post('/api/event', createEvent);
app.get('/', mainRoute);

// Handle 404 - Not Found
app.use((req, res) => {
  res.status(404).send('Route does not exist');
});

app.listen(port, () => {
  console.log(`Server running! port ${port}`);
});