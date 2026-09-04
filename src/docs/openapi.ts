const openApiSpec: any = {
  openapi: "3.0.3",
  info: {
    title: "Placement Decode API",
    version: "1.0.0",
    description:
      "Organization onboarding, superadmin approval, accepted organizations, features, roles, users, and authentication.",
  },
  servers: [
    {
      url: "http://localhost:5000",
      description: "Local development",
    },
  ],
  tags: [
    { name: "Health" },
    { name: "Auth" },
    { name: "Features" },
    { name: "Organization Registrations" },
    { name: "Organizations" },
    { name: "Roles" },
    { name: "Users" },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
      },
    },
    schemas: {
      Error: {
        type: "object",
        properties: {
          message: { type: "string", example: "Validation failed" },
          stack: { type: "string" },
        },
      },
      Feature: {
        type: "object",
        properties: {
          _id: { type: "string", example: "66b4f25b6d6fa9f03f73e001" },
          key: { type: "string", example: "student-management" },
          name: { type: "string", example: "Student Management" },
          description: { type: "string", example: "Create and manage student accounts." },
          enabledByDefault: { type: "boolean", example: true },
          isActive: { type: "boolean", example: true },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      Role: {
        type: "object",
        properties: {
          _id: { type: "string", example: "66b4f25b6d6fa9f03f73e002" },
          name: {
            type: "string",
            enum: ["superadmin", "admin", "teacher", "student"],
            example: "admin",
          },
          displayName: { type: "string", example: "Organization Admin" },
          description: { type: "string", example: "Organization-level admin." },
          organization: {
            type: "string",
            nullable: true,
            example: "66b4f25b6d6fa9f03f73e003",
          },
          permissions: {
            type: "array",
            items: { type: "string" },
            example: ["organization:read", "users:manage"],
          },
          isSystem: { type: "boolean", example: false },
          isEditable: { type: "boolean", example: true },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      User: {
        type: "object",
        properties: {
          id: { type: "string", example: "66b4f25b6d6fa9f03f73e004" },
          _id: { type: "string", example: "66b4f25b6d6fa9f03f73e004" },
          organization: {
            oneOf: [{ type: "string" }, { type: "object" }],
            nullable: true,
          },
          name: { type: "string", example: "Jane Admin" },
          email: { type: "string", format: "email", example: "admin@example.com" },
          phoneNumber: { type: "string", example: "+919876543210" },
          registrationNumber: { type: "string", example: "STU-2027-001" },
          department: { type: "string", example: "Computer Science" },
          batch: { type: "string", example: "2027" },
          section: {
            oneOf: [{ type: "string" }, { type: "object" }],
            nullable: true,
          },
          groups: {
            type: "array",
            items: { type: "string" },
            example: ["Coding Group"],
          },
          preparationScore: { type: "number", example: 72 },
          role: {
            oneOf: [{ type: "string" }, { $ref: "#/components/schemas/Role" }],
          },
          roleName: {
            type: "string",
            enum: ["superadmin", "admin", "teacher", "student"],
            example: "admin",
          },
          permissions: {
            type: "array",
            items: { type: "string" },
          },
          mustChangePassword: { type: "boolean", example: true },
          status: { type: "string", enum: ["active", "inactive"], example: "active" },
        },
      },
      RegisterOrg: {
        type: "object",
        properties: {
          _id: { type: "string", example: "66b4f25b6d6fa9f03f73e005" },
          externalId: { type: "string", example: "ORG-001" },
          orgName: { type: "string", example: "Decode Institute" },
          orgEmail: { type: "string", format: "email", example: "admin@decode.edu" },
          address: { type: "string", example: "Sector 21, New Delhi" },
          location: { $ref: "#/components/schemas/Location" },
          phoneNumber: { type: "string", example: "+919876543210" },
          requestedFeatures: {
            type: "array",
            items: {
              oneOf: [{ type: "string" }, { $ref: "#/components/schemas/Feature" }],
            },
          },
          status: {
            type: "string",
            enum: ["pending", "accepted", "rejected"],
            example: "pending",
          },
          discussionNotes: { type: "string" },
          reviewedBy: {
            oneOf: [{ type: "string" }, { type: "object" }],
            nullable: true,
          },
          reviewedAt: {
            type: "string",
            format: "date-time",
            nullable: true,
          },
          acceptedOrganization: {
            oneOf: [{ type: "string" }, { type: "object" }],
            nullable: true,
          },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      AcceptedOrganization: {
        type: "object",
        properties: {
          _id: { type: "string", example: "66b4f25b6d6fa9f03f73e003" },
          registrationRequest: { type: "string", example: "66b4f25b6d6fa9f03f73e005" },
          orgName: { type: "string", example: "Decode Institute" },
          orgEmail: { type: "string", format: "email", example: "admin@decode.edu" },
          address: { type: "string", example: "Sector 21, New Delhi" },
          location: { $ref: "#/components/schemas/Location" },
          phoneNumber: { type: "string", example: "+919876543210" },
          features: {
            type: "array",
            items: {
              oneOf: [{ type: "string" }, { $ref: "#/components/schemas/Feature" }],
            },
          },
          adminUser: {
            oneOf: [{ type: "string" }, { $ref: "#/components/schemas/User" }],
            nullable: true,
          },
          status: { type: "string", enum: ["active", "suspended"], example: "active" },
          credentialsSentAt: {
            type: "string",
            format: "date-time",
            nullable: true,
          },
          acceptedBy: { type: "string", example: "66b4f25b6d6fa9f03f73e004" },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
    },
    responses: {
      Unauthorized: {
        description: "Missing or invalid authentication token",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/Error" },
          },
        },
      },
      Forbidden: {
        description: "Authenticated user does not have permission",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/Error" },
          },
        },
      },
      NotFound: {
        description: "Resource not found",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/Error" },
          },
        },
      },
    },
  },
  paths: {
    "/health": {
      get: {
        tags: ["Health"],
        summary: "Health check",
        responses: {
          200: {
            description: "API is running",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    status: { type: "string", example: "ok" },
                    service: { type: "string", example: "placement-decode-api" },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/health": {
      get: {
        tags: ["Health"],
        summary: "API health check",
        responses: {
          200: {
            description: "API is running",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    status: { type: "string", example: "ok" },
                    service: { type: "string", example: "placement-decode-api" },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/auth/login": {
      post: {
        tags: ["Auth"],
        summary: "Login and receive JWT token",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "password"],
                properties: {
                  email: { type: "string", format: "email", example: "superadmin@example.com" },
                  password: { type: "string", example: "ChangeMe123!" },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "Login successful",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    token: { type: "string" },
                    user: { $ref: "#/components/schemas/User" },
                  },
                },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },
    "/api/auth/me": {
      get: {
        tags: ["Auth"],
        summary: "Get current logged-in user",
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: "Current user",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    user: { $ref: "#/components/schemas/User" },
                  },
                },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },
    "/api/features": {
      get: {
        tags: ["Features"],
        summary: "List features",
        description: "Public users receive only active features. Superadmin receives all features.",
        responses: {
          200: {
            description: "Feature list",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    features: {
                      type: "array",
                      items: { $ref: "#/components/schemas/Feature" },
                    },
                  },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ["Features"],
        summary: "Create feature",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["key", "name"],
                properties: {
                  key: { type: "string", example: "attendance" },
                  name: { type: "string", example: "Attendance" },
                  description: { type: "string", example: "Track attendance." },
                  enabledByDefault: { type: "boolean", example: false },
                },
              },
            },
          },
        },
        responses: {
          201: {
            description: "Feature created",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    feature: { $ref: "#/components/schemas/Feature" },
                  },
                },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
        },
      },
    },
    "/api/features/{featureId}": {
      patch: {
        tags: ["Features"],
        summary: "Update feature",
        security: [{ bearerAuth: [] }],
        parameters: [{ $ref: "#/components/parameters/FeatureId" }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  key: { type: "string", example: "attendance" },
                  name: { type: "string", example: "Attendance" },
                  description: { type: "string", example: "Track attendance." },
                  enabledByDefault: { type: "boolean", example: true },
                  isActive: { type: "boolean", example: true },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "Feature updated",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    feature: { $ref: "#/components/schemas/Feature" },
                  },
                },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
          404: { $ref: "#/components/responses/NotFound" },
        },
      },
    },
    "/api/org-registrations": {
      post: {
        tags: ["Organization Registrations"],
        summary: "Submit organization registration",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["orgName", "orgEmail", "address", "phoneNumber"],
                properties: {
                  externalId: { type: "string", example: "ORG-001" },
                  orgName: { type: "string", example: "Decode Institute" },
                  orgEmail: { type: "string", format: "email", example: "admin@decode.edu" },
                  address: { type: "string", example: "Sector 21, New Delhi" },
                  location: {
                    type: "object",
                    properties: {
                      country: { type: "string", example: "India" },
                      state: { type: "string", example: "Delhi" },
                      city: { type: "string", example: "New Delhi" },
                      postalCode: { type: "string", example: "110001" },
                    },
                  },
                  phoneNumber: { type: "string", example: "+919876543210" },
                  requestedFeatures: {
                    type: "array",
                    items: { type: "string" },
                    description: "Feature ObjectIds or feature keys.",
                    example: ["student-workspace", "assessments", "analytics"],
                  },
                },
              },
            },
          },
        },
        responses: {
          201: {
            description: "Registration submitted",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    message: { type: "string" },
                    registration: { $ref: "#/components/schemas/RegisterOrg" },
                  },
                },
              },
            },
          },
        },
      },
      get: {
        tags: ["Organization Registrations"],
        summary: "List organization registrations",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "status",
            in: "query",
            schema: {
              type: "string",
              enum: ["pending", "accepted", "rejected"],
            },
          },
        ],
        responses: {
          200: {
            description: "Registration list",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    registrations: {
                      type: "array",
                      items: { $ref: "#/components/schemas/RegisterOrg" },
                    },
                  },
                },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
        },
      },
    },
    "/api/org-registrations/{registrationId}": {
      get: {
        tags: ["Organization Registrations"],
        summary: "Get registration by ID",
        security: [{ bearerAuth: [] }],
        parameters: [{ $ref: "#/components/parameters/RegistrationId" }],
        responses: {
          200: {
            description: "Registration detail",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    registration: { $ref: "#/components/schemas/RegisterOrg" },
                  },
                },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
          404: { $ref: "#/components/responses/NotFound" },
        },
      },
    },
    "/api/org-registrations/{registrationId}/approve": {
      post: {
        tags: ["Organization Registrations"],
        summary: "Approve organization registration",
        security: [{ bearerAuth: [] }],
        parameters: [{ $ref: "#/components/parameters/RegistrationId" }],
        requestBody: {
          required: false,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  features: {
                    type: "array",
                    items: { type: "string" },
                    description: "Feature ObjectIds or feature keys.",
                    example: ["student-workspace", "assessments", "analytics"],
                  },
                  adminName: { type: "string", example: "Decode Admin" },
                  discussionNotes: { type: "string", example: "Approved after feature discussion." },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "Organization approved",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    message: { type: "string" },
                    registration: { $ref: "#/components/schemas/RegisterOrg" },
                    organization: { $ref: "#/components/schemas/AcceptedOrganization" },
                    admin: { $ref: "#/components/schemas/User" },
                  },
                },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
          404: { $ref: "#/components/responses/NotFound" },
        },
      },
    },
    "/api/org-registrations/{registrationId}/reject": {
      post: {
        tags: ["Organization Registrations"],
        summary: "Reject organization registration",
        security: [{ bearerAuth: [] }],
        parameters: [{ $ref: "#/components/parameters/RegistrationId" }],
        requestBody: {
          required: false,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  discussionNotes: { type: "string", example: "Rejected due to incomplete details." },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "Registration rejected",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    message: { type: "string" },
                    registration: { $ref: "#/components/schemas/RegisterOrg" },
                  },
                },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
          404: { $ref: "#/components/responses/NotFound" },
        },
      },
    },
    "/api/organizations": {
      get: {
        tags: ["Organizations"],
        summary: "List accepted organizations",
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: "Organization list",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    organizations: {
                      type: "array",
                      items: { $ref: "#/components/schemas/AcceptedOrganization" },
                    },
                  },
                },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
        },
      },
    },
    "/api/organizations/{organizationId}": {
      get: {
        tags: ["Organizations"],
        summary: "Get accepted organization by ID",
        security: [{ bearerAuth: [] }],
        parameters: [{ $ref: "#/components/parameters/OrganizationId" }],
        responses: {
          200: {
            description: "Organization detail",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    organization: { $ref: "#/components/schemas/AcceptedOrganization" },
                  },
                },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
          404: { $ref: "#/components/responses/NotFound" },
        },
      },
    },
    "/api/roles": {
      get: {
        tags: ["Roles"],
        summary: "List roles",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "organization",
            in: "query",
            description: "Superadmin can filter roles by organization ID.",
            schema: { type: "string" },
          },
        ],
        responses: {
          200: {
            description: "Role list",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    roles: {
                      type: "array",
                      items: { $ref: "#/components/schemas/Role" },
                    },
                  },
                },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
        },
      },
    },
    "/api/roles/definitions": {
      get: {
        tags: ["Roles"],
        summary: "List default role definitions",
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: "Default role definitions",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  additionalProperties: { type: "object" },
                },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
        },
      },
    },
    "/api/roles/permissions": {
      get: {
        tags: ["Roles"],
        summary: "List allowed RBAC permissions",
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: "Permission list",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    permissions: {
                      type: "array",
                      items: { type: "string" },
                    },
                  },
                },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
        },
      },
    },
    "/api/roles/organizations/{organizationId}/sync": {
      post: {
        tags: ["Roles"],
        summary: "Ensure default roles exist for an organization",
        security: [{ bearerAuth: [] }],
        parameters: [{ $ref: "#/components/parameters/OrganizationId" }],
        responses: {
          200: {
            description: "Organization roles synced",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    message: { type: "string" },
                    roles: {
                      type: "object",
                      properties: {
                        admin: { $ref: "#/components/schemas/Role" },
                        teacher: { $ref: "#/components/schemas/Role" },
                        student: { $ref: "#/components/schemas/Role" },
                      },
                    },
                  },
                },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
        },
      },
    },
    "/api/roles/{roleId}": {
      patch: {
        tags: ["Roles"],
        summary: "Update editable role",
        security: [{ bearerAuth: [] }],
        parameters: [{ $ref: "#/components/parameters/RoleId" }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  displayName: { type: "string", example: "Placement Teacher" },
                  description: { type: "string", example: "Teacher focused on placement activities." },
                  permissions: {
                    type: "array",
                    items: { type: "string" },
                    example: ["organization:read", "students:read", "profile:read"],
                  },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "Role updated",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    message: { type: "string" },
                    role: { $ref: "#/components/schemas/Role" },
                  },
                },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
          404: { $ref: "#/components/responses/NotFound" },
        },
      },
    },
    "/api/users": {
      get: {
        tags: ["Users"],
        summary: "List users",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "organization",
            in: "query",
            description: "Superadmin can filter users by organization ID.",
            schema: { type: "string" },
          },
        ],
        responses: {
          200: {
            description: "User list",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    users: {
                      type: "array",
                      items: { $ref: "#/components/schemas/User" },
                    },
                  },
                },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
        },
      },
      post: {
        tags: ["Users"],
        summary: "Create organization user",
        description: "Create an admin, teacher, or student user for an accepted organization.",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["name", "email", "roleName"],
                properties: {
                  organization: {
                    type: "string",
                    description: "Required when superadmin creates the user.",
                    example: "66b4f25b6d6fa9f03f73e003",
                  },
                  name: { type: "string", example: "Asha Teacher" },
                  email: { type: "string", format: "email", example: "asha@decode.edu" },
                  phoneNumber: { type: "string", example: "+919876543210" },
                  roleName: {
                    type: "string",
                    enum: ["admin", "teacher", "student"],
                    example: "teacher",
                  },
                  password: {
                    type: "string",
                    description: "Optional. If omitted, a temporary password is generated.",
                    example: "TempPass123!",
                  },
                },
              },
            },
          },
        },
        responses: {
          201: {
            description: "User created",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    message: { type: "string" },
                    user: { $ref: "#/components/schemas/User" },
                    temporaryPassword: { type: "string" },
                  },
                },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
        },
      },
    },
  },
};

openApiSpec.components.parameters = {
  FeatureId: {
    name: "featureId",
    in: "path",
    required: true,
    schema: { type: "string" },
  },
  RegistrationId: {
    name: "registrationId",
    in: "path",
    required: true,
    schema: { type: "string" },
  },
  OrganizationId: {
    name: "organizationId",
    in: "path",
    required: true,
    schema: { type: "string" },
  },
  RoleId: {
    name: "roleId",
    in: "path",
    required: true,
    schema: { type: "string" },
  },
  SectionId: {
    name: "sectionId",
    in: "path",
    required: true,
    schema: { type: "string" },
  },
  StudentId: {
    name: "studentId",
    in: "path",
    required: true,
    schema: { type: "string" },
  },
  UserId: {
    name: "userId",
    in: "path",
    required: true,
    schema: { type: "string" },
  },
  AssessmentId: {
    name: "assessmentId",
    in: "path",
    required: true,
    schema: { type: "string" },
  },
};

openApiSpec.tags.push({ name: "Sections" }, { name: "Assessments" });

Object.assign(openApiSpec.components.schemas, {
  Location: {
    type: "object",
    properties: {
      country: { type: "string", example: "India" },
      state: { type: "string", example: "Karnataka" },
      city: { type: "string", example: "Bengaluru" },
      postalCode: { type: "string", example: "560001" },
    },
  },
  Section: {
    type: "object",
    properties: {
      _id: { type: "string", example: "66b4f25b6d6fa9f03f73e010" },
      organization: { oneOf: [{ type: "string" }, { $ref: "#/components/schemas/AcceptedOrganization" }] },
      name: { type: "string", example: "CSE Section A" },
      code: { type: "string", example: "CSE-A-2027" },
      department: { type: "string", example: "Computer Science" },
      batch: { type: "string", example: "2027" },
      academicYear: { type: "string", example: "2026-2027" },
      assignedTeachers: {
        type: "array",
        items: { $ref: "#/components/schemas/User" },
      },
      status: { type: "string", enum: ["active", "inactive"], example: "active" },
      description: { type: "string", example: "Placement preparation section." },
      createdAt: { type: "string", format: "date-time" },
      updatedAt: { type: "string", format: "date-time" },
    },
  },
  AssessmentQuestion: {
    type: "object",
    required: ["type", "text", "marks"],
    properties: {
      _id: { type: "string", example: "66b4f25b6d6fa9f03f73e020" },
      type: {
        type: "string",
        enum: ["single-choice", "multiple-choice", "true-false", "short-answer", "long-answer", "coding", "file-upload", "numerical"],
        example: "single-choice",
      },
      text: { type: "string", example: "Which data structure is used for balanced parentheses?" },
      options: {
        type: "array",
        items: { type: "string" },
        example: ["Queue", "Stack", "Tree", "Graph"],
      },
      correctAnswer: { oneOf: [{ type: "string" }, { type: "array", items: { type: "string" } }, { type: "boolean" }, { type: "number" }], example: "Stack" },
      explanation: { type: "string", example: "A stack tracks the most recent unmatched opening bracket." },
      marks: { type: "number", example: 5 },
      negativeMarks: { type: "number", example: 0 },
    },
  },
  Assessment: {
    type: "object",
    properties: {
      _id: { type: "string", example: "66b4f25b6d6fa9f03f73e030" },
      organization: { oneOf: [{ type: "string" }, { $ref: "#/components/schemas/AcceptedOrganization" }] },
      title: { type: "string", example: "Aptitude Practice Test" },
      description: { type: "string", example: "Section-level aptitude assessment." },
      category: { type: "string", example: "Aptitude" },
      difficulty: { type: "string", enum: ["beginner", "intermediate", "advanced"], example: "intermediate" },
      instructions: { type: "string", example: "Answer all questions before submitting." },
      durationMinutes: { type: "number", example: 30 },
      totalMarks: { type: "number", example: 10 },
      passingMarks: { type: "number", example: 4 },
      attemptsAllowed: { type: "number", example: 1 },
      negativeMarking: { type: "boolean", example: false },
      shuffleQuestions: { type: "boolean", example: false },
      shuffleOptions: { type: "boolean", example: false },
      showResultImmediately: { type: "boolean", example: true },
      allowAnswerReview: { type: "boolean", example: true },
      assignedSections: {
        type: "array",
        items: { $ref: "#/components/schemas/Section" },
      },
      assignedTeachers: {
        type: "array",
        items: { $ref: "#/components/schemas/User" },
      },
      questions: {
        type: "array",
        items: { $ref: "#/components/schemas/AssessmentQuestion" },
      },
      status: { type: "string", enum: ["draft", "scheduled", "active", "completed", "archived"], example: "draft" },
      createdAt: { type: "string", format: "date-time" },
      updatedAt: { type: "string", format: "date-time" },
    },
  },
});

Object.assign(openApiSpec.paths, {
  "/api/auth/password": {
    patch: {
      tags: ["Auth"],
      summary: "Change current user's password",
      security: [{ bearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["currentPassword", "newPassword"],
              properties: {
                currentPassword: { type: "string", example: "admin@123" },
                newPassword: { type: "string", minLength: 8, example: "NewPassword123!" },
              },
            },
          },
        },
      },
      responses: {
        200: {
          description: "Password changed",
          content: { "application/json": { schema: { type: "object", properties: { message: { type: "string" } } } } },
        },
        401: { $ref: "#/components/responses/Unauthorized" },
      },
    },
  },
  "/api/organizations/{organizationId}": {
    ...openApiSpec.paths["/api/organizations/{organizationId}"],
    patch: {
      tags: ["Organizations"],
      summary: "Update accepted organization",
      security: [{ bearerAuth: [] }],
      parameters: [{ $ref: "#/components/parameters/OrganizationId" }],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                orgName: { type: "string", example: "Decode Institute" },
                orgEmail: { type: "string", format: "email", example: "admin@decode.edu" },
                address: { type: "string", example: "Sector 21, New Delhi" },
                location: { $ref: "#/components/schemas/Location" },
                phoneNumber: { type: "string", example: "+919876543210" },
                status: { type: "string", enum: ["active", "suspended"], example: "active" },
                features: { type: "array", items: { type: "string" } },
              },
            },
          },
        },
      },
      responses: {
        200: {
          description: "Organization updated",
          content: { "application/json": { schema: { type: "object", properties: { message: { type: "string" }, organization: { $ref: "#/components/schemas/AcceptedOrganization" } } } } },
        },
        401: { $ref: "#/components/responses/Unauthorized" },
        403: { $ref: "#/components/responses/Forbidden" },
        404: { $ref: "#/components/responses/NotFound" },
      },
    },
  },
  "/api/users/{userId}": {
    patch: {
      tags: ["Users"],
      summary: "Update user details, role, status, or password",
      security: [{ bearerAuth: [] }],
      parameters: [{ $ref: "#/components/parameters/UserId" }],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                name: { type: "string", example: "Demo Student" },
                email: { type: "string", format: "email", example: "student@gmail.com" },
                phoneNumber: { type: "string", example: "+919900004444" },
                roleName: { type: "string", enum: ["admin", "teacher", "student"], example: "student" },
                status: { type: "string", enum: ["active", "inactive"], example: "active" },
                registrationNumber: { type: "string", example: "STU-2027-001" },
                department: { type: "string", example: "Computer Science" },
                batch: { type: "string", example: "2027" },
                section: { type: "string", example: "66b4f25b6d6fa9f03f73e010" },
                groups: { type: "array", items: { type: "string" }, example: ["Coding Group"] },
                preparationScore: { type: "number", example: 72 },
                password: { type: "string", example: "student@123" },
              },
            },
          },
        },
      },
      responses: {
        200: {
          description: "User updated",
          content: { "application/json": { schema: { type: "object", properties: { message: { type: "string" }, user: { $ref: "#/components/schemas/User" } } } } },
        },
        401: { $ref: "#/components/responses/Unauthorized" },
        403: { $ref: "#/components/responses/Forbidden" },
        404: { $ref: "#/components/responses/NotFound" },
      },
    },
  },
  "/api/sections": {
    get: {
      tags: ["Sections"],
      summary: "List sections",
      security: [{ bearerAuth: [] }],
      parameters: [{ name: "organization", in: "query", schema: { type: "string" } }],
      responses: {
        200: {
          description: "Section list",
          content: { "application/json": { schema: { type: "object", properties: { sections: { type: "array", items: { $ref: "#/components/schemas/Section" } } } } } },
        },
        401: { $ref: "#/components/responses/Unauthorized" },
        403: { $ref: "#/components/responses/Forbidden" },
      },
    },
    post: {
      tags: ["Sections"],
      summary: "Create section",
      security: [{ bearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["name", "code", "department", "batch", "academicYear"],
              properties: {
                organization: { type: "string", description: "Required for superadmin.", example: "66b4f25b6d6fa9f03f73e003" },
                name: { type: "string", example: "CSE Section A" },
                code: { type: "string", example: "CSE-A-2027" },
                department: { type: "string", example: "Computer Science" },
                batch: { type: "string", example: "2027" },
                academicYear: { type: "string", example: "2026-2027" },
                assignedTeachers: { type: "array", items: { type: "string" } },
                status: { type: "string", enum: ["active", "inactive"], example: "active" },
                description: { type: "string", example: "Placement preparation section." },
              },
            },
          },
        },
      },
      responses: {
        201: {
          description: "Section created",
          content: { "application/json": { schema: { type: "object", properties: { message: { type: "string" }, section: { $ref: "#/components/schemas/Section" } } } } },
        },
        401: { $ref: "#/components/responses/Unauthorized" },
        403: { $ref: "#/components/responses/Forbidden" },
      },
    },
  },
  "/api/sections/{sectionId}": {
    patch: {
      tags: ["Sections"],
      summary: "Update section or assigned teachers",
      security: [{ bearerAuth: [] }],
      parameters: [{ $ref: "#/components/parameters/SectionId" }],
      requestBody: {
        required: true,
        content: { "application/json": { schema: { $ref: "#/components/schemas/Section" } } },
      },
      responses: {
        200: {
          description: "Section updated",
          content: { "application/json": { schema: { type: "object", properties: { message: { type: "string" }, section: { $ref: "#/components/schemas/Section" } } } } },
        },
        401: { $ref: "#/components/responses/Unauthorized" },
        403: { $ref: "#/components/responses/Forbidden" },
        404: { $ref: "#/components/responses/NotFound" },
      },
    },
  },
  "/api/sections/{sectionId}/students/{studentId}": {
    post: {
      tags: ["Sections"],
      summary: "Assign student to section",
      security: [{ bearerAuth: [] }],
      parameters: [{ $ref: "#/components/parameters/SectionId" }, { $ref: "#/components/parameters/StudentId" }],
      responses: {
        200: {
          description: "Student assigned",
          content: { "application/json": { schema: { type: "object", properties: { message: { type: "string" }, student: { $ref: "#/components/schemas/User" } } } } },
        },
        401: { $ref: "#/components/responses/Unauthorized" },
        403: { $ref: "#/components/responses/Forbidden" },
        404: { $ref: "#/components/responses/NotFound" },
      },
    },
  },
  "/api/assessments": {
    get: {
      tags: ["Assessments"],
      summary: "List assessments",
      security: [{ bearerAuth: [] }],
      parameters: [{ name: "organization", in: "query", schema: { type: "string" } }],
      responses: {
        200: {
          description: "Assessment list",
          content: { "application/json": { schema: { type: "object", properties: { assessments: { type: "array", items: { $ref: "#/components/schemas/Assessment" } } } } } },
        },
        401: { $ref: "#/components/responses/Unauthorized" },
        403: { $ref: "#/components/responses/Forbidden" },
      },
    },
    post: {
      tags: ["Assessments"],
      summary: "Create assessment",
      security: [{ bearerAuth: [] }],
      requestBody: {
        required: true,
        content: { "application/json": { schema: { $ref: "#/components/schemas/Assessment" } } },
      },
      responses: {
        201: {
          description: "Assessment created",
          content: { "application/json": { schema: { type: "object", properties: { message: { type: "string" }, assessment: { $ref: "#/components/schemas/Assessment" } } } } },
        },
        400: { $ref: "#/components/responses/NotFound" },
        401: { $ref: "#/components/responses/Unauthorized" },
        403: { $ref: "#/components/responses/Forbidden" },
      },
    },
  },
  "/api/assessments/validate": {
    post: {
      tags: ["Assessments"],
      summary: "Validate assessment payload",
      security: [{ bearerAuth: [] }],
      requestBody: {
        required: true,
        content: { "application/json": { schema: { $ref: "#/components/schemas/Assessment" } } },
      },
      responses: {
        200: {
          description: "Validation result",
          content: { "application/json": { schema: { type: "object", properties: { valid: { type: "boolean" }, errors: { type: "array", items: { type: "string" } } } } } },
        },
        401: { $ref: "#/components/responses/Unauthorized" },
      },
    },
  },
  "/api/assessments/{assessmentId}": {
    patch: {
      tags: ["Assessments"],
      summary: "Update assessment",
      security: [{ bearerAuth: [] }],
      parameters: [{ $ref: "#/components/parameters/AssessmentId" }],
      requestBody: {
        required: true,
        content: { "application/json": { schema: { $ref: "#/components/schemas/Assessment" } } },
      },
      responses: {
        200: {
          description: "Assessment updated",
          content: { "application/json": { schema: { type: "object", properties: { message: { type: "string" }, assessment: { $ref: "#/components/schemas/Assessment" } } } } },
        },
        401: { $ref: "#/components/responses/Unauthorized" },
        403: { $ref: "#/components/responses/Forbidden" },
        404: { $ref: "#/components/responses/NotFound" },
      },
    },
  },
  "/api/assessments/{assessmentId}/validate": {
    post: {
      tags: ["Assessments"],
      summary: "Validate existing assessment",
      security: [{ bearerAuth: [] }],
      parameters: [{ $ref: "#/components/parameters/AssessmentId" }],
      responses: {
        200: {
          description: "Validation result",
          content: { "application/json": { schema: { type: "object", properties: { valid: { type: "boolean" }, errors: { type: "array", items: { type: "string" } } } } } },
        },
        401: { $ref: "#/components/responses/Unauthorized" },
        403: { $ref: "#/components/responses/Forbidden" },
        404: { $ref: "#/components/responses/NotFound" },
      },
    },
  },
});

export default openApiSpec;
