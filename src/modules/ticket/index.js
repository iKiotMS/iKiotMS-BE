const TicketController = require("./controller/TicketController");
const { verifyJwt } = require("../../middlewares/authMiddleware");

const registerTicketModule = (app) => {
  // Tenant routes
  app.post("/tickets", verifyJwt, TicketController.create.bind(TicketController));
  app.get("/tickets/my", verifyJwt, TicketController.listMyTickets.bind(TicketController));
  app.post("/tickets/:id/my-reply", verifyJwt, TicketController.replyMyTicket.bind(TicketController));

  // Admin/Tenant shared route
  app.get("/tickets/:id", verifyJwt, TicketController.getTicketDetail.bind(TicketController));
  app.delete("/tickets/:id", verifyJwt, TicketController.deleteTicket.bind(TicketController));

  // Admin routes
  app.get("/admin/tickets", verifyJwt, TicketController.listAllTickets.bind(TicketController));
  app.post("/admin/tickets/:id/reply", verifyJwt, TicketController.replyTicket.bind(TicketController));
  app.patch("/admin/tickets/:id/close", verifyJwt, TicketController.closeTicket.bind(TicketController));

  console.log("✓ Support Ticket module registered");
};

module.exports = { registerTicketModule };
