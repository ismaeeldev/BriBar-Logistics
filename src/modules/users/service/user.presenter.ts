/**
 * The shape the API returns for a user (SRS 12.1, 22.1).
 *
 * The password hash cannot reach this file — the repository's projection omits
 * it — but the DTO is written out field by field anyway. SRS 22.1 says "no
 * password or password hash returned by API responses", and spreading a row
 * would make that guarantee depend on a `select` clause several modules away
 * staying correct forever.
 */
import type { Role } from '@/modules/services/domain/service-status';
import type { UserWithRelations } from '../repository/user.repository';

export interface UserDto {
  id: string;
  name: string;
  loginIdentifier: string;
  role: Role;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  defaultVehicle: {
    id: string;
    registrationPlate: string;
    referenceName: string | null;
    isActive: boolean;
  } | null;
  /** SRS 12.1: the admin list shows the default route alongside the driver. */
  defaultRoute: { id: string; code: string; name: string } | null;
  assignedRoutes: {
    id: string;
    code: string;
    name: string;
    isActive: boolean;
    isDefault: boolean;
  }[];
}

export function toUserDto(user: UserWithRelations): UserDto {
  const defaultAssignment = user.routeAssignments.find((assignment) => assignment.isDefault);

  return {
    id: user.id,
    name: user.name,
    loginIdentifier: user.loginIdentifier,
    role: user.role as Role,
    isActive: user.isActive,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
    defaultVehicle: user.defaultVehicle
      ? {
          id: user.defaultVehicle.id,
          registrationPlate: user.defaultVehicle.registrationPlate,
          referenceName: user.defaultVehicle.referenceName,
          isActive: user.defaultVehicle.isActive,
        }
      : null,
    defaultRoute: defaultAssignment
      ? {
          id: defaultAssignment.route.id,
          code: defaultAssignment.route.code,
          name: defaultAssignment.route.name,
        }
      : null,
    assignedRoutes: user.routeAssignments.map((assignment) => ({
      id: assignment.route.id,
      code: assignment.route.code,
      name: assignment.route.name,
      // Surfaced so the admin screen can flag an assignment that has become
      // unusable because the route was deactivated (SRS 14.3).
      isActive: assignment.route.isActive,
      isDefault: assignment.isDefault,
    })),
  };
}
