const allRoles = {
  user: [
    'getProjects',
    'getActivities',
    'updateActivity',
  ],
  manager: [
    'getProjects',   'manageProjects',
    'getActivities', 'manageActivities', 'updateActivity',
    'getUsers',
    'getSectors',    'getRegions', 'getImplementers',
  ],
  admin: [
    'getUsers',        'manageUsers',
    'getProjects',     'manageProjects',
    'getActivities',   'manageActivities', 'updateActivity',
    'getSectors',      'manageSectors',
    'getRegions',      'manageRegions',
    'getImplementers', 'manageImplementers',
  ],
};

const roles = Object.keys(allRoles);
const roleRights = new Map(Object.entries(allRoles));

module.exports = { roles, roleRights };
