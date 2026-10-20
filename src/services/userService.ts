import { createCollection } from './_collection';

export interface UserRow {
  id: string;
  name: string;
  email: string;
  persona: string; // persona id
  org: string;
  lastActive: string;
  active: boolean;
}

const users: UserRow[] = [
  { id: 'U-001', name: 'S. Al-Harthy', email: 's.alharthy@oqrpi.example', persona: 'ta-manager', org: 'OQ RPI', lastActive: 'today 08:02', active: true },
  { id: 'U-002', name: 'N. Al-Busaidi', email: 'n.albusaidi@oqrpi.example', persona: 'steerco', org: 'OQ RPI', lastActive: 'today 07:41', active: true },
  { id: 'U-003', name: 'Dr. Y. Al-Lawati', email: 'y.allawati@oqrpi.example', persona: 'steerco', org: 'OQ RPI', lastActive: 'yesterday', active: true },
  { id: 'U-004', name: 'M. Al-Balushi', email: 'm.albalushi@oqrpi.example', persona: 'planner', org: 'OQ RPI', lastActive: 'today 07:55', active: true },
  { id: 'U-005', name: 'D. Pereira', email: 'd.pereira@oqrpi.example', persona: 'planner', org: 'OQ RPI', lastActive: 'today 06:30', active: true },
  { id: 'U-006', name: 'A. Hinai', email: 'a.hinai@oqrpi.example', persona: 'inspection', org: 'OQ RPI', lastActive: 'today 07:12', active: true },
  { id: 'U-007', name: 'P. Menon', email: 'p.menon@oqrpi.example', persona: 'inspection', org: 'OQ RPI', lastActive: 'today 06:58', active: true },
  { id: 'U-008', name: 'L. D’Souza', email: 'l.dsouza@oqrpi.example', persona: 'hse', org: 'OQ RPI', lastActive: 'today 07:48', active: true },
  { id: 'U-009', name: 'J. Whitfield', email: 'j.whitfield@galfar.example', persona: 'contractor', org: 'Galfar', lastActive: 'today 07:20', active: true },
  { id: 'U-010', name: 'Eng. S. Al-Maamari', email: 's.almaamari@galfar.example', persona: 'contractor', org: 'Galfar', lastActive: 'today 07:36', active: true },
  { id: 'U-011', name: 'V. Raghunathan', email: 'v.raghunathan@lnt.example', persona: 'contractor', org: 'Larsen & Toubro', lastActive: 'today 07:05', active: true },
  { id: 'U-012', name: 'C. Hughes', email: 'c.hughes@petrofac.example', persona: 'contractor', org: 'Petrofac Services', lastActive: 'yesterday', active: true },
  { id: 'U-013', name: 'A. Al-Zubair', email: 'a.alzubair@zubair.example', persona: 'contractor', org: 'Zubair E&M', lastActive: '3 days ago', active: true },
  { id: 'U-014', name: 'R. Nair (leaver)', email: 'r.nair@oqrpi.example', persona: 'planner', org: 'OQ RPI', lastActive: '21 days ago', active: false },
];

const store = createCollection<UserRow>(users);

export const listUsers = () => store.list();
export const setActive = (id: string, active: boolean) => store.update(id, { active });
export const setPersonaFor = (id: string, persona: string) => store.update(id, { persona });
