import { IncomingMessage, ServerResponse } from "http";
import Event from "./models/events.js";
import mongoose from "mongoose";


const parseSearchParams = (url: string): { [key: string]: string } => {
  const searchParams: { [key: string]: string } = {};

  if (url) {
    const queryIndex = url.indexOf("?");

    if (queryIndex !== -1) {
      const queryString = url.slice(queryIndex + 1);
      const queryParams = queryString.split("&");

      queryParams.forEach((pair) => {
        const [key, value] = pair.split("=");
        searchParams[key] = decodeURIComponent(value);
      });
    }
  }

  return searchParams;
};

export const mainRoute = (req: IncomingMessage, res: ServerResponse) => {
  res.statusCode = 200;
  res.setHeader("Content-Type", "text/html");
  res.write("<h1>Events API Documentation</h1>");
  res.write(`<ul>
      <li>GET /api/event - Get all events.</li>
      <li>GET /api/event/{id} - Get event by id.</li>
      <li>GET /api/event/available - Get all events with available tickets.</li>
      <li>GET /api/event/comments/{id} - Get comments for the event (by event ID).</li>
      <li>GET /api/event/comments/amount/{id} - Get the number of comments for the event (by event ID).</li>
      <li>GET /api/event/tickets/amount/{id} - Get the number of tickets for the event (by event ID).</li>
      <li>GET /api/event/tickets/price/{id} - Get the tickets' minimum price for the event (by event ID).</li>
      <li>GET /api/event/date - Get the event with the closest start date.</li>
      <li>POST /api/event - Create a new event.</li>
      <li>POST /api/event/comments/{id} - Create a new comment for the event (by event ID).</li>
      <li>PUT /api/event/{id} - Update event fields (by event ID).</li>
      <li>PUT /api/event/tickets/{id} - Update event tickets (by event ID).</li>
  </ul>`)
  res.end();
  return;
};

export const getDate = async (req: IncomingMessage, res: ServerResponse) => {

  let body = "";
  req.on("data", (chunk) => {
      body += chunk.toString();
  });
  req.on("end", async () => {
      try {
        const events = JSON.parse(body);

        const requiredFields = ["eventIDs"];
        for (const field of requiredFields) {
            if (!events[field]) {
                res.statusCode = 400;
                res.end(`Missing required field: ${field}`);
                return;
            }
        }
        
        const eventIDs = events.eventIDs;
       
        // Convert event IDs to MongoDB ObjectIds
        const objectIdList = eventIDs.map(id => new mongoose.Types.ObjectId(id));

        // Aggregation pipeline to find the event with the closest start date
        const closestEvent = await Event.aggregate([
            {
                $match: {
                    _id: { $in: objectIdList }, // Filter events by the provided IDs
                    start_date: { $gt: new Date() } // Add condition for start_date greater than current time
                }
            },
            {
                $sort: { start_date: 1 } // Sort events by start_date in ascending order
            },
            {
                $limit: 1 // Limit the result to the first event (closest start date)
            }
        ]);

        // Check if any event found
        if (closestEvent == undefined || closestEvent.length === 0) {
            res.statusCode = 404;
            res.end("No events found for the provided IDs.");
            return;
        }

        // Send the closest event with the response
        res.statusCode = 200;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify(closestEvent[0]));
        return;
      } catch (error) {
          res.statusCode = 500;
          res.end(error.message);
          return;
      }
  });
};

export const getEvent = async (req: IncomingMessage, res: ServerResponse) => {

  const eventId = req.url.split("/")[3];

  try {
      // Query all events from the database
      const event = await Event.findById(eventId).select('-comments');
      res.statusCode = 200;
      res.end(
        JSON.stringify(
          event
        )
      );
      return;

  } catch (error) {
    res.statusCode = 500;
    res.end("network error while fetching the events");
  }


};

export const getMinimumTicketPrice = async (req: IncomingMessage, res: ServerResponse) => {
  const eventId = req.url.split("/")[5];
  const ObjectId = mongoose.Types.ObjectId; // Get the ObjectId constructor

  try {
      // Convert eventId to ObjectId
      const objectId = new ObjectId(eventId);

      // Aggregate pipeline to calculate the minimum ticket price
      const minTicketPrice = await Event.aggregate([
        {
            $match: {
                _id: objectId, // Match the event by its ObjectId
                "tickets.quantity": { $gt: 0 } // Filter ticket types with quantity greater than zero
            }
        },
        {
            $unwind: "$tickets" // Deconstruct the tickets array
        },
        {
            $match: {
                "tickets.quantity": { $gt: 0 } // Filter ticket types with quantity greater than zero
            }
        },
        {
            $group: {
                _id: null,
                minPrice: { $min: "$tickets.price" } // Calculate the minimum price of tickets
            }
        },
        {
            $project: {
                _id: 0, // Exclude the default _id field from the output
                minPrice: 1 // Include the minimum price in the output
            }
        }
    ]);

      // Check if any tickets found
      if (minTicketPrice == undefined || minTicketPrice.length === 0) {
          res.statusCode = 404;
          res.end("there are no available tickets");
          return;
      }

      res.statusCode = 200;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ minPrice: minTicketPrice[0].minPrice }));
      return;
  } catch (error) {
      res.statusCode = 500;
      res.end(error.message);
      return;
  }
};

export const getTicketsNum = async (req: IncomingMessage, res: ServerResponse) => {
    const eventId = req.url.split("/")[5];
    const ObjectId = mongoose.Types.ObjectId; // Get the ObjectId constructor

    try {
        // Convert eventId to ObjectId
        const objectId = new ObjectId(eventId);

        // Aggregate pipeline to calculate total tickets amount for all ticket types
        const ticketsNum = await Event.aggregate([
            {
                $match: { _id: objectId } // Match the event by its ObjectId
            },
            {
                $unwind: "$tickets" // Deconstruct the tickets array
            },
            {
                $group: {
                    _id: null, // Group all tickets together
                    totalTicketsAmount: { $sum: "$tickets.quantity" } // Sum up the quantities for all tickets
                }
            }
        ]);

        // Check if any tickets found
        const totalTicketsAmount = ticketsNum.length > 0 ? ticketsNum[0].totalTicketsAmount : 0;

        res.statusCode = 200;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ totalTicketsAmount }));
    } catch (error) {
        res.statusCode = 500;
        res.end(error.message);
    }
};

export const updateTicket = async (req: IncomingMessage, res: ServerResponse) => {
 
  const id = req.url.split("/")[4];

    let body = "";
    req.on("data", (chunk) => {
        body += chunk.toString();
    });
    req.on("end", async () => {
        try {
          const ticket = JSON.parse(body);

          const requiredFields = ["ticketType", "amount"];
          for (const field of requiredFields) {
              if (!ticket[field]) {
                  res.statusCode = 400;
                  res.end(`Missing required field: ${field}`);
                  return;
              }
          }

          const ticketType = ticket.ticketType;
          const amount = ticket.amount;

          const event = await Event.findById(id);
          if (!event) {
              res.statusCode = 404;
              res.end("Event not found");
              return;
          }

          // Find the index of the ticket with the given type
          const ticketIndex = event.tickets.findIndex(ticket => ticket.name === ticketType);
          if (ticketIndex === -1) {
              res.statusCode = 404;
              res.end("Ticket not found");
              return;
          }

          if(parseInt(event.tickets[ticketIndex].quantity) + parseInt(amount) < 0){
            res.statusCode = 400;
            res.end("There isn't enough tickets");
            return;
          }
          
          // Update the ticket amount
          event.tickets[ticketIndex].quantity = parseInt(amount) + parseInt(event.tickets[ticketIndex].quantity);

          // Save the updated event
          await event.save();

          res.statusCode = 200;
          res.end("Ticket updated successfully");
        } catch (error) {
            res.statusCode = 500;
            res.end(error.message);
        }
    });
};

export const getCommentsNum = async (req: IncomingMessage, res: ServerResponse) => {

  const eventId = req.url.split("/")[5];
  const ObjectId = mongoose.Types.ObjectId; // Get the ObjectId constructor

  try {

    // Convert eventId to ObjectId
    const objectId = new ObjectId(eventId);
    const commentsCount = await Event.aggregate([
      {
          $match: { _id: objectId } // Match the event by its ID
      },
      {
          $project: {
              _id: 0, // Exclude the default _id field from the output
              commentsCount: { $size: "$comments" } // Calculate the size of the comments array
          }
      }
    ]);

    // Check if any event found
    if (commentsCount == undefined || commentsCount.length === 0) {
      res.statusCode = 200;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ commentsCount: 0 }));
      return;
    }

    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ commentsCount: commentsCount[0].commentsCount }));
    return;
  } catch (error) {
      res.statusCode = 500;
      res.end(error.message);
      return;
  }
};

export const getComments = async (req: IncomingMessage, res: ServerResponse) => {

  let skip = 0;
  let limit = 50;
  let id;
  const { url } = req;
  if (url) {
    const searchParams = parseSearchParams(url);
    if(searchParams["skip"]){
      skip = parseInt(searchParams["skip"]);
      if(skip < 0) skip = 0;
    }
    if(searchParams["limit"]){
      limit = parseInt(searchParams["limit"]);
      if(limit <= 0 || limit >= 50) limit = 50;
    }
    const urlParts = url.split("?")[0].split("/");
    const IdIndex = urlParts.indexOf("comments") + 1;
    id = decodeURIComponent(urlParts[IdIndex]);
  }

  try{
    const comments = await Event.aggregate([
      { $match: { _id: new mongoose.Types.ObjectId(id) } }, // Filter by event ID
      { $unwind: "$comments" }, // Deconstruct comments array
      { $sort: { "comments.date": -1 } }, // Sort comments by date in descending order
      { $skip: skip }, // Skip comments based on skip parameter
      { $limit: limit }, // Limit the number of comments based on limit parameter
      { $replaceRoot: { newRoot: "$comments" } } // Replace the root document with comments array
    ]);

    if (!comments) {
      res.statusCode = 404;
      res.end("Event not found or no comments available");
      return;
    }

    res.statusCode = 200;
    res.end(JSON.stringify(
      comments
    ));
    return;
  }catch(error){
    res.statusCode = 500;
    res.end(error.message);
    return;
  }
};

export const createComment = (req: IncomingMessage, res: ServerResponse) => {

  const id = req.url.split("/")[4];

  let body = "";
  req.on("data", (chunk) => {
    body += chunk.toString();
  });
  req.on("end", async () => {
    // Parse request body as JSON
    
    let comment;
    try {
      comment = JSON.parse(body);
    } catch (error) {
      res.statusCode = 400;
      res.end("Invalid JSON format in request body.");
      return;
    }
   
    const requiredFields = ["username", "content"];
    for (const field of requiredFields) {
      if (!comment[field]) {
        res.statusCode = 400;
        res.end(`Missing required field: ${field}`);
        return;
      }
    }
    
    try{
      const username = comment.username;
      const content = comment.content;
      const newComment = {
        username: username,
        content: content
      };
      
      const event = await Event.findById(id);
      if (!event) {
          res.statusCode = 404;
          res.end("Event not found");
          return;
      }

      // Add the new comment to the event's comments array
      event.comments.push(newComment);

      // Save the updated event document
      await event.save();

      res.statusCode = 201;
      res.end("Comment created successfully");
      return;
    }catch(error){
      res.statusCode = 500;
      res.end(error.message);
      return;
    }
  });
};

export const getAvailableEvent = async (req: IncomingMessage, res: ServerResponse) => {
 
  let skip = 0;
  let limit = 50;
  const { url } = req;
  if (url) {
    const searchParams = parseSearchParams(url);
    if(searchParams["skip"]){
      skip = parseInt(searchParams["skip"]);
      if(skip < 0) skip = 0;
    }
    if(searchParams["limit"]){
      limit = parseInt(searchParams["limit"]);
      if(limit <= 0 || limit >= 50) limit = 50;
    }
  }

  try {
    const currentTime = new Date(); // Get current time
    const events = await Event.aggregate([
      {
        $match: {
          'tickets.quantity': { $gt: 0 }, // Filter events with at least one ticket with available quantity
          'start_date': { $gt: currentTime } // Filter events with start_date greater than current time
        }
      },
      { $skip: skip }, // Skip records for pagination
      { $limit: limit } // Limit records for pagination
     ]);
      res.statusCode = 200;
      res.end(
        JSON.stringify(
          events
        )
      );
      return;

  } catch (error) {
    res.statusCode = 500;
    res.end("network error while fetching the events");
  }
};

export const getEvents = async (req: IncomingMessage, res: ServerResponse) => {

  let skip = 0;
  let limit = 50;
  const { url } = req;
  if (url) {
    const searchParams = parseSearchParams(url);
    if(searchParams["skip"]){
      skip = parseInt(searchParams["skip"]);
      if(skip < 0) skip = 0;
    }
    if(searchParams["limit"]){
      limit = parseInt(searchParams["limit"]);
      if(limit <= 0 || limit >= 50) limit = 50;
    }
  }

  try {
      // Query all events from the database
      const events = await Event.find().select('-comments').skip(skip).limit(limit);
      res.statusCode = 200;
      res.end(
        JSON.stringify(
          events
        )
      );
      return;

  } catch (error) {
    res.statusCode = 500;
    res.end("network error while fetching the events");
  }


};

export const updateEvent = async (req: IncomingMessage, res: ServerResponse) => {
 
  const id = req.url.split("/")[3];

  let body = "";
  req.on("data", (chunk) => {
    body += chunk.toString();
  });
  req.on("end", async () => {
    // Parse request body as JSON
    let fields;
    try {
      fields = JSON.parse(body);
    } catch (error) {
      res.statusCode = 400;
      res.end("Invalid JSON format in request body.");
      return;
    }

    // Check if the parsed JSON is an empty object
    if (Object.keys(fields).length === 0 && fields.constructor === Object) {
      res.statusCode = 200;
      res.end();
      return;
    }

    const bodyKeys = Object.keys(fields);
    let newEvent = {};
    bodyKeys.forEach(async (field)=>{
      const eventFields = ["title", "category", "description", "organizer", "start_date", "end_date", "location", "tickets","image"];
      const categories = ['Charity Event', 'Concert', 'Conference', 'Convention', 'Exhibition', 'Festival', 'Product Launch', 'Sports Event'];
      if(eventFields.includes(field)){
        const value = fields[field];
        if(value === ""){
          res.statusCode = 400;
          res.end();
          return;
        } 
      }
      switch (field) {
        case "title":
          newEvent["title"] = fields["title"];
          break;
        case "category":
          if(!categories.includes(fields["category"])){
            res.statusCode = 400;
            res.end();
            return;
          }
          newEvent["category"] = fields["category"];
          break;
        case "description":
          newEvent["description"] = fields["description"];
          break;
        case "organizer":
          newEvent["organizer"] = fields["organizer"];
          break;
        case "start_date":
          const date_start = new Date(fields["start_date"]);
          if (isNaN(date_start.getTime())) {
            res.statusCode = 400;
            res.end("invalid date format");
            return;
          }
          newEvent["start_date"] = fields["start_date"];
          break;
        case "end_date":
          const date_end = new Date(fields["end_date"]);
          if (isNaN(date_end.getTime())) {
            res.statusCode = 400;
            res.end("invalid date format");
            return;
          }
          newEvent["end_date"] = fields["end_date"];
          break;
        case "location":
          newEvent["location"] = fields["location"];
          break;
        case "tickets":
          if(fields["tickets"].length == 0){
            res.statusCode = 400;
            res.end();
            return;
          }
          if (!Array.isArray(fields["tickets"])) {
            res.statusCode = 400;
            res.end("Tickets must be an array.");
            return;
          }
          newEvent["tickets"] = fields["tickets"];
          break;
        case "image":
          newEvent["image"] = fields["image"];
          break;
       
      }

    let eventToUpdate;
    try{
      eventToUpdate = await Event.findById(id);
    }catch(error){}

    if(!eventToUpdate){
      res.statusCode = 404;
      res.end("event does not exist.");
      return;
    }

    Object.keys(newEvent).forEach((field)=>{
      switch (field) {
        case "title":
          eventToUpdate.title = newEvent["title"];
          break;
        case "category":
          eventToUpdate.category = newEvent["category"];
          break;
        case "description":
          eventToUpdate.description = newEvent["description"];
          break;
        case "organizer":
          eventToUpdate.organizer = newEvent["organizer"];
          break;
        case "start_date":
          eventToUpdate.start_date = newEvent["start_date"];
          break;
        case "end_date":
          eventToUpdate.end_date = newEvent["end_date"];
          break;
        case "location":
          eventToUpdate.location = newEvent["location"];
          break;
        case "tickets":
          eventToUpdate.tickets = newEvent["tickets"];
          break;
        case "image":
          eventToUpdate.image = newEvent["image"];
          break;
      }
    });
      
      try{
        await eventToUpdate.save();
        // await eventToUpdate.update(newEvent);
        res.statusCode = 200;
        res.end(
          JSON.stringify(
            {_id: eventToUpdate._id}
          )
        );
      }catch(error){
        res.statusCode = 400;
        res.end(error.message);
        return;
      }
  });
    
  // return;
  });
};

export const createEvent = (req: IncomingMessage, res: ServerResponse) => {

  let body = "";
  req.on("data", (chunk) => {
    body += chunk.toString();
  });
  req.on("end", async () => {
    // Parse request body as JSON
    
    let event;
    try {
      event = JSON.parse(body);
    } catch (error) {
      res.statusCode = 400;
      res.end("Invalid JSON format in request body.");
      return;
    }
   
    const requiredFields = ["title", "category", "description", "organizer", "start_date", "end_date", "location", "tickets"];
    for (const field of requiredFields) {
      if (!event[field]) {
        res.statusCode = 400;
        res.end(`Missing required field: ${field}`);
        return;
      }
    }
    
    try{
      const title = event.title;
      const category = event.category;
      const description = event.description;
      const organizer = event.organizer;
      const start_date = event.start_date;
      const end_date = event.end_date;
      const date_start = new Date(start_date);
      if (isNaN(date_start.getTime())) {
        res.statusCode = 400;
        res.end("invalid date format");
        return;
      }
      const date_end = new Date(end_date);
      if (isNaN(date_end.getTime())) {
        res.statusCode = 400;
        res.end("invalid date format");
        return;
      }
      const location = event.location;
      const tickets = event.tickets;
      let image;
      let newEvent;
      const containsImage = event["image"];
      if(containsImage){
        image = event.image;
        newEvent = new Event({
          title: title,
          category: category,
          description: description,
          organizer: organizer,
          start_date: start_date, 
          end_date: end_date,
          location: location, 
          tickets: tickets,
          image: image,
        });
      }else{
        newEvent = {
          title: title,
          category: category,
          description: description,
          organizer: organizer,
          start_date: start_date, 
          end_date: end_date,
          location: location, 
          tickets: tickets,
        };
      }
      await newEvent.save(newEvent);
      res.statusCode = 201;
      res.end(
        JSON.stringify(
          {_id: newEvent._id}
        )
      );
      return;
    }catch(error){
      res.statusCode = 500;
      res.end(error.message);
      return;
    }
  });
};
