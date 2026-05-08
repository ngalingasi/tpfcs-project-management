const allRoles = {
  user: [
    'getProjects',
    'getActivities',
    'updateActivity',
    'getInventory',   // viewer — read only
  ],
  manager: [
    'getProjects',   'manageProjects',
    'getActivities', 'manageActivities', 'updateActivity',
    'getUsers',
    'getSectors',    'getRegions', 'getImplementers',
    'getInventory',  // project manager — view only
  ],
  admin: [
    'getUsers',        'manageUsers',
    'getProjects',     'manageProjects',
    'getActivities',   'manageActivities', 'updateActivity',
    'getSectors',      'manageSectors',
    'getRegions',      'manageRegions',
    'getImplementers', 'manageImplementers',
    'getInventory',    'manageInventory',   // full inventory access
  ],
};

const roles = Object.keys(allRoles);
const roleRights = new Map(Object.entries(allRoles));

module.exports = { roles, roleRights };
