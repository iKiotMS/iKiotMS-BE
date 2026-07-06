const aiService = require("../service/ai.service");

class AIController {
  async chat(req, res) {
    try {
      const tenantId = req.user.tenantId;
      const userId = req.user.userId;
      const { message, conversationId } = req.body;

      if (!message || typeof message !== "string" || !message.trim()) {
        return res.status(400).json({ success: false, message: "Message is required" });
      }

      const result = await aiService.chat(tenantId, userId, message, conversationId);
      return res.status(200).json({ success: true, data: result });
    } catch (error) {
      console.error("[AI Chat Controller] Error:", error);
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  async listConversations(req, res) {
    try {
      const tenantId = req.user.tenantId;
      const userId = req.user.userId;
      const conversations = await aiService.listConversations(tenantId, userId);
      return res.status(200).json({ success: true, data: conversations });
    } catch (error) {
      console.error("[AI Chat Controller] List error:", error);
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  async getConversationDetail(req, res) {
    try {
      const tenantId = req.user.tenantId;
      const userId = req.user.userId;
      const { id } = req.params;
      const conversation = await aiService.getConversation(tenantId, userId, id);
      return res.status(200).json({ success: true, data: conversation });
    } catch (error) {
      console.error("[AI Chat Controller] Detail error:", error);
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  async deleteConversation(req, res) {
    try {
      const tenantId = req.user.tenantId;
      const userId = req.user.userId;
      const { id } = req.params;
      await aiService.deleteConversation(tenantId, userId, id);
      return res.status(200).json({ success: true, message: "Conversation deleted successfully" });
    } catch (error) {
      console.error("[AI Chat Controller] Delete error:", error);
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  async renameConversation(req, res) {
    try {
      const tenantId = req.user.tenantId;
      const userId = req.user.userId;
      const { id } = req.params;
      const { title } = req.body;
      const updated = await aiService.updateConversationTitle(tenantId, userId, id, title);
      return res.status(200).json({ success: true, data: updated });
    } catch (error) {
      console.error("[AI Chat Controller] Rename error:", error);
      return res.status(500).json({ success: false, message: error.message });
    }
  }
}

module.exports = new AIController();
