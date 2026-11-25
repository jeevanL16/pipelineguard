import { z } from "zod";

export const ConnectRepositorySchema = z.object({
  repositoryUrl: z
    .string()
    .trim()
    .min(1, "Enter a repository URL to connect.")
    .refine((val) => {
      try {
        const u = new URL(val);
        return u.protocol === "https:" || u.protocol === "http:";
      } catch {
        return false;
      }
    }, "Enter a valid URL starting with https:// (for example https://github.com/org/repo)."),
  pipelineId: z
    .string()
    .trim()
    .min(3, "Pipeline ID must be 3 to 48 characters using lowercase letters, digits, and hyphens.")
    .max(48, "Pipeline ID must be 3 to 48 characters using lowercase letters, digits, and hyphens.")
    .regex(
      /^[a-z0-9][a-z0-9-]*[a-z0-9]$/,
      "Use lowercase letters, digits, and hyphens only (cannot start or end with a hyphen)."
    ),
  branch: z
    .string()
    .trim()
    .min(1, "Enter a branch name such as main.")
    .refine((v) => !/\s/.test(v), "Branch names cannot contain spaces.")
    .refine((v) => !v.includes(".."), "Branch names cannot contain '..'."),
});

export type ConnectRepositoryValues = z.infer<typeof ConnectRepositorySchema>;
