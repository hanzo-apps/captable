import { z } from "zod";

export const UpdateMutationSchema = z.object({
  id: z.string().optional(),
  publicId: z.string().optional(),
  title: z.string(),
  content: z.any(),
  isPublic: z.boolean().optional(),
  recipients: z.array(z.string()).optional(),
});

export type UpdateMutationType = z.infer<typeof UpdateMutationSchema>;
