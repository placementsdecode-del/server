const secured = { security: [{ bearerAuth: [] }] };
const id = (name: string) => [{ name, in: 'path', required: true, schema: { type: 'string' } }];
const body = (properties, required: string[]) => ({ required: true, content: { 'application/json': { schema: { type: 'object', properties, required } } } });
const string = { type: 'string' };
const students = { type: 'array', minItems: 1, maxItems: 500, items: string };
const responses = { 200: { description: 'Success' }, 400: { description: 'Invalid input' }, 401: { description: 'Authentication required' }, 403: { description: 'Access denied' }, 404: { description: 'Record not found' } };
const operation = (summary: string, tag: string, extra = {}) => ({ ...secured, tags: [tag], summary, responses, ...extra });
export const communityPaths = {
  '/api/community/section': { get: operation('Student: view own section and basic profiles of classmates', 'Student Community') },
  '/api/community/work': { get: operation('Student: published work from the audience snapshot; assessment answers excluded', 'Student Community') },
  '/api/community/notifications': { get: operation('Student: list own notifications and unread count; reconcile durable events without resetting read/deleted state', 'Notifications') },
  '/api/community/notifications/read-all': { patch: operation('Student: mark all existing notifications as read', 'Notifications') },
  '/api/community/notifications/{notificationId}': {
    patch: operation('Student: mark own notification read or unread', 'Notifications', { parameters: id('notificationId'), requestBody: body({ read: { type: 'boolean' } }, ['read']) }),
    delete: operation('Student: delete own notification without changing invitation consent', 'Notifications', { parameters: id('notificationId') }),
  },
  '/api/groups': {
    get: operation('List groups: accepted memberships for students, own groups for coordinators, organization groups for admins', 'Groups'),
    post: operation('Admin/coordinator: create group and pending in-app invitations', 'Groups', { requestBody: body({ name: { ...string, maxLength: 120 }, description: { ...string, maxLength: 2000 }, students }, ['name', 'students']), responses: { ...responses, 201: { description: 'Created; students have not joined until they accept' } } }),
  },
  '/api/groups/invitations': { get: operation('Student: pending invitations, including those whose notifications were deleted', 'Groups') },
  '/api/groups/{groupId}/invitations': { post: operation('Admin/group creator: invite additional eligible students; existing responses are preserved', 'Groups', { parameters: id('groupId'), requestBody: body({ students }, ['students']) }) },
  '/api/groups/{groupId}/invitations/me': { patch: operation('Student: atomically accept or decline own pending invitation', 'Groups', { parameters: id('groupId'), requestBody: body({ status: { type: 'string', enum: ['accepted', 'declined'] } }, ['status']), responses: { ...responses, 409: { description: 'Invitation no longer pending' } } }) },
  '/api/work': {
    get: operation('Admin/coordinator: list managed section work', 'Assigned Work'),
    post: operation('Admin/coordinator: save draft or publish work to active managed sections', 'Assigned Work', { requestBody: body({ title: { ...string, maxLength: 200 }, instructions: { ...string, maxLength: 10000 }, kind: { type: 'string', enum: ['task', 'homework', 'activity', 'announcement'] }, status: { type: 'string', enum: ['draft', 'published'] }, assignedSections: students }, ['title', 'instructions', 'kind', 'assignedSections']), responses: { ...responses, 201: { description: 'Created; only published work notifies students' } } }),
  },
  '/api/work/{workId}/publish': { post: operation('Admin/creator: publish once and snapshot active students in assigned sections', 'Assigned Work', { parameters: id('workId') }) },
};
