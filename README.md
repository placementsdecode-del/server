# server

Express + MongoDB API for organization onboarding, approval, features, and RBAC users.

## Setup

```bash
cp .env.example .env
npm install
npm run seed
npm run dev
```

## API Docs

- Swagger UI: `http://localhost:5000/api-docs`
- Raw OpenAPI JSON: `http://localhost:5000/openapi.json`
- Health checks: `http://localhost:5000/health` and `http://localhost:5000/api/health`

## Flow

1. Organization submits registration with `id`, `orgName`, `orgEmail`, `address`, `phoneNumber`, and optional `requestedFeatures`.
2. Superadmin lists pending registrations and discusses required features.
3. Superadmin approves the organization with selected features.
4. The registration becomes an accepted organization.
5. The accepted organization gets an admin user and temporary credentials by email.
6. Organization admin creates teachers, students, and extra admins under RBAC.
7. Roles can be listed and permissions can be adjusted per accepted organization.

## Main Endpoints

- `POST /api/org-registrations` public registration request.
- `GET /api/org-registrations` superadmin registration queue.
- `POST /api/org-registrations/:registrationId/approve` superadmin approval.
- `POST /api/org-registrations/:registrationId/reject` superadmin rejection.
- `GET /api/features` list active features.
- `POST /api/features` superadmin create feature.
- `POST /api/auth/login` login.
- `GET /api/organizations` superadmin/admin organization view.
- `GET /api/roles` list platform or organization roles.
- `GET /api/roles/permissions` list allowed RBAC permissions.
- `PATCH /api/roles/:roleId` update editable role permissions.
- `POST /api/users` superadmin/admin create admin, teacher, or student.
