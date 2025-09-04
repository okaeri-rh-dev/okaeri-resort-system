/**
 * Registration API endpoint
 * POST /api/auth/register
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import { hashPassword, validatePassword } from "../lib/password";
import { generateTokenPair } from "../lib/jwt";
import { transaction, db } from "../lib/db";
import { rateLimit } from "../middleware/rate-limit";
import { successResponse, errorResponse, ValidationError, type TokenPayload } from "../_lib/types";

// Request validation schema
const registerSchema = z
  .object({
    email: z.string().email("Invalid email format"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
    name: z.string().min(2, "Name must be at least 2 characters"),
    projectName: z.string().min(2, "Project name must be at least 2 characters").optional(),
    projectType: z
      .enum(["RESORT", "HOTEL", "VACATION_RENTAL", "OTHER"])
      .optional()
      .default("RESORT"),
    phoneNumber: z.string().optional(),
    timezone: z.string().optional().default("Asia/Manila"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type _RegisterRequest = z.infer<typeof registerSchema>;

async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed",
      allowed: ["POST"],
    });
  }

  try {
    // Validate request body
    const validation = registerSchema.safeParse(req.body);
    if (!validation.success) {
      return res
        .status(400)
        .json(errorResponse(new ValidationError("Validation failed", validation.error.errors)));
    }

    const { email, password, name, projectName, projectType, phoneNumber, timezone } =
      validation.data;

    // Validate password strength
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      return res
        .status(400)
        .json(
          errorResponse(
            new ValidationError("Password validation failed", passwordValidation.errors)
          )
        );
    }

    // Execute registration in transaction
    const result = await transaction(async (client) => {
      // Check if email already exists
      const existingUser = await client.query(
        "SELECT id FROM users WHERE LOWER(email) = LOWER($1)",
        [email]
      );

      if (existingUser.rows.length > 0) {
        throw new ValidationError("Email already registered");
      }

      // Generate user ID
      const userId = uuidv4();

      // Hash password
      const passwordHash = await hashPassword(password);

      // Create user
      const userQuery = db.buildInsertQuery("users", {
        id: userId,
        email: email.toLowerCase(),
        name,
        password_hash: passwordHash,
        role: "OWNER", // First user is owner
        phone_number: phoneNumber,
        timezone,
        is_active: true,
        email_verified: false,
        created_at: new Date(),
        updated_at: new Date(),
      });

      const userResult = await client.query(userQuery.text, userQuery.values);
      const user = userResult.rows[0];

      // Create initial project if name provided
      let project = null;
      let permissions: string[] = [];

      if (projectName) {
        const projectId = uuidv4();
        const projectSlug = projectName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "");

        const projectQuery = db.buildInsertQuery("projects", {
          id: projectId,
          name: projectName,
          slug: projectSlug,
          type: projectType,
          owner_id: userId,
          status: "ACTIVE",
          settings: {
            timezone,
            currency: "PHP",
            dateFormat: "MM/DD/YYYY",
            language: "en",
          },
          created_at: new Date(),
          updated_at: new Date(),
        });

        const projectResult = await client.query(projectQuery.text, projectQuery.values);
        project = projectResult.rows[0];

        // Add user as project owner
        permissions = [
          "manage_bookings",
          "manage_properties",
          "manage_expenses",
          "manage_team",
          "view_reports",
          "manage_settings",
        ];

        const memberQuery = db.buildInsertQuery("project_members", {
          id: uuidv4(),
          project_id: projectId,
          user_id: userId,
          role: "OWNER",
          permissions,
          joined_at: new Date(),
        });

        await client.query(memberQuery.text, memberQuery.values);

        // Create project schema
        const schemaName = `project_${projectId.replace(/-/g, "_")}`;
        await client.query(`CREATE SCHEMA IF NOT EXISTS ${schemaName}`);

        // Initialize project tables (simplified for now)
        await client.query(`SET search_path TO ${schemaName}, public`);

        // Create basic tables in project schema
        const tables = [
          `CREATE TABLE IF NOT EXISTS properties (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name VARCHAR(255) NOT NULL,
            type VARCHAR(50),
            capacity INTEGER,
            base_rate DECIMAL(10, 2),
            status VARCHAR(50) DEFAULT 'AVAILABLE',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )`,
          `CREATE TABLE IF NOT EXISTS bookings (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            property_id UUID REFERENCES properties(id),
            guest_name VARCHAR(255) NOT NULL,
            check_in DATE NOT NULL,
            check_out DATE NOT NULL,
            status VARCHAR(50) DEFAULT 'PENDING',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )`,
        ];

        for (const tableQuery of tables) {
          await client.query(tableQuery);
        }
      }

      // Log registration event
      await client.query(
        `INSERT INTO activity_logs 
          (user_id, action, resource, details, ip_address, user_agent, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          userId,
          "REGISTER",
          "auth",
          { email, projectName },
          req.headers["x-forwarded-for"] || req.socket?.remoteAddress,
          req.headers["user-agent"],
          new Date(),
        ]
      );

      return { user, project, permissions };
    });

    // Generate JWT tokens
    const tokenPayload: TokenPayload = {
      userId: result.user.id,
      email: result.user.email,
      role: result.user.role,
      projectId: result.project?.id,
      permissions: result.permissions,
    };

    const { accessToken, refreshToken, expiresIn } = generateTokenPair(tokenPayload);

    // CRITICAL: NO COOKIES - JWT tokens returned in response body only
    // Client must use Authorization headers for all requests

    // Send welcome email (stub for now)
    // await sendWelcomeEmail(result.user.email, result.user.name);

    // Return success response with tokens in body
    return res.status(201).json(
      successResponse(
        {
          user: {
            id: result.user.id,
            email: result.user.email,
            name: result.user.name,
            role: result.user.role,
          },
          project: result.project
            ? {
                id: result.project.id,
                name: result.project.name,
                slug: result.project.slug,
                type: result.project.type,
              }
            : null,
          accessToken,
          refreshToken,
          expiresIn,
        },
        "Registration successful"
      )
    );
  } catch (error) {
    console.error("[Register] Error:", error);

    if (error instanceof ValidationError) {
      return res.status(400).json(errorResponse(error));
    }

    return res.status(500).json(errorResponse(new Error("Registration failed. Please try again.")));
  }
}

// Export with rate limiting
export default rateLimit("register")(handler);
