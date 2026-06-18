# Backend Agent Guidelines

## Overview

This document defines guidelines and requirements for AI agents when working with the backend API. All endpoint modifications must follow these rules to ensure consistency, documentation, and code quality. 
**Current Tech Stack:** Node.js, Express, MongoDB (Mongoose), and Module Architecture.

---

## Rule 1: Always Update Swagger Documentation

### When to apply:

- ✅ Creating a new endpoint
- ✅ Modifying an existing endpoint's parameters, request body, or response
- ✅ Adding new query parameters or headers
- ✅ Changing endpoint authentication requirements
- ✅ Adding new response codes or error scenarios

### How to apply:

1. Add or update JSDoc comments in the `index.js` file of the module using `@openapi` or `@swagger` tags.
2. Include all OpenAPI 3.0 required fields:
   - `summary` — brief description
   - `tags` — endpoint category (e.g., [Auth], [Products], [Orders])
   - `parameters` or `requestBody` — input documentation
   - `responses` — all possible HTTP status codes and schemas
   - `security` — if endpoint requires authentication (`bearerAuth`)

### Example template:

```javascript
/**
 * @openapi
 * /resources/{id}:
 *   patch:
 *     summary: Update resource
 *     tags: [Resources]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               status: { type: string, enum: [ACTIVE, INACTIVE] }
 *     responses:
 *       200:
 *         description: Resource updated
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Resource not found
 */
```

---

## Rule 2: Endpoint Naming & Structure Consistency

### HTTP Methods:

- `GET` — retrieve data (read-only, idempotent)
- `POST` — create new resource or trigger action
- `PATCH` — partial update of existing resource
- `PUT` — full replacement of resource (use sparingly)
- `DELETE` — delete or soft-delete resource

### URL Path Patterns:

```
GET    /resource              — list with pagination/filters
GET    /resource/:id          — get single resource
POST   /resource              — create new resource
PATCH  /resource/:id          — update resource
DELETE /resource/:id          — delete resource
POST   /resource/:id/action   — custom action on resource
```

### Request & Database Naming:

- Use `camelCase` in JSON requests and responses.
- Use `camelCase` for MongoDB schema fields and models.

### Response Format:

```javascript
// Success responses (2xx)
{
  success: true,
  message: "Action completed successfully", // Optional
  data: { /* object or array */ }, // Optional payload
  // OR place payload at root if specified by DTO:
  // accessToken: "...",
  // user: { ... }
}

// Error responses (4xx, 5xx)
{
  success: false,
  message: "Human-readable error",
  // optional: validation errors array/object
  errors: { fieldName: "Error message" } 
}
```

---

## Rule 3: Controller Logic & DTO Standards

### Do's:

- ✅ Use **Data Transfer Objects (DTOs)** to validate incoming requests (`req.body`, `req.query`).
- ✅ Check authentication (`req.user`) and validate input before calling services.
- ✅ Return appropriate HTTP status codes (201 for create, 400 for validation, 401/403 for auth, 404 for not found).
- ✅ Use `try-catch` blocks to catch and return errors properly.
- ✅ Define controllers as Classes and export instantiated objects (`module.exports = new ModuleController();`).

### Example controller pattern:

```javascript
const ResourceService = require("../service/ResourceService");
const UpdateResourceDTO = require("../dto/UpdateResourceDTO");

class ResourceController {
  async update(req, res) {
    try {
      const { id } = req.params;
      
      // 1. Validate Input using DTO
      const updateDTO = new UpdateResourceDTO(req.body);
      const validation = updateDTO.validate();

      if (!validation.isValid) {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: validation.errors,
        });
      }

      // 2. Call service layer
      const updatedResource = await ResourceService.updateResource(id, updateDTO);

      // 3. Return response
      res.status(200).json({
        success: true,
        message: 'Resource updated successfully',
        data: updatedResource,
      });
    } catch (error) {
      console.error('Update error:', error);
      res.status(400).json({ 
        success: false,
        message: error.message || "Failed to update resource" 
      });
    }
  }
}

module.exports = new ResourceController();
```

---

## Rule 4: Service Layer Standards (MongoDB/Mongoose)

### Do's:

- ✅ Handle MongoDB and Mongoose validation errors gracefully.
- ✅ Throw descriptive errors (e.g., `new Error("Resource not found")`) to be caught by the Controller.
- ✅ Use `.lean()` for read-only queries when you don't need Mongoose document methods (improves performance).
- ✅ Use Mongoose Transactions (Sessions) when updating multiple related documents.
- ✅ Use pagination (`skip` and `limit`) for list operations.

### Don't's:

- ❌ Pass `req` or `res` objects into the Service layer.
- ❌ Select sensitive fields (e.g., passwords) unless absolutely necessary.
- ❌ Hard-delete data unless required (use soft-delete like `status: "INACTIVE"` or a deleted flag).

### Example service pattern:

```javascript
const { Resource } = require("../../../models");

class ResourceService {
  async updateResource(id, updateData) {
    // Check if exists
    const resource = await Resource.findById(id);
    if (!resource) {
      throw new Error("Resource not found");
    }

    // Update
    Object.assign(resource, updateData);
    await resource.save();

    return resource;
  }

  async listResources({ page = 1, limit = 20, status }) {
    const query = {};
    if (status) query.status = status;

    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      Resource.find(query).skip(skip).limit(Number(limit)).lean(),
      Resource.countDocuments(query)
    ]);

    return {
      data,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / limit)
      }
    };
  }
}

module.exports = new ResourceService();
```

---

## Rule 5: Testing Endpoints

### After creating/modifying an endpoint:

1. ✅ Verify Swagger documentation is complete and accurate.
2. ✅ Test the endpoint manually (curl, Postman, or Swagger UI).
3. ✅ Test with valid auth token (if protected).
4. ✅ Test with invalid/missing token (if protected).
5. ✅ Test with invalid input (400 response).
6. ✅ Test with unauthorized user (403 response).
7. ✅ Test success cases (200/201 response).
8. ✅ Verify response format matches documentation.

---

## Rule 6: Module Architecture & File Organization

The project uses a feature-based **Module Architecture**. All code related to a specific domain (e.g., `auth`, `products`, `orders`) should be self-contained in its respective folder inside `src/modules/`.

### Folder Structure for a Module:

```
src/modules/[moduleName]/
├── index.js                     # Route definitions & Swagger docs
├── controller/
│   └── [ModuleName]Controller.js # Request handling, DTO validation, Responses
├── service/
│   └── [ModuleName]Service.js    # Business logic & Database interaction
└── dto/
    ├── [Action]RequestDTO.js    # Input validation classes
    └── [Action]ResponseDTO.js   # Optional: Output formatting classes
```

### New Module Checklist:

1. ✅ Create module folder: `src/modules/[moduleName]/`
2. ✅ Create `controller`, `service`, and `dto` subfolders.
3. ✅ Create DTOs for request validation.
4. ✅ Implement Business Logic in `[ModuleName]Service.js`.
5. ✅ Handle HTTP requests in `[ModuleName]Controller.js`.
6. ✅ Define routes and Swagger docs in `index.js` using a register function (e.g., `registerModule(app)`).
7. ✅ Import and initialize the module route in `src/server.js` or the main router file.

---

## Rule 7: Common Response Codes

| Code | Scenario                                   |
| ---- | ------------------------------------------ |
| 200  | ✅ Successful GET, PATCH, PUT, DELETE      |
| 201  | ✅ Successful POST (resource created)      |
| 400  | ❌ Validation error, invalid input         |
| 401  | ❌ Missing or invalid authentication       |
| 403  | ❌ Valid auth but insufficient permissions |
| 404  | ❌ Resource not found                      |
| 409  | ❌ Conflict (e.g., duplicate unique field) |
| 422  | ❌ Unprocessable entity (semantic error)   |
| 500  | ❌ Unexpected server error                 |

---

## Checklist for Every Endpoint Change

- [ ] Route registered in `index.js` of the module.
- [ ] Swagger documentation added/updated in `index.js`.
- [ ] DTO created for Request validation.
- [ ] Route handler implemented in Controller.
- [ ] Database logic separated into Service layer.
- [ ] All HTTP methods documented.
- [ ] `security` field present in Swagger if endpoint requires auth.
- [ ] Endpoint tested with Postman, curl or Swagger UI.
- [ ] Response format matches `{ success: boolean, message: string, ... }` pattern.
- [ ] Errors handled gracefully and not crashing the server.

---

## Schema Updates (Mongoose Models)

When adding a new resource type, models are kept in `src/models/` (or within the module if strictly scoped). Always define schemas with Mongoose and include Timestamps:

```javascript
const mongoose = require("mongoose");

const resourceSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
    },
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
    },
    status: {
      type: String,
      enum: ["ACTIVE", "INACTIVE"],
      default: "ACTIVE",
    },
  },
  { timestamps: true } // Automatically adds createdAt and updatedAt
);

module.exports = mongoose.model("Resource", resourceSchema);
```
