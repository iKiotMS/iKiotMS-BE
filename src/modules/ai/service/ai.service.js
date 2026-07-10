const { GoogleGenAI } = require("@google/genai");
const mongoose = require("mongoose");
const { AIChatHistory } = require("../../../models");
const aiTools = require("./ai.tools");

const apiKey = process.env.GEMINI_API_KEY;

let ai;
if (apiKey) {
  ai = new GoogleGenAI({ apiKey });
} else {
  console.warn("⚠️ Warning: GEMINI_API_KEY is not defined in environment variables. AI Chat will fail to initialize.");
}

const functionDeclarations = [
  {
    name: "searchProducts",
    description: "Tìm kiếm danh sách sản phẩm trong danh mục của cửa hàng theo tên, mã SKU hoặc mã vạch barcode.",
    parameters: {
      type: "OBJECT",
      properties: {
        search: { type: "STRING", description: "Từ khóa tìm kiếm (tên, sku, barcode)" },
        categoryId: { type: "STRING", description: "Lọc theo mã danh mục" },
        status: { type: "STRING", description: "Lọc theo trạng thái sản phẩm (ACTIVE, INACTIVE)" },
        page: { type: "INTEGER", description: "Trang kết quả cần lấy" },
        limit: { type: "INTEGER", description: "Số lượng bản ghi mỗi trang" }
      }
    }
  },
  {
    name: "getProductStockLevel",
    description: "Kiểm tra số lượng tồn kho chi tiết của một sản phẩm cụ thể tại các chi nhánh/kho hàng.",
    parameters: {
      type: "OBJECT",
      properties: {
        productId: { type: "STRING", description: "ID của sản phẩm cần kiểm tra tồn kho" }
      },
      required: ["productId"]
    }
  },
  {
    name: "getProductCategories",
    description: "Lấy danh sách các danh mục hàng hóa của cửa hàng.",
    parameters: {
      type: "OBJECT",
      properties: {
        search: { type: "STRING", description: "Từ khóa tìm kiếm danh mục" },
        page: { type: "INTEGER" },
        limit: { type: "INTEGER" }
      }
    }
  },
  {
    name: "getProductBrands",
    description: "Lấy danh sách nhãn hiệu, thương hiệu sản phẩm của cửa hàng.",
    parameters: {
      type: "OBJECT",
      properties: {
        search: { type: "STRING", description: "Từ khóa tìm kiếm thương hiệu" },
        page: { type: "INTEGER" },
        limit: { type: "INTEGER" }
      }
    }
  },
  {
    name: "searchCustomers",
    description: "Tìm kiếm thông tin khách hàng của cửa hàng theo tên hoặc số điện thoại.",
    parameters: {
      type: "OBJECT",
      properties: {
        search: { type: "STRING", description: "Tên hoặc số điện thoại khách hàng" },
        page: { type: "INTEGER" },
        limit: { type: "INTEGER" }
      }
    }
  },
  {
    name: "getCustomerPurchaseHistory",
    description: "Xem chi tiết lịch sử mua hàng, công nợ và tổng số tiền đã chi trả của một khách hàng cụ thể.",
    parameters: {
      type: "OBJECT",
      properties: {
        customerId: { type: "STRING", description: "ID của khách hàng" }
      },
      required: ["customerId"]
    }
  },
  {
    name: "getBranchList",
    description: "Xem danh sách các chi nhánh hiện có của cửa hàng.",
    parameters: {
      type: "OBJECT",
      properties: {
        search: { type: "STRING", description: "Tên chi nhánh" },
        page: { type: "INTEGER" },
        limit: { type: "INTEGER" }
      }
    }
  },
  {
    name: "getWarehouseList",
    description: "Xem danh sách các kho hàng chứa hàng của doanh nghiệp.",
    parameters: {
      type: "OBJECT",
      properties: {
        search: { type: "STRING", description: "Tên kho hàng" },
        page: { type: "INTEGER" },
        limit: { type: "INTEGER" }
      }
    }
  },
  {
    name: "getSupplierList",
    description: "Xem danh sách các nhà cung cấp sản phẩm và công nợ với từng nhà cung cấp.",
    parameters: {
      type: "OBJECT",
      properties: {
        search: { type: "STRING", description: "Tên nhà cung cấp" }
      }
    }
  },
  {
    name: "getStaffList",
    description: "Xem danh sách nhân sự của doanh nghiệp (tất cả các nhân viên).",
    parameters: {
      type: "OBJECT",
      properties: {
        keyword: { type: "STRING", description: "Từ khóa tìm kiếm (tên, email, số điện thoại)" },
        role: { type: "STRING", description: "Lọc theo chức vụ (STAFF, BRANCH_MANAGER, WAREHOUSE_MANAGER)" },
        status: { type: "STRING", description: "Lọc theo trạng thái (ACTIVE, INACTIVE)" },
        page: { type: "INTEGER" },
        recordPerPage: { type: "INTEGER" }
      }
    }
  },
  {
    name: "getStaffAttendanceReport",
    description: "Thống kê lịch sử chấm công, số ngày làm việc, đi muộn của nhân viên.",
    parameters: {
      type: "OBJECT",
      properties: {
        userId: { type: "STRING", description: "ID của nhân viên cần kiểm tra" },
        status: { type: "STRING", description: "Trạng thái chấm công (CHECKED_IN, CHECKED_OUT, ABSENT)" },
        checkinFrom: { type: "STRING", description: "Ngày bắt đầu tìm kiếm chấm công (YYYY-MM-DD)" },
        checkinTo: { type: "STRING", description: "Ngày kết thúc tìm kiếm chấm công (YYYY-MM-DD)" },
        page: { type: "INTEGER" },
        recordPerPage: { type: "INTEGER" }
      }
    }
  },
  {
    name: "getLeaveRequests",
    description: "Xem danh sách đơn xin nghỉ phép của nhân viên và trạng thái phê duyệt.",
    parameters: {
      type: "OBJECT",
      properties: {
        userId: { type: "STRING", description: "ID của nhân viên" },
        status: { type: "STRING", description: "Trạng thái đơn (PENDING, APPROVED, REJECTED, CANCELLED)" },
        page: { type: "INTEGER" },
        recordPerPage: { type: "INTEGER" }
      }
    }
  },
  {
    name: "getStaffWorkingSchedule",
    description: "Xem lịch phân ca làm việc (lịch biểu tuần/tháng) của các nhân viên.",
    parameters: {
      type: "OBJECT",
      properties: {
        userId: { type: "STRING", description: "ID nhân viên" },
        startDate: { type: "STRING", description: "Ngày bắt đầu ca làm (YYYY-MM-DD)" },
        endDate: { type: "STRING", description: "Ngày kết thúc ca làm (YYYY-MM-DD)" },
        status: { type: "STRING", description: "Trạng thái lịch làm (SCHEDULED, COMPLETED, CANCELLED)" },
        page: { type: "INTEGER" },
        recordPerPage: { type: "INTEGER" }
      }
    }
  },
  {
    name: "getPayrollSummary",
    description: "Thống kê danh sách bảng lương và chi phí quỹ lương chi trả cho nhân sự.",
    parameters: {
      type: "OBJECT",
      properties: {
        name: { type: "STRING", description: "Tên bảng lương cần tìm" },
        page: { type: "INTEGER" },
        recordPerPage: { type: "INTEGER" }
      }
    }
  },
  {
    name: "getActivePromotions",
    description: "Xem danh sách các chương trình khuyến mãi, voucher đang chạy của cửa hàng.",
    parameters: {
      type: "OBJECT",
      properties: {
        search: { type: "STRING", description: "Từ khóa tìm kiếm khuyến mãi" }
      }
    }
  },
  {
    name: "getTenantSubscriptionInfo",
    description: "Xem thông tin chi tiết gói dịch vụ tài khoản iKiot đang sử dụng (TRIAL, PLUS, PRO) và ngày hết hạn.",
    parameters: {
      type: "OBJECT",
      properties: {}
    }
  },
  {
    name: "getInventoryList",
    description: "Xem danh sách tồn kho hàng hóa tổng quan của các sản phẩm.",
    parameters: {
      type: "OBJECT",
      properties: {
        search: { type: "STRING", description: "Từ khóa tên/SKU sản phẩm" },
        locationId: { type: "STRING", description: "ID chi nhánh hoặc kho hàng" },
        locationType: { type: "STRING", description: "Loại địa điểm (branch hoặc warehouse)" },
        isLowStock: { type: "BOOLEAN", description: "Lọc sản phẩm sắp hết hàng" },
        page: { type: "INTEGER" },
        limit: { type: "INTEGER" }
      }
    }
  },
  {
    name: "searchOrders",
    description: "Tìm kiếm danh sách đơn hàng dựa trên trạng thái, hình thức thanh toán hoặc mốc thời gian.",
    parameters: {
      type: "OBJECT",
      properties: {
        status: { type: "STRING", description: "Trạng thái đơn (PENDING, COMPLETED, CANCELLED, RETURNED)" },
        paymentMethod: { type: "STRING", description: "Phương thức thanh toán (CASH, BANK_TRANSFER, MOMO, VNPAY, SEPAY)" },
        branchId: { type: "STRING", description: "ID chi nhánh bán hàng" },
        search: { type: "STRING", description: "Từ khóa tên hoặc SĐT khách hàng" },
        fromDate: { type: "STRING", description: "Ngày bắt đầu (YYYY-MM-DD)" },
        toDate: { type: "STRING", description: "Ngày kết thúc (YYYY-MM-DD)" },
        page: { type: "INTEGER" },
        limit: { type: "INTEGER" }
      }
    }
  },
  {
    name: "getRecentOrders",
    description: "Lấy nhanh danh sách 5-10 đơn hàng phát sinh mới nhất.",
    parameters: {
      type: "OBJECT",
      properties: {
        limit: { type: "INTEGER", description: "Số lượng đơn cần lấy (mặc định là 10)" }
      }
    }
  },
  {
    name: "getOrderDetailsByCode",
    description: "Tra cứu thông tin chi tiết của một đơn hàng cụ thể theo mã đơn (paymentReference, ví dụ: ORDxxxxxxxxxx) hoặc ID đơn hàng.",
    parameters: {
      type: "OBJECT",
      properties: {
        orderCode: { type: "STRING", description: "Mã đơn hàng hoặc ID đơn hàng" }
      },
      required: ["orderCode"]
    }
  },
  {
    name: "getStockMovementHistory",
    description: "Xem danh sách lịch sử phiếu di chuyển hàng hóa, điều chuyển kho giữa các chi nhánh.",
    parameters: {
      type: "OBJECT",
      properties: {
        search: { type: "STRING", description: "Tìm theo số phiếu điều chuyển" }
      }
    }
  }
];

class AIService {
  async chat(tenantId, userId, messageText, conversationId) {
    if (!ai) {
      throw new Error("GEMINI_API_KEY is not configured on server.");
    }

    // 1. Fetch Chat History from MongoDB
    let chatHistory = null;
    let isNew = false;
    
    if (conversationId && mongoose.Types.ObjectId.isValid(conversationId)) {
      chatHistory = await AIChatHistory.findOne({ _id: conversationId, tenantId, userId });
    }

    if (!chatHistory) {
      isNew = true;
      const truncatedTitle = messageText.length > 30 ? messageText.slice(0, 30) + "..." : messageText;
      chatHistory = new AIChatHistory({
        tenantId,
        userId,
        title: truncatedTitle,
        messages: []
      });
    }

    // 2. Map existing history to Gemini API format
    const contents = chatHistory.messages.map((msg) => ({
      role: msg.role,
      parts: msg.parts.map((p) => ({ text: p.text })),
    }));

    // Add current user prompt
    const userMessageContent = {
      role: "user",
      parts: [{ text: messageText }],
    };
    contents.push(userMessageContent);

    // 3. Intent Routing (Bypass API limitation of combining custom tools + google search)
    const historyText = chatHistory.messages
      .slice(-6)
      .map((m) => `${m.role === "user" ? "User" : "AI"}: ${m.parts.map((p) => p.text).join("")}`)
      .join("\n");

    const classificationPrompt = `Phân loại câu hỏi mới nhất của người dùng vào một trong ba nhóm:
- "INTERNAL_DATA": Yêu cầu truy vấn dữ liệu riêng tư của cửa hàng như: doanh thu, đơn hàng, hàng hóa, tồn kho, lương bổng, chấm công, ca làm, khách hàng, nhà cung cấp, chi nhánh, kho hàng.
- "EXTERNAL_SEARCH": Yêu cầu tra cứu thông tin thời gian thực bên ngoài Internet như: xu hướng thị trường, thời tiết, giá vàng, tin tức thời sự, hot trend mạng xã hội hiện nay.
- "GENERAL_LLM": Các câu hỏi chào hỏi, tư vấn kinh doanh chung chung không cần tra cứu Internet hay truy cập dữ liệu cửa hàng.

Trả về kết quả duy nhất là một trong các từ khóa: INTERNAL_DATA, EXTERNAL_SEARCH, GENERAL_LLM. Không giải thích thêm.

${historyText ? `Lịch sử trò chuyện gần đây:\n${historyText}\n` : ""}
Câu hỏi của người dùng: "${messageText}"`;

    let route = "GENERAL_LLM";
    try {
      const routeResponse = await ai.models.generateContent({
        model: "gemini-3.1-flash-lite",
        contents: classificationPrompt,
      });
      const resText = routeResponse.text.trim();
      if (resText.includes("INTERNAL_DATA")) {
        route = "INTERNAL_DATA";
      } else if (resText.includes("EXTERNAL_SEARCH")) {
        route = "EXTERNAL_SEARCH";
      }
      console.log(`[AI Agent] Routed user message "${messageText}" to: ${route}`);
    } catch (routeErr) {
      console.error("[AI Agent] Intent routing failed, falling back to GENERAL_LLM:", routeErr.message);
    }

    // 4. Configure tools based on the route
    const tools = [];
    if (route === "INTERNAL_DATA") {
      tools.push({ functionDeclarations });
    } else if (route === "EXTERNAL_SEARCH") {
      tools.push({ googleSearch: {} });
    }

    const config = {
      systemInstruction: `Bạn là Trợ lý thông minh độc quyền (AI Chat Assistant) của hệ thống quản lý iKiot.
Nhiệm vụ của bạn là hỗ trợ chủ cửa hàng (TENANT_OWNER) giải đáp các thắc mắc về kinh doanh, nhân sự, đơn hàng, tồn kho bằng các Tools có sẵn.
Khi câu hỏi yêu cầu dữ liệu của cửa hàng, hãy luôn sử dụng các custom tools MongoDB được cung cấp thay vì tự đoán hoặc suy luận.
Khi câu hỏi liên quan đến kiến thức chung hoặc xu hướng bên ngoài thị trường, hãy sử dụng tính năng Google Search Grounding để tra cứu thông tin mới nhất từ Internet.
Hãy trả lời một cách lịch sự, chuyên nghiệp bằng tiếng Việt và định dạng câu trả lời rõ ràng dưới dạng Markdown.`,
      tools: tools.length > 0 ? tools : undefined,
    };

    // 5. Execute ReAct loop (only relevant if route is INTERNAL_DATA)
    let finalAnswer = "";
    let loopCount = 0;
    const maxLoops = 10;

    try {
      while (loopCount < maxLoops) {
        loopCount++;

        const response = await ai.models.generateContent({
          model: "gemini-3.1-flash-lite",
          contents,
          config,
        });

        const candidate = response.candidates?.[0];
        const contentParts = candidate?.content?.parts || [];

        // Check if LLM requested any function calls
        const functionCalls = contentParts.filter((part) => part.functionCall);

        if (functionCalls.length > 0 && route === "INTERNAL_DATA") {
          const toolResponseParts = [];

          for (const call of functionCalls) {
            const { name, args } = call.functionCall;
            console.log(`[AI Agent] Calling Tool: ${name} with args:`, args);

            let result;
            try {
              if (aiTools[name]) {
                result = await aiTools[name](tenantId, args);
              } else {
                result = { error: `Tool ${name} is not defined.` };
              }
            } catch (error) {
              console.error(`[AI Agent] Tool ${name} execution error:`, error);
              result = { error: error.message || "Failed to execute tool." };
            }

            toolResponseParts.push({
              functionResponse: {
                name,
                response: { result },
              },
            });
          }

          contents.push(candidate.content);
          contents.push({
            role: "user",
            parts: toolResponseParts,
          });

          continue;
        }

        finalAnswer = contentParts.map((part) => part.text || "").join("");
        break;
      }

      if (loopCount >= maxLoops) {
        throw new Error("AI agent exceeded execution loop limit.");
      }

      // 6. Save messages
      chatHistory.messages.push({
        role: "user",
        parts: [{ text: messageText }],
      });
      chatHistory.messages.push({
        role: "model",
        parts: [{ text: finalAnswer }],
      });
      await chatHistory.save();

      return {
        reply: finalAnswer,
        conversationId: chatHistory._id,
        title: chatHistory.title,
      };
    } catch (error) {
      console.error("[AI Chat Service] Error during chat execution:", error);
      
      const defaultReply = "Xin lỗi, tôi đang có chút xíu việc bận ngay lúc này. Hãy nhờ tôi vào một lúc sau nha.";
      
      try {
        chatHistory.messages.push({
          role: "user",
          parts: [{ text: messageText }],
        });
        chatHistory.messages.push({
          role: "model",
          parts: [{ text: defaultReply }],
        });
        await chatHistory.save();
      } catch (saveError) {
        console.error("[AI Chat Service] Failed to save error conversation history:", saveError);
      }

      return {
        reply: defaultReply,
        conversationId: chatHistory._id,
        title: chatHistory.title,
      };
    }
  }

  async listConversations(tenantId, userId) {
    return await AIChatHistory.find({ tenantId, userId })
      .select("_id title updatedAt")
      .sort({ updatedAt: -1 })
      .lean();
  }

  async getConversation(tenantId, userId, conversationId) {
    if (!mongoose.Types.ObjectId.isValid(conversationId)) {
      throw new Error("Invalid conversationId");
    }
    const conversation = await AIChatHistory.findOne({ _id: conversationId, tenantId, userId }).lean();
    if (!conversation) {
      throw new Error("Conversation not found");
    }
    return conversation;
  }

  async deleteConversation(tenantId, userId, conversationId) {
    if (!mongoose.Types.ObjectId.isValid(conversationId)) {
      throw new Error("Invalid conversationId");
    }
    return await AIChatHistory.deleteOne({ _id: conversationId, tenantId, userId });
  }

  async updateConversationTitle(tenantId, userId, conversationId, title) {
    if (!mongoose.Types.ObjectId.isValid(conversationId)) {
      throw new Error("Invalid conversationId");
    }
    if (!title || !title.trim()) {
      throw new Error("Title is required");
    }
    const updated = await AIChatHistory.findOneAndUpdate(
      { _id: conversationId, tenantId, userId },
      { $set: { title: title.trim() } },
      { new: true }
    ).lean();
    if (!updated) {
      throw new Error("Conversation not found");
    }
    return updated;
  }
}

module.exports = new AIService();
