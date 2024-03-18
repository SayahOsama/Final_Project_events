import * as mongoose from "mongoose";

const ticketSchema = new mongoose.Schema({
    name: { type: String, required: true },
    quantity: { type: Number, required: true, min: 0 },
    price: { type: Number, required: true, min: 0 }
},{_id: false});

const commentSchema = new mongoose.Schema({
    username: { type: String, required: true },
    date: { type: Date, default: Date.now, required: true},
    content: { type: String, required: true}
},{_id: false});

const eventSchema = new mongoose.Schema({
      title: {type: String, required: true},
      category: { type: String, enum: ['Charity Event', 'Concert', 'Conference', 'Convention', 'Exhibition', 'Festival', 'Product Launch', 'Sports Event'], required: true },
      description: {type: String, required: true},
      organizer: {type: String, required: true},
      start_date: {type: Date, required: true}, 
      end_date: { type: Date, required: true, validate: {
        validator: function(value) {
            return value > this.start_date;
        },
        message: 'End date must be after start date'
    }},
      location: {type: String, required: true}, 
      tickets: { type: [ticketSchema], required: true, validate: {
        validator: function(tickets) {
            return tickets.length > 0;
        },
        message: 'At least one ticket is required'
    }},
      image: {type: String},
      comments: { type: [commentSchema], required: false},
    }
);

export default mongoose.model("Event", eventSchema);