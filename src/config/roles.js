const allRoles = {
  user: [
    'getProjects',
    'getActivities',
    'updateActivity',
    'getInventory',    // viewer
    'getInspection',   // read only
  ],
  // Guests are external viewers: read-only (plus comments). Which projects they can see is enforced by
  // middlewares/guestGuard.js, which allows only an explicit list of routes. Budget/payment data is never sent.
  guest: [
    'getProjects',
    'getActivities',
  ],
  manager: [
    'getProjects',   'manageProjects',
    'getActivities', 'manageActivities', 'updateActivity',
    'getUsers',
    'getSectors',    'getRegions', 'getImplementers',
    'getInventory',   'manageInventory',
    'getInspection',  'manageInspection', // PM can create inspections
  ],
  admin: [
    'getUsers',        'manageUsers',
    'getProjects',     'manageProjects',
    'getActivities',   'manageActivities', 'updateActivity',
    'getSectors',      'manageSectors',
    'getRegions',      'manageRegions',
    'getImplementers', 'manageImplementers',
    'getInventory',    'manageInventory',
    'getInspection',  'manageInspection',   // full inspection access
  ],
};

const roles = Object.keys(allRoles);
const roleRights = new Map(Object.entries(allRoles));

module.exports = { roles, roleRights };
