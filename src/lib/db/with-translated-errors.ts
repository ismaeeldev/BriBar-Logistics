/**
 * Makes `AppError` the service layer's error contract, whoever calls it.
 *
 * `translatePrismaError` was originally reached only from `withRouteHandler`,
 * which was wrong in a way the integration tests exposed: a server component or
 * a server action calling `vehicleService.create` directly — which is the
 * normal shape of an App Router application, and what Phases 3 and 4 will do —
 * received a raw `PrismaClientKnownRequestError` instead of a clean 409.
 *
 * The service layer's contract should not depend on which caller reached it. So
 * translation happens here, at the boundary of every write, and the HTTP
 * wrapper's own call becomes a harmless second line of defence.
 *
 * Only write paths need wrapping. Reads fail with connection errors and bugs,
 * neither of which has a meaningful user-facing translation — those should
 * surface as a 500.
 */
import { translatePrismaError } from './prisma-errors';

export async function withTranslatedErrors<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    // `translatePrismaError` returns null for anything it does not recognise,
    // and the original is rethrown untouched so a genuine bug keeps its stack.
    throw translatePrismaError(error) ?? error;
  }
}
