import { createServer, IncomingMessage, ServerResponse } from "http";
import * as mongoose from "mongoose";
import * as dotenv from "dotenv";
import { createComment, createEvent, getAvailableEvent, getComments, getCommentsNum, getDate, getEvent, getEvents, getMinimumTicketPrice, getTicketsNum, mainRoute, updateEvent, updateTicket } from "./routes.js";
import { consumeMessages } from './counsume-messages.js';

// For environment-variables
dotenv.config();
const port = process.env.PORT;

// Connect to mongoDB
const dbURI = `mongodb+srv://${process.env.DBUSER}:${process.env.DBPASS}@pws.jqme9mr.mongodb.net/Final_Project`;
await mongoose.connect(dbURI);

// start consuming messages
consumeMessages();

const server = createServer((req: IncomingMessage, res: ServerResponse) => {

  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, origin, accept');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS, POST, PUT, DELETE');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  
  if (req.url.match(/\/api\/event\/tickets\/price\/\w+/)) {
    if(req.method === "GET"){
      getMinimumTicketPrice(req,res);
      return;
    }
  }

  if (req.url.match(/\/api\/event\/tickets\/amount\/\w+/)) {
    if(req.method === "GET"){
      getTicketsNum(req,res);
      return;
    }
  }

  if (req.url.match(/\/api\/event\/date/)) {
    if(req.method === "POST"){
      getDate(req,res);
      return;
    }
  }

  if (req.url.match(/\/api\/event\/tickets\/\w+/)) {
    if(req.method === "PUT"){
      updateTicket(req,res);
      return;
    }
  }

  if (req.url.match(/\/api\/event\/comments\/amount\/\w+/)) {
    if(req.method === "GET"){
      getCommentsNum(req,res);
      return;
    }
  }

  if (req.url.match(/\/api\/event\/comments\/[\w=&?]+/)) {
    if(req.method === "GET"){
      getComments(req,res);
      return;
    }

    if(req.method === "POST"){
      createComment(req,res);
      return;
    }
  }

  if (req.url.match(/\/api\/event\/available[\w=&?]*/)) {
    if(req.method === "GET"){
      getAvailableEvent(req,res);
      return;
    }
  }

  if (req.url.match(/\/api\/event\/\w+/)) {
    if(req.method === "GET"){
      getEvent(req,res);
      return;
    }
    if(req.method === "PUT"){
      updateEvent(req,res);
      return;
    }
  }

  if (req.url.match(/\/api\/event[\w=&?]*/)) {
    if(req.method === "GET"){
      getEvents(req,res);
      return;
    }
    if(req.method === "POST"){
      createEvent(req,res);
      return;
    }
  }

  if (req.url.match(/\//)) {
    if(req.method === "GET"){
      mainRoute(req,res);
      return;
    }
  }

  res.statusCode = 404;
  res.end("route does not exist");
});

server.listen(port);
console.log(`Server running! port ${port}`);
