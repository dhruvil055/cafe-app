export const effectiveRole = (role) => ({ admin: 'owner', staff: 'manager' }[role] || role);

export const canManageTeam = (role) => effectiveRole(role) === 'owner';

export const canManageMenu = (role) => ['owner', 'manager'].includes(effectiveRole(role));

export const canViewOrders = (role) => ['owner', 'manager', 'cashier', 'kitchen'].includes(effectiveRole(role));
