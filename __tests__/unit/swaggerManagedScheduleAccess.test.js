const { specs } = require("../../src/config/setupSwagger");

describe("Managed schedule authorization Swagger documentation", () => {
  test("documents temporary STAFF access for supplier endpoints", () => {
    expect(specs.paths["/suppliers"].get.description).toContain(
      "managedBy an active SCHEDULED working schedule",
    );
    expect(specs.paths["/suppliers"].get.responses["403"]).toBeDefined();
    expect(specs.paths["/suppliers/{id}"].patch.responses["403"]).toBeDefined();
    expect(
      specs.paths["/suppliers/{id}/payments"].post.responses["403"],
    ).toBeDefined();
    expect(
      specs.paths["/suppliers/{id}/payments"].post.description,
    ).toContain("is not granted to managedBy STAFF");
  });

  test("documents scheduled branch scope for cash drawers", () => {
    expect(specs.paths["/cash-drawer-sessions"].post.description).toContain(
      "managedBy an active SCHEDULED working schedule",
    );
    expect(
      specs.paths["/cash-drawer-sessions/{id}/finalize"].post.description,
    ).toContain("active managed schedule");
  });

  test("documents all four stock movement types and temporary scope", () => {
    const createOperation = specs.paths["/stock-movements"].post;
    const movementType =
      createOperation.requestBody.content["application/json"].schema.properties
        .movementType;

    expect(movementType.enum).toEqual([
      "IMPORT",
      "EXPORT",
      "RETURN",
      "ADJUST",
    ]);
    expect(movementType.enum).not.toContain("TRANSFER");
    expect(createOperation.description).toContain(
      "startAt <= now < endAt",
    );
    expect(createOperation.responses["403"]).toBeDefined();
    expect(
      specs.paths["/stock-movements/{id}/receive"].patch.responses["403"],
    ).toBeDefined();
  });
});
