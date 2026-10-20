import { orgRoles, type OrgRole } from '../mocks/orgMock';
import { createCollection } from './_collection';

const store = createCollection<OrgRole>(orgRoles);

export const listRoles = () => store.list();

export async function assignRole(id: string, person: string | null): Promise<OrgRole> {
  return store.update(id, { person });
}
