import { promises as fs } from "fs";
import path from "path";
import { randomBytes, scryptSync, timingSafeEqual } from "crypto";
import type { AdminSession, UserRole } from "@/lib/types";

const DATA_DIR = path.join(process.cwd(), "data");
const ACCOUNTS_FILE = path.join(DATA_DIR, "admin-accounts.json");

export type StoredAdminUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  /** scrypt$salt$hash — never store plain-text passwords */
  passwordHash: string;
  updatedAt: string;
};

type AccountsFile = {
  users: StoredAdminUser[];
};

function defaultPlainUsers(): Array<AdminSession & { password: string }> {
  const pass = process.env.ADMIN_PASSWORD || "oyon2024";
  return [
    {
      id: "staff-maya",
      name: "Maya Cohen",
      email: process.env.ADMIN_EMAIL || "admin@oyon.optics",
      role: "admin",
      password: pass,
    },
    {
      id: "staff-noah",
      name: "Noah Levi",
      email: "employee@oyon.optics",
      role: "employee",
      password: process.env.EMPLOYEE_PASSWORD || "employee2024",
    },
    {
      id: "staff-lina",
      name: "Lina Haddad",
      email: "receptionist@oyon.optics",
      role: "receptionist",
      password: process.env.RECEPTIONIST_PASSWORD || "reception2024",
    },
  ];
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [algo, salt, hash] = stored.split("$");
  if (algo !== "scrypt" || !salt || !hash) return false;
  try {
    const actual = scryptSync(password, salt, 64);
    const expected = Buffer.from(hash, "hex");
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

async function writeAccounts(file: AccountsFile): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(ACCOUNTS_FILE, JSON.stringify(file, null, 2), "utf8");
}

function seedAccounts(): AccountsFile {
  const now = new Date().toISOString();
  return {
    users: defaultPlainUsers().map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      passwordHash: hashPassword(u.password),
      updatedAt: now,
    })),
  };
}

export async function listAdminAccounts(): Promise<StoredAdminUser[]> {
  try {
    const raw = await fs.readFile(ACCOUNTS_FILE, "utf8");
    const parsed = JSON.parse(raw) as AccountsFile;
    if (Array.isArray(parsed?.users) && parsed.users.length > 0) {
      return parsed.users;
    }
  } catch {
    /* seed below */
  }
  const seeded = seedAccounts();
  try {
    await writeAccounts(seeded);
  } catch {
    /* read-only FS: still return in-memory seed for this process */
  }
  return seeded.users;
}

export async function findAdminByEmail(
  email: string
): Promise<StoredAdminUser | null> {
  const users = await listAdminAccounts();
  const needle = email.trim().toLowerCase();
  return users.find((u) => u.email.toLowerCase() === needle) || null;
}

export async function findAdminById(
  id: string
): Promise<StoredAdminUser | null> {
  const users = await listAdminAccounts();
  return users.find((u) => u.id === id) || null;
}

export async function updateAdminAccount(
  id: string,
  patch: {
    name?: string;
    email?: string;
    passwordHash?: string;
  }
): Promise<StoredAdminUser> {
  const users = await listAdminAccounts();
  const index = users.findIndex((u) => u.id === id);
  if (index < 0) throw new Error("USER_NOT_FOUND");

  const nextEmail = patch.email?.trim();
  if (nextEmail) {
    const clash = users.find(
      (u) =>
        u.id !== id && u.email.toLowerCase() === nextEmail.toLowerCase()
    );
    if (clash) throw new Error("EMAIL_TAKEN");
  }

  const updated: StoredAdminUser = {
    ...users[index],
    name: patch.name?.trim() || users[index].name,
    email: nextEmail || users[index].email,
    passwordHash: patch.passwordHash || users[index].passwordHash,
    updatedAt: new Date().toISOString(),
  };
  users[index] = updated;
  await writeAccounts({ users });
  return updated;
}

export function toSessionUser(user: StoredAdminUser): AdminSession {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  };
}
