# Frontend Integration Guide

This guide covers how the frontend should integrate with the Placement Decode API.

## Base URLs

Use environment variables on the frontend:

```env
VITE_API_BASE_URL=http://localhost:5000
# or
NEXT_PUBLIC_API_BASE_URL=http://localhost:5000
```

For Vercel deployment, set the value to the deployed backend URL:

```env
VITE_API_BASE_URL=https://your-server.vercel.app
NEXT_PUBLIC_API_BASE_URL=https://your-server.vercel.app
```

API docs are available at:

```txt
GET /api-docs
GET /openapi.json
```

Health checks:

```txt
GET /health
GET /api/health
```

## Auth Model

The API uses JWT bearer auth.

After login, store the returned `token` and send it on protected requests:

```http
Authorization: Bearer <token>
```

Recommended frontend storage:

- For quick development: `localStorage`
- For production: prefer an httpOnly cookie proxy/session layer if available

Login:

```http
POST /api/auth/login
```

Request:

```json
{
  "email": "superadmin@example.com",
  "password": "ChangeMe123!"
}
```

Response:

```json
{
  "token": "jwt-token",
  "user": {
    "id": "userId",
    "name": "Platform Super Admin",
    "email": "superadmin@example.com",
    "role": "superadmin",
    "permissions": ["features:manage", "organizations:review"],
    "organization": null,
    "mustChangePassword": false,
    "status": "active"
  }
}
```

Current user:

```http
GET /api/auth/me
```

## Shared Fetch Helper

```ts
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = localStorage.getItem("accessToken");

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.message || "Request failed");
  }

  return data as T;
}
```

## Roles And Access

Supported roles:

```txt
superadmin
admin
teacher
student
```

Frontend route visibility should be based on `user.role` and `user.permissions`.

Suggested dashboards:

- `superadmin`: registration queue, accepted organizations, features, roles, users
- `admin`: own organization, roles, teachers, students, users
- `teacher`: teacher workspace, student read views
- `student`: student profile/workspace

Role endpoints:

```txt
GET   /api/roles
GET   /api/roles/definitions
GET   /api/roles/permissions
POST  /api/roles/organizations/:organizationId/sync
PATCH /api/roles/:roleId
```

## Organization Registration Flow

This is public. No token required.

```http
POST /api/org-registrations
```

Request:

```json
{
  "id": "ORG-001",
  "orgName": "Decode Institute",
  "orgEmail": "admin@decode.edu",
  "address": "Sector 21, New Delhi",
  "phoneNumber": "+919876543210",
  "requestedFeatures": ["featureId1", "featureId2"]
}
```

`requestedFeatures` can contain feature `_id`s from `GET /api/features` or stable feature keys such as:

```json
["student-workspace", "assessments", "analytics"]
```

Response:

```json
{
  "message": "Organization registration submitted for superadmin review",
  "registration": {
    "_id": "registrationId",
    "externalId": "ORG-001",
    "orgName": "Decode Institute",
    "orgEmail": "admin@decode.edu",
    "status": "pending"
  }
}
```

Frontend screens:

- Public organization signup form
- Success page after submission
- Optional feature checklist fetched from `GET /api/features`

## Superadmin Registration Review

Protected. Requires `superadmin`.

List queue:

```http
GET /api/org-registrations?status=pending
```

Get detail:

```http
GET /api/org-registrations/:registrationId
```

Approve:

```http
POST /api/org-registrations/:registrationId/approve
```

Request:

```json
{
  "features": ["featureId1", "featureId2"],
  "adminName": "Decode Admin",
  "discussionNotes": "Approved after discussion."
}
```

`features` can also contain feature keys, using the same format as public registration.

Approval creates:

- Accepted organization
- Organization roles: `admin`, `teacher`, `student`
- Organization admin user
- Temporary admin credentials by email or server log if SMTP is not configured

Reject:

```http
POST /api/org-registrations/:registrationId/reject
```

Request:

```json
{
  "discussionNotes": "Rejected due to incomplete details."
}
```

## Features

Public list:

```http
GET /api/features
```

Superadmin create:

```http
POST /api/features
```

Request:

```json
{
  "key": "attendance",
  "name": "Attendance",
  "description": "Track attendance.",
  "enabledByDefault": false
}
```

Superadmin update:

```http
PATCH /api/features/:featureId
```

Request:

```json
{
  "name": "Attendance",
  "description": "Track attendance.",
  "enabledByDefault": true,
  "isActive": true
}
```

## Accepted Organizations

Protected. Requires `superadmin` or `admin`.

List:

```http
GET /api/organizations
```

Get one:

```http
GET /api/organizations/:organizationId
```

Behavior:

- `superadmin` can see all organizations
- `admin` can see only their own organization

## Users

Protected. Requires `superadmin` or `admin`.

List:

```http
GET /api/users
GET /api/users?organization=:organizationId
```

Create:

```http
POST /api/users
```

Request:

```json
{
  "organization": "organizationId",
  "name": "Asha Teacher",
  "email": "asha@decode.edu",
  "phoneNumber": "+919876543210",
  "roleName": "teacher",
  "password": "TempPass123!"
}
```

Notes:

- `organization` is required when `superadmin` creates a user
- `admin` users are automatically scoped to their own organization
- `roleName` must be `admin`, `teacher`, or `student`
- If `password` is omitted, API returns `temporaryPassword`

Response without provided password:

```json
{
  "message": "teacher created",
  "user": {
    "id": "userId",
    "organization": "organizationId",
    "name": "Asha Teacher",
    "email": "asha@decode.edu",
    "role": "teacher",
    "mustChangePassword": true
  },
  "temporaryPassword": "generated-password"
}
```

## Error Handling

Errors return JSON:

```json
{
  "message": "You do not have permission for this action"
}
```

Common status codes:

```txt
400 Bad request or missing fields
401 Missing/invalid/expired token
403 Role does not have access
404 Resource not found
409 Invalid state, such as approving a non-pending registration
500 Server error
```

Frontend should:

- Redirect to login on `401`
- Show an access-denied state on `403`
- Show inline form errors for `400`
- Refresh list/detail data after approve, reject, create, or update actions

## Suggested Frontend Routes

```txt
/login
/register-organization
/superadmin/registrations
/superadmin/registrations/:registrationId
/superadmin/organizations
/superadmin/features
/superadmin/roles
/admin/organization
/admin/users
/admin/teachers
/admin/students
/teacher
/student
```

## Minimal TypeScript Types

```ts
export type RoleName = "superadmin" | "admin" | "teacher" | "student";

export type User = {
  id: string;
  name: string;
  email: string;
  phoneNumber?: string;
  role: RoleName;
  permissions?: string[];
  organization?: string | null;
  mustChangePassword: boolean;
  status: "active" | "inactive";
};

export type Feature = {
  _id: string;
  key: string;
  name: string;
  description: string;
  enabledByDefault: boolean;
  isActive: boolean;
};

export type RegisterOrg = {
  _id: string;
  externalId?: string;
  orgName: string;
  orgEmail: string;
  address: string;
  phoneNumber: string;
  requestedFeatures: string[] | Feature[];
  status: "pending" | "accepted" | "rejected";
  discussionNotes?: string;
};

export type AcceptedOrganization = {
  _id: string;
  registrationRequest: string;
  orgName: string;
  orgEmail: string;
  address: string;
  phoneNumber: string;
  features: string[] | Feature[];
  adminUser?: string | User | null;
  status: "active" | "suspended";
};
```

## Handoff Checklist

- Configure frontend API base URL
- Implement login and token handling
- Add route guards by `role` and `permissions`
- Build public organization registration form
- Build superadmin registration queue and approval screen
- Build feature management for superadmin
- Build organization/user management for admins
- Use `/api-docs` or `/openapi.json` as source of truth when endpoints change
