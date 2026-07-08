const { specs } = require("../../src/config/setupSwagger");

const jsonBody = (path, method) =>
  specs.paths[path][method].requestBody.content["application/json"];

describe("Leave request Swagger documentation", () => {
  test("generates a valid OpenAPI spec with leave request paths", () => {
    expect(specs.openapi).toBe("3.0.0");
    expect(specs.paths["/leave-requests"].post).toBeDefined();
    expect(specs.paths["/leave-requests/emergency"].post).toBeDefined();
    expect(specs.paths["/leave-requests/{id}/approve"].post).toBeDefined();
  });

  test("documents Vietnam timezone and UTC examples for personal leave creation", () => {
    const body = jsonBody("/leave-requests", "post");
    const { schema, examples } = body;

    expect(schema.properties).not.toHaveProperty("leaveType");
    expect(schema.properties.startDate.example).toBe("2026-07-10T08:00:00+07:00");
    expect(schema.properties.endDate.example).toBe("2026-07-10T17:00:00+07:00");
    expect(examples.vietnamTimezone.value.startDate).toBe("2026-07-10T08:00:00+07:00");
    expect(examples.utcEquivalent.value.startDate).toBe("2026-07-10T01:00:00.000Z");
  });

  test("documents Vietnam timezone and UTC examples for emergency leave creation", () => {
    const body = jsonBody("/leave-requests/emergency", "post");
    const { schema, examples } = body;

    expect(schema.properties).not.toHaveProperty("leaveType");
    expect(schema.properties.startDate.example).toBe("2026-07-10T08:00:00+07:00");
    expect(schema.properties.endDate.example).toBe("2026-07-10T17:00:00+07:00");
    expect(examples.vietnamTimezone.value.startDate).toBe("2026-07-10T08:00:00+07:00");
    expect(examples.utcEquivalent.value.startDate).toBe("2026-07-10T01:00:00.000Z");
  });

  test("documents paid and unpaid leave days for approving a leave request", () => {
    const { schema } = jsonBody("/leave-requests/{id}/approve", "post");

    expect(schema.required).toEqual(
      expect.arrayContaining(["paidLeaveDays", "unpaidLeaveDays"]),
    );
    expect(schema.properties.paidLeaveDays).toMatchObject({
      type: "number",
      minimum: 0,
    });
    expect(schema.properties.unpaidLeaveDays).toMatchObject({
      type: "number",
      minimum: 0,
    });
  });
});
