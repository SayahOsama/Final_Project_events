import * as amqp from 'amqplib';
import Event from "./models/events.js";

export const consumeMessages = async () => {
  try {
    // connect to RabbitMQ
    const conn = await amqp.connect(
      `amqps://mqmsniij:${process.env.AMQPPASS}@cow.rmq2.cloudamqp.com/mqmsniij`
    );
    const channel = await conn.createChannel();

    const exchange = 'refund_exchange';
    await channel.assertExchange(exchange, 'fanout', { durable: false });

    const queue = 'refund_queue';
    await channel.assertQueue(queue, { durable: true });

    await channel.bindQueue(queue, exchange, '');

    await channel.consume(queue, async (msg) => {
      const order = JSON.parse(msg.content.toString());
      let eventToUpdate;
      try{
        eventToUpdate = await Event.findById(order.eventID);
      }catch(error){
        return;
      }
      if(!eventToUpdate){
        return;
      }

       // Find the index of the ticket with the given ticketType
      const ticketIndex = eventToUpdate.tickets.findIndex(ticket => ticket.name === order.ticketType);

      if (ticketIndex === -1) {
          throw new Error('Ticket type not found');
      }

      // Update the quantity of the ticket
      eventToUpdate.tickets[ticketIndex].quantity += order.ticketQuantity;

      await eventToUpdate.save();
      channel.ack(msg);
    });
  } catch (error) {
    console.error(error);
  }
};
