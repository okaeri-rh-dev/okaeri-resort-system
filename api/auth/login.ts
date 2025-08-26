/**
 * Login API endpoint
 * POST /api/auth/login
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { z } from "zod";
import { withErrorHandler, withMethod, withValidation, compose } from "../_lib/middleware";
import {
  successResponse,
  ValidationError as _ValidationError,
  AuthenticationError,
  type TokenPayload,
} from "../_lib/types";
import { getPool } from "../_lib/database";
import { verifyPassword } from "../lib/password";
import { generateTokenPair } from "../lib/jwt";
import { rateLimit } from "../middleware/rate-limit";

// Request validation schema
const loginSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  projectId: z.string().uuid().optional(),
  rememberMe: z.boolean().optional().default(false),
});

type LoginRequest = z.infer<typeof loginSchema>;

interface DbUser {
  id: string;
  email: string;
  name: string;
  password_hash: string;
  role: string;
  avatar: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface ProjectInfo {
  id: string;
  name: string;
  slug: string;
  project_role: string;
  permissions: string[];
}

// Helper functions
async function findUserByEmail(
  client: { query: (text: string, params?: unknown[]) => Promise<{ rows: DbUser[] }> },
  email: string
): Promise<DbUser | null> {
  const userResult = await client.query(
    `SELECT 
      u.id,
      u.email,
      u.name,
      u.password_hash,
      u.role,
      u.avatar,
      u.is_active,
      u.created_at,
      u.updated_at
    FROM users u
    WHERE LOWER(u.email) = LOWER($1)`,
    [email]
  );

  return userResult.rows.length > 0 ? userResult.rows[0] : null;
}

async function getUserProjects(
  client: { query: (text: string, params?: unknown[]) => Promise<{ rows: ProjectInfo[] }> },
  userId: string,
  specificProjectId?: string
): Promise<{
  projects: ProjectInfo[];
  currentProject: ProjectInfo | null;
  permissions: string[];
}> {
  if (specificProjectId) {
    const projectResult = await client.query(
      `SELECT 
        p.id,
        p.name,
        p.slug,
        pm.role as project_role,
        pm.permissions
      FROM projects p
      JOIN project_members pm ON pm.project_id = p.id
      WHERE pm.user_id = $1 AND p.id = $2 AND p.status = 'ACTIVE'`,
      [userId, specificProjectId]
    );

    if (projectResult.rows.length === 0) {
      throw new AuthenticationError("No access to specified project");
    }

    const currentProject = projectResult.rows[0];
    return {
      projects: [currentProject],
      currentProject,
      permissions: currentProject.permissions || [],
    };
  }

  // Get all user's projects
  const projectsResult = await client.query(
    `SELECT 
      p.id,
      p.name,
      p.slug,
      p.type,
      p.status,
      pm.role as project_role,
      pm.permissions
    FROM projects p
    JOIN project_members pm ON pm.project_id = p.id
    WHERE pm.user_id = $1 AND p.status = 'ACTIVE'
    ORDER BY pm.joined_at DESC`,
    [userId]
  );

  const projects = projectsResult.rows;
  const currentProject = projects.length > 0 ? projects[0] : null;

  return {
    projects,
    currentProject,
    permissions: currentProject?.permissions || [],
  };
}

async function logAuthenticationEvent(
  client: { query: (text: string, params?: unknown[]) => Promise<unknown> },
  userId: string,
  email: string,
  projectId: string | undefined,
  req: VercelRequest
): Promise<void> {
  await client.query(
    `INSERT INTO activity_logs 
      (user_id, action, resource, details, ip_address, user_agent)
    VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      userId,
      "LOGIN",
      "auth",
      { email, projectId },
      req.headers["x-forwarded-for"] || req.socket?.remoteAddress,
      req.headers["user-agent"],
    ]
  );
}

// Main handler
async function handler(req: VercelRequest, res: VercelResponse) {
  const { email, password, projectId, rememberMe } = req.body as LoginRequest;

  const pool = getPool();
  const client = await pool.connect();

  try {
    // Find and validate user
    const user = await findUserByEmail(client, email);
    if (!user) {
      throw new AuthenticationError("Invalid email or password");
    }

    if (!user.is_active) {
      throw new AuthenticationError("Account is disabled");
    }

    // Verify password
    const isValidPassword = await verifyPassword(password, user.password_hash);
    if (!isValidPassword) {
      throw new AuthenticationError("Invalid email or password");
    }

    // Get user projects and permissions
    const { projects, currentProject, permissions } = await getUserProjects(
      client,
      user.id,
      projectId
    );

    // Generate tokens
    const tokenPayload: TokenPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      projectId: currentProject?.id,
      permissions,
    };

    const { accessToken, refreshToken, expiresIn } = generateTokenPair(tokenPayload, rememberMe);

    // Update last login
    await client.query("UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1", [user.id]);

    // Log authentication event
    await logAuthenticationEvent(client, user.id, email, currentProject?.id, req);

    // Set secure cookies
    res.setHeader("Set-Cookie", [
      `token=${accessToken}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${expiresIn}`,
      `refreshToken=${refreshToken}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${
        rememberMe ? 30 * 24 * 60 * 60 : 7 * 24 * 60 * 60
      }`,
    ]);

    // Return success response
    return res.status(200).json(
      successResponse(
        {
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            avatar: user.avatar,
          },
          accessToken,
          expiresIn,
          projects,
          currentProject,
        },
        "Login successful"
      )
    );
  } finally {
    client.release();
  }
}

// Export handler with middleware
export default compose(
  withErrorHandler,
  withMethod(["POST"]),
  withValidation(loginSchema, "body")
)(rateLimit("login")(handler));
